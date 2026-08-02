import express, { Response } from "express";
import core from "express-serve-static-core";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthenticatedRequest } from "../middleware";
import { validate } from "../lib/validate";

const router = express.Router();

router.use(authMiddleware);

const listUsersSchema = z.object({
  boardId: z.string().uuid().optional(),
  search: z.string().trim().max(100).optional(),
  limit: z.coerce.number().int().min(1).max(25).optional(),
});

type ListUsersQuery = z.infer<typeof listUsersSchema>;

router.get(
  "/",
  async (
    req: AuthenticatedRequest<
      core.ParamsDictionary,
      unknown,
      unknown,
      ListUsersQuery
    >,
    res: Response,
  ) => {
    try {
      const query = validate(listUsersSchema, req.query, res);
      if (!query) return;

      const { boardId, search, limit = 10 } = query;

      if (boardId) {
        const board = await prisma.board.findFirst({
          where: {
            id: boardId,
            members: { some: { userId: String(req.userId) } },
          },
        });

        if (!board) {
          res.status(404).json({ error: "Board not found or access denied" });
          return;
        }

        const members = await prisma.boardMember.findMany({
          where: { boardId },
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
        });

        res.json({ users: members.map((m) => m.user) });
        return;
      }

      const users = await prisma.user.findMany({
        where: search
          ? {
              OR: [
                { username: { contains: search, mode: "insensitive" } },
                { email: { contains: search, mode: "insensitive" } },
              ],
            }
          : undefined,
        select: { id: true, username: true, email: true },
        orderBy: { username: "asc" },
        take: limit,
      });

      res.json({ users });
    } catch (error) {
      console.error("List users error:", error);
      res.status(500).json({ error: "Failed to list users" });
    }
  },
);

export default router;
