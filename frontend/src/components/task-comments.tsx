import { useState } from "react";
import { formatDistanceToNow } from "date-fns";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  useComments,
  useCreateComment,
  useUpdateComment,
  useDeleteComment,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { errorMessage } from "@/lib/errors";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { Textarea } from "./ui/textarea";
import { ConfirmDialog } from "./confirm-dialog";
import type { Comment } from "@/lib/types";

export function TaskComments({
  taskId,
  boardId,
}: {
  taskId: string;
  boardId: string;
}) {
  const { user } = useAuth();
  const { data: comments, isLoading } = useComments(taskId);
  const create = useCreateComment(boardId);
  const [draft, setDraft] = useState("");

  const submit = async () => {
    const content = draft.trim();
    if (!content) return;
    try {
      await create.mutateAsync({ taskId, content });
      setDraft("");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add comment"));
    }
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2">
        <Textarea
          rows={2}
          placeholder="Write a comment..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              void submit();
            }
          }}
        />
        <Button
          onClick={() => void submit()}
          disabled={!draft.trim() || create.isPending}
          size="sm"
        >
          Post
        </Button>
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading comments...</p>
      )}

      <ul className="flex flex-col gap-3">
        {comments?.map((c) => (
          <CommentItem
            key={c.id}
            comment={c}
            taskId={taskId}
            boardId={boardId}
            canEdit={user?.id === c.user.id}
          />
        ))}
      </ul>
      {comments && comments.length === 0 && (
        <p className="text-sm text-muted-foreground">
          Be the first to comment.
        </p>
      )}
    </div>
  );
}

function CommentItem({
  comment,
  taskId,
  boardId,
  canEdit,
}: {
  comment: Comment;
  taskId: string;
  boardId: string;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [content, setContent] = useState(comment.content);
  const update = useUpdateComment(taskId);
  const remove = useDeleteComment(taskId, boardId);

  const save = async () => {
    const trimmed = content.trim();
    if (!trimmed) return;
    try {
      await update.mutateAsync({ id: comment.id, content: trimmed });
      setEditing(false);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update comment"));
    }
  };

  const del = async () => {
    try {
      await remove.mutateAsync(comment.id);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete comment"));
    }
  };

  return (
    <li className="flex gap-2">
      <Avatar className="size-7 shrink-0">
        <AvatarFallback className="text-[10px]">
          {comment.user.username.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1 rounded-lg border bg-card p-3">
        <div className="mb-1 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <span className="font-medium">{comment.user.username}</span>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(comment.createdAt), {
                addSuffix: true,
              })}
            </span>
          </div>
          {canEdit && !editing && (
            <div className="flex items-center gap-1">
              <button
                onClick={() => setEditing(true)}
                className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Edit comment"
              >
                <Pencil className="size-3.5" />
              </button>
              <ConfirmDialog
                title="Delete this comment?"
                confirmLabel="Delete"
                onConfirm={del}
                trigger={
                  <button
                    className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
                    aria-label="Delete comment"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                }
              />
            </div>
          )}
        </div>
        {editing ? (
          <div className="flex flex-col gap-2">
            <Textarea
              rows={2}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              autoFocus
            />
            <div className="flex justify-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setContent(comment.content);
                }}
              >
                <X className="size-3.5" /> Cancel
              </Button>
              <Button
                size="sm"
                onClick={() => void save()}
                disabled={update.isPending}
              >
                <Check className="size-3.5" /> Save
              </Button>
            </div>
          </div>
        ) : (
          <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
        )}
      </div>
    </li>
  );
}
