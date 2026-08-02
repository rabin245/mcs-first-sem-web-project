import express, { Response } from "express";
import core from "express-serve-static-core";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthenticatedRequest } from "../middleware";
import { validate } from "../lib/validate";

const router = express.Router();

router.use(authMiddleware);

const createCommentSchema = z.object({
  taskId: z.string().uuid(),
  content: z.string().min(1).max(2000).trim(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
});

const listCommentsSchema = z.object({
  taskId: z.string().uuid(),
});

type CreateCommentBody = z.infer<typeof createCommentSchema>;
type UpdateCommentBody = z.infer<typeof updateCommentSchema>;
type ListCommentsQuery = z.infer<typeof listCommentsSchema>;

const commentInclude = {
  user: { select: { id: true, username: true, email: true } },
} as const;

router.post(
  "/",
  async (
    req: AuthenticatedRequest<
      core.ParamsDictionary,
      unknown,
      CreateCommentBody
    >,
    res: Response,
  ) => {
    try {
      const body = validate(createCommentSchema, req.body, res);
      if (!body) return;

      const task = await prisma.task.findFirst({
        where: {
          id: body.taskId,
          board: { members: { some: { userId: String(req.userId) } } },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found or access denied" });
        return;
      }

      const comment = await prisma.comment.create({
        data: {
          taskId: body.taskId,
          userId: String(req.userId),
          content: body.content,
        },
        include: commentInclude,
      });

      res.status(201).json({ comment });
    } catch (error) {
      console.error("Create comment error:", error);
      res.status(500).json({ error: "Failed to create comment" });
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
      ListCommentsQuery
    >,
    res: Response,
  ) => {
    try {
      const query = validate(listCommentsSchema, req.query, res);
      if (!query) return;

      const task = await prisma.task.findFirst({
        where: {
          id: query.taskId,
          board: { members: { some: { userId: String(req.userId) } } },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found or access denied" });
        return;
      }

      const comments = await prisma.comment.findMany({
        where: { taskId: query.taskId },
        include: commentInclude,
        orderBy: { createdAt: "asc" },
      });

      res.json({ comments });
    } catch (error) {
      console.error("List comments error:", error);
      res.status(500).json({ error: "Failed to list comments" });
    }
  },
);

router.put(
  "/:id",
  async (
    req: AuthenticatedRequest<{ id: string }, unknown, UpdateCommentBody>,
    res: Response,
  ) => {
    try {
      const body = validate(updateCommentSchema, req.body, res);
      if (!body) return;

      const comment = await prisma.comment.findFirst({
        where: { id: req.params.id, userId: String(req.userId) },
      });

      if (!comment) {
        res
          .status(404)
          .json({ error: "Comment not found or you are not the author" });
        return;
      }

      const updated = await prisma.comment.update({
        where: { id: req.params.id },
        data: { content: body.content },
        include: commentInclude,
      });

      res.json({ comment: updated });
    } catch (error) {
      console.error("Update comment error:", error);
      res.status(500).json({ error: "Failed to update comment" });
    }
  },
);

router.delete(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const comment = await prisma.comment.findFirst({
        where: { id: req.params.id, userId: String(req.userId) },
      });

      if (!comment) {
        res
          .status(404)
          .json({ error: "Comment not found or you are not the author" });
        return;
      }

      await prisma.comment.delete({ where: { id: req.params.id } });

      res.json({ message: "Comment deleted successfully" });
    } catch (error) {
      console.error("Delete comment error:", error);
      res.status(500).json({ error: "Failed to delete comment" });
    }
  },
);

export default router;
