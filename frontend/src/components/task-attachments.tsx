import { useRef, useState } from "react";
import { Download, Paperclip, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  useAttachments,
  useDeleteAttachment,
  useUploadAttachment,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/errors";
import { Button } from "./ui/button";
import { ConfirmDialog } from "./confirm-dialog";
import { api } from "@/lib/api";
import { AttachmentThumbnail, isImageAttachment } from "./attachment-preview";

const MAX_SIZE = 5 * 1024 * 1024;

export function TaskAttachments({
  taskId,
  boardId,
}: {
  taskId: string;
  boardId: string;
}) {
  const { user } = useAuth();
  const { data: attachments, isLoading } = useAttachments(taskId);
  const upload = useUploadAttachment(boardId);
  const remove = useDeleteAttachment(taskId, boardId);
  const inputRef = useRef<HTMLInputElement>(null);
  const [downloading, setDownloading] = useState<string | null>(null);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (file.size > MAX_SIZE) {
      toast.error("File is too large (max 10MB)");
      return;
    }
    try {
      await upload.mutateAsync({ taskId, file });
      toast.success("File uploaded");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to upload file"));
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const download = async (id: string, fileName: string) => {
    setDownloading(id);
    try {
      const res = await api.get(`/api/attachments/${id}/download`, {
        responseType: "blob",
      });
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to download file"));
    } finally {
      setDownloading(null);
    }
  };

  const del = async (id: string) => {
    try {
      await remove.mutateAsync(id);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete attachment"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">
          {attachments?.length ?? 0} file
          {(attachments?.length ?? 0) === 1 ? "" : "s"}
        </span>
        <Button
          size="sm"
          variant="outline"
          onClick={() => inputRef.current?.click()}
          disabled={upload.isPending}
        >
          <Upload /> {upload.isPending ? "Uploading..." : "Upload"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading attachments...</p>
      )}

      <ul className="flex flex-col gap-2">
        {attachments?.map((a) => (
          <li
            key={a.id}
            className="flex items-center justify-between gap-2 rounded-md border bg-card p-2 text-sm"
          >
            <div className="flex min-w-0 items-center gap-2">
              {isImageAttachment(a.fileName) ? (
                <AttachmentThumbnail id={a.id} fileName={a.fileName} />
              ) : (
                <Paperclip className="size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate">{a.fileName}</span>
                <span className="text-xs text-muted-foreground">
                  {a.uploader.username} ·{" "}
                  {format(new Date(a.createdAt), "MMM d")}
                </span>
              </div>
            </div>
            <div className="flex shrink-0 gap-1">
              <button
                onClick={() => void download(a.id, a.fileName)}
                disabled={downloading === a.id}
                className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-50"
                aria-label="Download"
              >
                <Download className="size-4" />
              </button>
              {user?.id === a.uploader.id && (
                <ConfirmDialog
                  title="Delete this attachment?"
                  description={a.fileName}
                  confirmLabel="Delete"
                  onConfirm={() => del(a.id)}
                  trigger={
                    <button
                      className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                      aria-label="Delete"
                    >
                      <Trash2 className="size-4" />
                    </button>
                  }
                />
              )}
            </div>
          </li>
        ))}
      </ul>

      {attachments && attachments.length === 0 && !isLoading && (
        <p className="text-sm text-muted-foreground">No attachments yet.</p>
      )}
    </div>
  );
}
