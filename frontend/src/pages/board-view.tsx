import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Pencil, Plus, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { Task } from "@/lib/types";
import {
  useBoard,
  useBoardMembers,
  useDeleteBoard,
  useUpdateBoard,
  useUpdateTask,
} from "@/lib/queries";
import { useAuth } from "@/lib/auth-context";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { EditBoardDialog } from "@/components/edit-board-dialog";
import { BoardFiltersBar } from "@/components/board-filters";
import { defaultFilters, type BoardFilters } from "@/lib/board-filters";
import { errorMessage } from "@/lib/errors";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskCard } from "@/components/task-card";
import { DraggableTaskCard } from "@/components/draggable-task-card";
import { DroppableColumn } from "@/components/droppable-column";
import { TaskDetailDialog } from "@/components/task-detail-dialog";
import { TeamMembers } from "@/components/team-members";
import { CreateTaskDialog } from "@/components/create-task-dialog";

function formatColumnTitle(status: string): string {
  return status
    .split(/[-_\s]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function BoardViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: board, isLoading, error } = useBoard(id);
  const { data: members } = useBoardMembers(id);
  const updateBoard = useUpdateBoard();
  const updateTask = useUpdateTask();
  const deleteBoard = useDeleteBoard();

  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [activeTask, setActiveTask] = useState<Task | null>(null);
  const [addingColumn, setAddingColumn] = useState(false);
  const [newColumnName, setNewColumnName] = useState("");
  const [filters, setFilters] = useState<BoardFilters>(defaultFilters);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const rawTasks = useMemo(() => board?.tasks ?? [], [board?.tasks]);

  const filteredTasks = useMemo(() => {
    let list = rawTasks;
    if (filters.assignedToId) {
      list = list.filter((t) => t.assignee?.id === filters.assignedToId);
    }
    if (filters.priority !== null) {
      list = list.filter((t) => t.priority === filters.priority);
    }
    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      list = list.filter(
        (t) =>
          t.title.toLowerCase().includes(q) ||
          (t.description?.toLowerCase().includes(q) ?? false),
      );
    }
    const sorted = [...list];
    switch (filters.sort) {
      case "priority":
        sorted.sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99));
        break;
      case "dueDate":
        sorted.sort((a, b) => {
          if (!a.dueDate && !b.dueDate) return 0;
          if (!a.dueDate) return 1;
          if (!b.dueDate) return -1;
          return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        });
        break;
      case "title":
        sorted.sort((a, b) => a.title.localeCompare(b.title));
        break;
    }
    return sorted;
  }, [rawTasks, filters]);

  const tasks = filteredTasks;
  const selectedTask = rawTasks.find((t) => t.id === selectedTaskId) ?? null;

  if (isLoading) {
    return (
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-sm text-muted-foreground">Loading board...</p>
      </div>
    );
  }

  if (error || !board) {
    return (
      <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
        <p className="text-muted-foreground">Board not found.</p>
        <Button asChild variant="link" className="p-0">
          <Link to="/">Back to dashboard</Link>
        </Button>
      </div>
    );
  }

  const handleAddColumn = async () => {
    const name = newColumnName.trim().toLowerCase().replace(/\s+/g, "-");
    if (!name) {
      toast.error("Column name is required");
      return;
    }
    if (board.columns.includes(name)) {
      toast.error("A column with that name already exists");
      return;
    }
    try {
      await updateBoard.mutateAsync({
        id: board.id,
        columns: [...board.columns, name],
      });
      setNewColumnName("");
      setAddingColumn(false);
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add column"));
    }
  };

  const handleRemoveColumn = async (status: string) => {
    if (board.columns.length <= 1) {
      toast.error("A board must have at least one column");
      return;
    }
    if (rawTasks.some((t) => t.status === status)) {
      toast.error("Move or delete tasks in this column first");
      return;
    }
    try {
      await updateBoard.mutateAsync({
        id: board.id,
        columns: board.columns.filter((c) => c !== status),
      });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove column"));
    }
  };

  const handleDragStart = (event: DragStartEvent) => {
    const task = rawTasks.find((t) => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveTask(null);
    const { active, over } = event;
    if (!over) return;

    const task = rawTasks.find((t) => t.id === active.id);
    const newStatus = String(over.id);
    if (!task || task.status === newStatus) return;

    try {
      await updateTask.mutateAsync({
        id: task.id,
        boardId: board.id,
        status: newStatus,
      });
    } catch (err) {
      toast.error(errorMessage(err, "Failed to move task"));
    }
  };

  const isOwner = user?.id === board.creator.id;

  const handleDeleteBoard = async () => {
    try {
      await deleteBoard.mutateAsync(board.id);
      toast.success("Board deleted");
      navigate("/");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to delete board"));
    }
  };

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
            <Link to="/">
              <ArrowLeft /> Boards
            </Link>
          </Button>
          <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">
            {board.name}
          </h1>
          {board.description && (
            <p className="line-clamp-2 text-sm text-muted-foreground">
              {board.description}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <TeamMembers board={board} />
          <CreateTaskDialog
            boardId={board.id}
            columns={board.columns}
            trigger={
              <Button className="shrink-0">
                <Plus />
                <span className="hidden sm:inline">New task</span>
              </Button>
            }
          />
          {isOwner && (
            <EditBoardDialog
              board={board}
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0"
                  aria-label="Edit board"
                >
                  <Pencil />
                </Button>
              }
            />
          )}
          {isOwner && (
            <ConfirmDialog
              title="Delete this board?"
              description="This permanently deletes the board along with all of its tasks, comments, and attachments. This cannot be undone."
              confirmLabel="Delete board"
              onConfirm={handleDeleteBoard}
              trigger={
                <Button
                  variant="outline"
                  size="icon"
                  className="shrink-0 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                  aria-label="Delete board"
                >
                  <Trash2 />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <BoardFiltersBar
        filters={filters}
        onChange={setFilters}
        members={members ?? []}
      />

      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-2">
          {board.columns.map((status) => {
            const columnTasks = tasks.filter((t) => t.status === status);
            return (
              <div
                key={status}
                className="flex w-64 shrink-0 flex-col rounded-xl bg-muted/40 p-3"
              >
                <div className="mb-3 flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold">
                      {formatColumnTitle(status)}
                    </h2>
                    <span className="text-xs text-muted-foreground">
                      {columnTasks.length}
                    </span>
                  </div>
                  <button
                    onClick={() => handleRemoveColumn(status)}
                    className="rounded p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={`Remove ${status} column`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
                <DroppableColumn status={status} className="min-h-24">
                  {columnTasks.map((task) => (
                    <DraggableTaskCard
                      key={task.id}
                      task={task}
                      onClick={() => setSelectedTaskId(task.id)}
                    />
                  ))}
                  {columnTasks.length === 0 && (
                    <div className="rounded-md border border-dashed p-4 text-center text-xs text-muted-foreground">
                      No tasks
                    </div>
                  )}
                </DroppableColumn>
              </div>
            );
          })}

          <div className="w-64 shrink-0">
            {addingColumn ? (
              <div className="flex flex-col gap-2 rounded-xl bg-muted/40 p-3">
                <Input
                  autoFocus
                  placeholder="Column name"
                  value={newColumnName}
                  onChange={(e) => setNewColumnName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") void handleAddColumn();
                    if (e.key === "Escape") {
                      setAddingColumn(false);
                      setNewColumnName("");
                    }
                  }}
                />
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => void handleAddColumn()}>
                    Add
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAddingColumn(false);
                      setNewColumnName("");
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed p-4 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
              >
                <Plus className="size-4" /> Add column
              </button>
            )}
          </div>
        </div>

        <DragOverlay>
          {activeTask && <TaskCard task={activeTask} onClick={() => {}} />}
        </DragOverlay>
      </DndContext>

      <TaskDetailDialog
        task={selectedTask}
        boardId={board.id}
        columns={board.columns}
        open={selectedTaskId !== null}
        onOpenChange={(open) => !open && setSelectedTaskId(null)}
      />
    </div>
  );
}
