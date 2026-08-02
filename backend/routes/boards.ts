import express, { Response } from "express";
import core from "express-serve-static-core";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { authMiddleware, AuthenticatedRequest } from "../middleware.js";
import { validate } from "../lib/validate.js";

const router = express.Router();

router.use(authMiddleware);

const columnName = z.string().min(1).max(50).trim();

const createBoardSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).trim().optional(),
  columns: z.array(columnName).min(1).max(20).optional(),
});

const updateBoardSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
  description: z.string().max(500).trim().nullable().optional(),
  columns: z.array(columnName).min(1).max(20).optional(),
});

type CreateBoardBody = z.infer<typeof createBoardSchema>;
type UpdateBoardBody = z.infer<typeof updateBoardSchema>;

const boardInclude = {
  creator: { select: { id: true, username: true, email: true } },
  members: {
    include: { user: { select: { id: true, username: true, email: true } } },
  },
  _count: { select: { tasks: true } },
} as const;

router.post(
  "/",
  async (
    req: AuthenticatedRequest<core.ParamsDictionary, unknown, CreateBoardBody>,
    res: Response,
  ) => {
    try {
      const body = validate(createBoardSchema, req.body, res);
      if (!body) return;

      const board = await prisma.board.create({
        data: {
          name: body.name,
          description: body.description ?? null,
          ...(body.columns && { columns: body.columns }),
          creator: { connect: { id: String(req.userId) } },
          members: { create: { userId: String(req.userId) } },
        },
        include: boardInclude,
      });

      res.status(201).json({ board });
    } catch (error) {
      console.error("Create board error:", error);
      res.status(500).json({ error: "Failed to create board" });
    }
  },
);

router.get("/", async (req: AuthenticatedRequest, res: Response) => {
  try {
    const boards = await prisma.board.findMany({
      where: { members: { some: { userId: String(req.userId) } } },
      include: boardInclude,
      orderBy: { createdAt: "desc" },
    });

    res.json({ boards });
  } catch (error) {
    console.error("List boards error:", error);
    res.status(500).json({ error: "Failed to list boards" });
  }
});

router.get(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const board = await prisma.board.findFirst({
        where: {
          id: req.params.id,
          members: { some: { userId: String(req.userId) } },
        },
        include: {
          ...boardInclude,
          tasks: {
            include: {
              assignee: { select: { id: true, username: true, email: true } },
              _count: { select: { comments: true, attachments: true } },
            },
            orderBy: { createdAt: "asc" },
          },
        },
      });

      if (!board) {
        res.status(404).json({ error: "Board not found" });
        return;
      }

      res.json({ board });
    } catch (error) {
      console.error("Get board error:", error);
      res.status(500).json({ error: "Failed to get board" });
    }
  },
);

router.put(
  "/:id",
  async (
    req: AuthenticatedRequest<{ id: string }, unknown, UpdateBoardBody>,
    res: Response,
  ) => {
    try {
      const body = validate(updateBoardSchema, req.body, res);
      if (!body) return;

      const existing = await prisma.board.findFirst({
        where: { id: req.params.id, createdById: String(req.userId) },
      });

      if (!existing) {
        res
          .status(404)
          .json({ error: "Board not found or you are not the owner" });
        return;
      }

      if (body.columns) {
        const orphaned = await prisma.task.findMany({
          where: {
            boardId: req.params.id,
            status: { notIn: body.columns },
          },
          select: { id: true, status: true },
        });
        if (orphaned.length > 0) {
          const statuses = [...new Set(orphaned.map((t) => t.status))];
          res.status(400).json({
            error: `Cannot remove columns that contain tasks. Tasks still exist in: ${statuses.join(", ")}`,
          });
          return;
        }
      }

      const board = await prisma.board.update({
        where: { id: req.params.id },
        data: {
          ...(body.name !== undefined && { name: body.name }),
          ...("description" in body && {
            description: body.description ?? null,
          }),
          ...(body.columns && { columns: body.columns }),
        },
        include: boardInclude,
      });

      res.json({ board });
    } catch (error) {
      console.error("Update board error:", error);
      res.status(500).json({ error: "Failed to update board" });
    }
  },
);

const addMemberSchema = z
  .object({
    userId: z.string().uuid().optional(),
    email: z.string().email().optional(),
    username: z.string().min(1).optional(),
  })
  .refine((v) => v.userId || v.email || v.username, {
    message: "Provide userId, email, or username",
  });

router.post(
  "/:id/members",
  async (
    req: AuthenticatedRequest<
      { id: string },
      unknown,
      z.infer<typeof addMemberSchema>
    >,
    res: Response,
  ) => {
    try {
      const body = validate(addMemberSchema, req.body, res);
      if (!body) return;

      const board = await prisma.board.findFirst({
        where: {
          id: req.params.id,
          members: { some: { userId: String(req.userId) } },
        },
      });

      if (!board) {
        res.status(404).json({ error: "Board not found or access denied" });
        return;
      }

      const user = await prisma.user.findFirst({
        where: body.userId
          ? { id: body.userId }
          : body.email
            ? { email: body.email }
            : { username: body.username },
        select: { id: true, username: true, email: true },
      });

      if (!user) {
        res.status(404).json({ error: "User not found" });
        return;
      }

      const existing = await prisma.boardMember.findFirst({
        where: { boardId: req.params.id, userId: user.id },
      });
      if (existing) {
        res
          .status(409)
          .json({ error: "User is already a member of this board" });
        return;
      }

      await prisma.boardMember.create({
        data: { boardId: req.params.id, userId: user.id },
      });

      res.status(201).json({ user });
    } catch (error) {
      console.error("Add board member error:", error);
      res.status(500).json({ error: "Failed to add member" });
    }
  },
);

router.delete(
  "/:id/members/:userId",
  async (
    req: AuthenticatedRequest<{ id: string; userId: string }>,
    res: Response,
  ) => {
    try {
      const board = await prisma.board.findFirst({
        where: { id: req.params.id, createdById: String(req.userId) },
      });
      if (!board) {
        res
          .status(404)
          .json({ error: "Board not found or you are not the owner" });
        return;
      }
      if (req.params.userId === board.createdById) {
        res.status(400).json({ error: "Cannot remove the board creator" });
        return;
      }
      await prisma.$transaction([
        prisma.task.updateMany({
          where: { boardId: req.params.id, assignedToId: req.params.userId },
          data: { assignedToId: null },
        }),
        prisma.boardMember.deleteMany({
          where: { boardId: req.params.id, userId: req.params.userId },
        }),
      ]);
      res.json({ message: "Member removed" });
    } catch (error) {
      console.error("Remove board member error:", error);
      res.status(500).json({ error: "Failed to remove member" });
    }
  },
);

router.delete(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const existing = await prisma.board.findFirst({
        where: { id: req.params.id, createdById: String(req.userId) },
      });

      if (!existing) {
        res
          .status(404)
          .json({ error: "Board not found or you are not the owner" });
        return;
      }

      await prisma.$transaction([
        prisma.attachment.deleteMany({
          where: { task: { boardId: req.params.id } },
        }),
        prisma.comment.deleteMany({
          where: { task: { boardId: req.params.id } },
        }),
        prisma.task.deleteMany({ where: { boardId: req.params.id } }),
        prisma.boardMember.deleteMany({ where: { boardId: req.params.id } }),
        prisma.board.delete({ where: { id: req.params.id } }),
      ]);

      res.json({ message: "Board deleted successfully" });
    } catch (error) {
      console.error("Delete board error:", error);
      res.status(500).json({ error: "Failed to delete board" });
    }
  },
);

export default router;
