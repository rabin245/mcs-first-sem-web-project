import express, { Response } from "express";
import core from "express-serve-static-core";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthenticatedRequest } from "../middleware";
import { validate } from "../lib/validate";

const router = express.Router();

router.use(authMiddleware);

const statusName = z.string().min(1).max(50).trim();

const createTaskSchema = z.object({
  boardId: z.string().uuid(),
  title: z.string().min(1).max(200).trim(),
  description: z.string().max(2000).trim().optional(),
  status: statusName.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(5).nullable().optional(),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).max(200).trim().optional(),
  description: z.string().max(2000).trim().nullable().optional(),
  status: statusName.optional(),
  assignedToId: z.string().uuid().nullable().optional(),
  dueDate: z.string().datetime({ offset: true }).nullable().optional(),
  priority: z.number().int().min(1).max(5).nullable().optional(),
});

const listTasksSchema = z.object({
  boardId: z.string().uuid(),
  status: statusName.optional(),
  assignedToId: z.string().uuid().optional(),
  priority: z.coerce.number().int().min(1).max(5).optional(),
});

type CreateTaskBody = z.infer<typeof createTaskSchema>;
type UpdateTaskBody = z.infer<typeof updateTaskSchema>;
type ListTasksQuery = z.infer<typeof listTasksSchema>;

const taskInclude = {
  assignee: { select: { id: true, username: true, email: true } },
  _count: { select: { comments: true, attachments: true } },
} as const;

router.post(
  "/",
  async (
    req: AuthenticatedRequest<core.ParamsDictionary, unknown, CreateTaskBody>,
    res: Response,
  ) => {
    try {
      const body = validate(createTaskSchema, req.body, res);
      if (!body) return;

      const board = await prisma.board.findFirst({
        where: {
          id: body.boardId,
          members: { some: { userId: String(req.userId) } },
        },
      });

      if (!board) {
        res.status(404).json({ error: "Board not found or access denied" });
        return;
      }

      const status = body.status ?? board.columns[0];
      if (!board.columns.includes(status)) {
        res.status(400).json({
          error: `status must be one of: ${board.columns.join(", ")}`,
        });
        return;
      }

      if (body.assignedToId) {
        const member = await prisma.boardMember.findFirst({
          where: { boardId: body.boardId, userId: body.assignedToId },
        });
        if (!member) {
          res
            .status(400)
            .json({ error: "Assignee is not a member of this board" });
          return;
        }
      }

      const task = await prisma.task.create({
        data: {
          boardId: body.boardId,
          title: body.title,
          description: body.description ?? null,
          status,
          assignedToId: body.assignedToId ?? null,
          dueDate: body.dueDate ? new Date(body.dueDate) : null,
          priority: body.priority ?? null,
        },
        include: taskInclude,
      });

      res.status(201).json({ task });
    } catch (error) {
      console.error("Create task error:", error);
      res.status(500).json({ error: "Failed to create task" });
    }
  },
);

router.get(
  "/",
  async (
    req: AuthenticatedRequest<
      core.ParamsDictionary,
      unknown,
      unknown,
      ListTasksQuery
    >,
    res: Response,
  ) => {
    try {
      const query = validate(listTasksSchema, req.query, res);
      if (!query) return;

      const board = await prisma.board.findFirst({
        where: {
          id: query.boardId,
          members: { some: { userId: String(req.userId) } },
        },
      });

      if (!board) {
        res.status(404).json({ error: "Board not found or access denied" });
        return;
      }

      const tasks = await prisma.task.findMany({
        where: {
          boardId: query.boardId,
          ...(query.status && { status: query.status }),
          ...(query.assignedToId && { assignedToId: query.assignedToId }),
          ...(query.priority !== undefined && { priority: query.priority }),
        },
        include: taskInclude,
        orderBy: { createdAt: "asc" },
      });

      res.json({ tasks });
    } catch (error) {
      console.error("List tasks error:", error);
      res.status(500).json({ error: "Failed to list tasks" });
    }
  },
);

router.get(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: req.params.id,
          board: { members: { some: { userId: String(req.userId) } } },
        },
        include: taskInclude,
      });

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      res.json({ task });
    } catch (error) {
      console.error("Get task error:", error);
      res.status(500).json({ error: "Failed to get task" });
    }
  },
);

router.put(
  "/:id",
  async (
    req: AuthenticatedRequest<{ id: string }, unknown, UpdateTaskBody>,
    res: Response,
  ) => {
    try {
      const body = validate(updateTaskSchema, req.body, res);
      if (!body) return;

      const task = await prisma.task.findFirst({
        where: {
          id: req.params.id,
          board: { members: { some: { userId: String(req.userId) } } },
        },
        include: { board: { select: { columns: true } } },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      if (
        body.status !== undefined &&
        !task.board.columns.includes(body.status)
      ) {
        res.status(400).json({
          error: `status must be one of: ${task.board.columns.join(", ")}`,
        });
        return;
      }

      if (body.assignedToId) {
        const member = await prisma.boardMember.findFirst({
          where: { boardId: task.boardId, userId: body.assignedToId },
        });
        if (!member) {
          res
            .status(400)
            .json({ error: "Assignee is not a member of this board" });
          return;
        }
      }

      const updated = await prisma.task.update({
        where: { id: req.params.id },
        data: {
          ...(body.title !== undefined && { title: body.title }),
          ...("description" in body && {
            description: body.description ?? null,
          }),
          ...(body.status !== undefined && { status: body.status }),
          ...("assignedToId" in body && {
            assignedToId: body.assignedToId ?? null,
          }),
          ...("dueDate" in body && {
            dueDate: body.dueDate ? new Date(body.dueDate) : null,
          }),
          ...("priority" in body && { priority: body.priority ?? null }),
        },
        include: taskInclude,
      });

      res.json({ task: updated });
    } catch (error) {
      console.error("Update task error:", error);
      res.status(500).json({ error: "Failed to update task" });
    }
  },
);

router.delete(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const task = await prisma.task.findFirst({
        where: {
          id: req.params.id,
          board: { members: { some: { userId: String(req.userId) } } },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found" });
        return;
      }

      await prisma.$transaction([
        prisma.attachment.deleteMany({ where: { taskId: req.params.id } }),
        prisma.comment.deleteMany({ where: { taskId: req.params.id } }),
        prisma.task.delete({ where: { id: req.params.id } }),
      ]);

      res.json({ message: "Task deleted successfully" });
    } catch (error) {
      console.error("Delete task error:", error);
      res.status(500).json({ error: "Failed to delete task" });
    }
  },
);

export default router;
