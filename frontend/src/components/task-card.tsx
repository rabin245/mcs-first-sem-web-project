import { format } from "date-fns";
import { MessageSquare, Paperclip, Flag } from "lucide-react";
import type { Task } from "@/lib/types";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { cn } from "@/lib/utils";

const priorityColors: Record<number, string> = {
  1: "text-red-500",
  2: "text-orange-500",
  3: "text-yellow-500",
  4: "text-blue-500",
  5: "text-slate-400",
};

export function TaskCard({
  task,
  onClick,
}: {
  task: Task;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="group flex w-full flex-col gap-2 rounded-lg border bg-card p-3 text-left shadow-sm transition-all hover:border-primary/40 hover:shadow"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium leading-tight">{task.title}</p>
        {task.priority && (
          <Flag
            className={cn("size-4 shrink-0", priorityColors[task.priority])}
          />
        )}
      </div>
      {task.description && (
        <p className="line-clamp-2 text-xs text-muted-foreground">
          {task.description}
        </p>
      )}
      <div className="flex items-center justify-between pt-1">
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {task._count && task._count.comments > 0 && (
            <span className="inline-flex items-center gap-1">
              <MessageSquare className="size-3.5" />
              {task._count.comments}
            </span>
          )}
          {task._count && task._count.attachments > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="size-3.5" />
              {task._count.attachments}
            </span>
          )}
          {task.dueDate && (
            <span className="text-xs">
              {format(new Date(task.dueDate), "MMM d")}
            </span>
          )}
        </div>
        {task.assignee && (
          <Avatar className="size-6">
            <AvatarFallback className="text-[10px]">
              {task.assignee.username.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    </button>
  );
}
