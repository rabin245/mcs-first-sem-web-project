import { useState } from "react";
import { format } from "date-fns";
import { Flag, Calendar, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
} from "./ui/dialog";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Textarea } from "./ui/textarea";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";

const NONE = "__none__";

interface AssigneeOption {
  value: string;
  label: string;
  hint?: string;
}
import { TaskComments } from "./task-comments";
import { TaskAttachments } from "./task-attachments";
import { ConfirmDialog } from "./confirm-dialog";
import { useBoardMembers, useDeleteTask, useUpdateTask } from "@/lib/queries";
import { errorMessage } from "@/lib/errors";

interface Props {
  task: Task | null;
  boardId: string;
  columns: string[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({
  task,
  boardId,
  columns,
  open,
  onOpenChange,
}: Props) {
  const { data: members } = useBoardMembers(boardId);
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const [title, setTitle] = useState(task?.title ?? "");
  const [description, setDescription] = useState(task?.description ?? "");
  const [status, setStatus] = useState(task?.status ?? columns[0]);
  const [assignedToId, setAssignedToId] = useState(task?.assignee?.id ?? "");
  const [dueDate, setDueDate] = useState(
    task?.dueDate ? task.dueDate.slice(0, 10) : "",
  );
  const [priority, setPriority] = useState<string>(
    task?.priority != null ? String(task.priority) : "",
  );

  const [syncedTaskId, setSyncedTaskId] = useState(task?.id);
  if (task && task.id !== syncedTaskId) {
    setSyncedTaskId(task.id);
    setTitle(task.title);
    setDescription(task.description ?? "");
    setStatus(task.status);
    setAssignedToId(task.assignee?.id ?? "");
    setDueDate(task.dueDate ? task.dueDate.slice(0, 10) : "");
    setPriority(task.priority != null ? String(task.priority) : "");
  }

  if (!task) return null;

  const assigneeItems: AssigneeOption[] = (members ?? []).map((m) => ({
    value: m.id,
    label: m.username,
    hint: m.email,
  }));
  const selectedAssignee =
    assigneeItems.find((o) => o.value === assignedToId) ?? null;

  const patch = async (patchBody: Parameters<typeof update.mutateAsync>[0]) => {
    try {
      await update.mutateAsync(patchBody);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to update task"));
    }
  };

  const del = async () => {
    try {
      await remove.mutateAsync({ id: task.id, boardId });
      toast.success("Task deleted");
      onOpenChange(false);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete task"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              if (title.trim() && title !== task.title) {
                void patch({ id: task.id, boardId, title: title.trim() });
              } else if (!title.trim()) {
                setTitle(task.title);
              }
            }}
            className="border-none px-0 text-lg font-semibold shadow-none focus-visible:ring-0"
          />
          <DialogDescription className="sr-only">
            Task details
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Column</Label>
            <Select
              value={status}
              onValueChange={(val) => {
                setStatus(val);
                void patch({ id: task.id, boardId, status: val });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {columns.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">Assignee</Label>
            <Combobox<AssigneeOption>
              items={assigneeItems}
              value={selectedAssignee}
              isItemEqualToValue={(a, b) => a.value === b.value}
              onValueChange={(val) => {
                setAssignedToId(val?.value ?? "");
                void patch({
                  id: task.id,
                  boardId,
                  assignedToId: val?.value ?? null,
                });
              }}
            >
              <ComboboxInput
                showClear={!!selectedAssignee}
                placeholder="Unassigned"
                className="h-9 rounded-md bg-transparent dark:bg-transparent"
              />
              <ComboboxContent>
                <ComboboxEmpty>No members</ComboboxEmpty>
                <ComboboxList>
                  {(item: AssigneeOption) => (
                    <ComboboxItem key={item.value} value={item}>
                      <div className="flex min-w-0 flex-col leading-tight">
                        <span className="truncate">{item.label}</span>
                        {item.hint && (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.hint}
                          </span>
                        )}
                      </div>
                    </ComboboxItem>
                  )}
                </ComboboxList>
              </ComboboxContent>
            </Combobox>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              <Calendar className="mr-1 inline size-3" /> Due date
            </Label>
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => {
                setDueDate(e.target.value);
                void patch({
                  id: task.id,
                  boardId,
                  dueDate: e.target.value
                    ? new Date(e.target.value).toISOString()
                    : null,
                });
              }}
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label className="text-xs text-muted-foreground">
              <Flag className="mr-1 inline size-3" /> Priority
            </Label>
            <Select
              value={priority || NONE}
              onValueChange={(val) => {
                const real = val === NONE ? "" : val;
                setPriority(real);
                void patch({
                  id: task.id,
                  boardId,
                  priority: real ? Number(real) : null,
                });
              }}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NONE}>None</SelectItem>
                <SelectItem value="1">1 - Highest</SelectItem>
                <SelectItem value="2">2 - High</SelectItem>
                <SelectItem value="3">3 - Medium</SelectItem>
                <SelectItem value="4">4 - Low</SelectItem>
                <SelectItem value="5">5 - Lowest</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div>
          <Label className="mb-2 block text-sm font-medium">Description</Label>
          <Textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={() => {
              if (description !== (task.description ?? "")) {
                void patch({
                  id: task.id,
                  boardId,
                  description: description.trim() || null,
                });
              }
            }}
            placeholder="Add a description..."
          />
        </div>

        <section>
          <h3 className="mb-2 text-sm font-medium">Attachments</h3>
          <TaskAttachments taskId={task.id} boardId={boardId} />
        </section>

        <section>
          <h3 className="mb-2 text-sm font-medium">Comments</h3>
          <TaskComments taskId={task.id} boardId={boardId} />
        </section>

        <div className="flex justify-between border-t pt-4">
          <ConfirmDialog
            title="Delete this task?"
            description="This will permanently delete the task along with its comments and attachments."
            confirmLabel="Delete task"
            onConfirm={del}
            trigger={
              <Button variant="destructive" size="sm">
                <Trash2 /> Delete task
              </Button>
            }
          />
          {task.dueDate && (
            <p className="text-xs text-muted-foreground self-center">
              Due {format(new Date(task.dueDate), "MMM d, yyyy")}
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
