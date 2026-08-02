import "dotenv/config";
import express, { Response } from "express";
import multer from "multer";
import path from "path";
import core from "express-serve-static-core";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { authMiddleware, AuthenticatedRequest } from "../middleware";
import { validate } from "../lib/validate";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);
const SUPABASE_BUCKET_NAME = process.env.SUPABASE_BUCKET_NAME || "attachments";

const router = express.Router();

router.use(authMiddleware);

const uploadBodySchema = z.object({
  taskId: z.string().uuid(),
});

const listQuerySchema = z.object({
  taskId: z.string().uuid(),
});

type UploadBody = z.infer<typeof uploadBodySchema>;
type ListQuery = z.infer<typeof listQuerySchema>;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
});

router.post(
  "/",
  upload.single("file"),
  async (
    req: AuthenticatedRequest<core.ParamsDictionary, unknown, UploadBody>,
    res: Response,
  ) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No file uploaded" });
        return;
      }

      const body = validate(uploadBodySchema, req.body, res);
      if (!body) {
        return;
      }

      const { taskId } = body;

      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          board: { members: { some: { userId: String(req.userId) } } },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found or access denied" });
        return;
      }

      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      const supabasePath = `${taskId}/${unique}${path.extname(req.file.originalname)}`;
      const { error: uploadError } = await supabase.storage
        .from(SUPABASE_BUCKET_NAME)
        .upload(supabasePath, req.file.buffer, {
          contentType: req.file.mimetype,
          upsert: false,
        });
      if (uploadError) {
        res.status(500).json({ error: "Failed to upload to storage" });
        return;
      }
      const storedPath = supabasePath;

      const attachment = await prisma.attachment.create({
        data: {
          taskId,
          fileName: req.file.originalname,
          filePath: storedPath,
          uploadedById: String(req.userId),
        },
        include: {
          uploader: { select: { id: true, username: true, email: true } },
        },
      });

      res.status(201).json({ attachment });
    } catch (error) {
      console.error("Upload attachment error:", error);
      res.status(500).json({ error: "Failed to upload attachment" });
    }
  },
);

router.get(
  "/:id/download",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const attachment = await prisma.attachment.findFirst({
        where: {
          id: req.params.id,
          task: {
            board: { members: { some: { userId: String(req.userId) } } },
          },
        },
      });

      if (!attachment) {
        res.status(404).json({ error: "Attachment not found" });
        return;
      }

      const { data, error } = await supabase.storage
        .from(SUPABASE_BUCKET_NAME)
        .download(attachment.filePath);
      if (error || !data) {
        res.status(500).json({ error: "Failed to download file from storage" });
        return;
      }

      const fileBuffer = Buffer.from(await data.arrayBuffer());
      const contentType = data.type || "application/octet-stream";
      const encodedFileName = encodeURIComponent(attachment.fileName);

      res.setHeader("Content-Type", contentType);
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="${attachment.fileName}"; filename*=UTF-8''${encodedFileName}`,
      );
      res.send(fileBuffer);
    } catch (error) {
      console.error("Download attachment error:", error);
      res.status(500).json({ error: "Failed to download attachment" });
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
      ListQuery
    >,
    res: Response,
  ) => {
    try {
      const query = validate(listQuerySchema, req.query, res);
      if (!query) return;

      const { taskId } = query;

      const task = await prisma.task.findFirst({
        where: {
          id: taskId,
          board: { members: { some: { userId: String(req.userId) } } },
        },
      });

      if (!task) {
        res.status(404).json({ error: "Task not found or access denied" });
        return;
      }

      const attachments = await prisma.attachment.findMany({
        where: { taskId },
        include: {
          uploader: { select: { id: true, username: true, email: true } },
        },
        orderBy: { createdAt: "asc" },
      });

      res.json({ attachments });
    } catch (error) {
      console.error("List attachments error:", error);
      res.status(500).json({ error: "Failed to list attachments" });
    }
  },
);

router.delete(
  "/:id",
  async (req: AuthenticatedRequest<{ id: string }>, res: Response) => {
    try {
      const attachment = await prisma.attachment.findFirst({
        where: {
          id: req.params.id,
          task: {
            board: { members: { some: { userId: String(req.userId) } } },
          },
        },
      });

      if (!attachment) {
        res.status(404).json({ error: "Attachment not found" });
        return;
      }

      await supabase.storage
        .from(SUPABASE_BUCKET_NAME)
        .remove([attachment.filePath]);

      await prisma.attachment.delete({ where: { id: req.params.id } });

      res.json({ message: "Attachment deleted successfully" });
    } catch (error) {
      console.error("Delete attachment error:", error);
      res.status(500).json({ error: "Failed to delete attachment" });
    }
  },
);

export default router;
