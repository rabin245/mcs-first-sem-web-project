import { Link } from "react-router-dom";
import { Plus, Users2, ListTodo } from "lucide-react";
import { useBoards } from "@/lib/queries";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CreateBoardDialog } from "@/components/create-board-dialog";

export function DashboardPage() {
  const { data: boards, isLoading, error } = useBoards();

  return (
    <div className="mx-auto max-w-[1800px] px-4 py-6 sm:px-6 sm:py-8">
      <div className="mb-6 flex items-start justify-between gap-4 sm:mb-8 sm:items-center">
        <div className="min-w-0">
          <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">
            Boards
          </h1>
          <p className="text-sm text-muted-foreground">
            Your projects and the work they hold.
          </p>
        </div>
        <CreateBoardDialog
          trigger={
            <Button className="shrink-0">
              <Plus />
              <span className="hidden sm:inline">New board</span>
            </Button>
          }
        />
      </div>

      {isLoading && (
        <p className="text-sm text-muted-foreground">Loading boards...</p>
      )}
      {error && (
        <p className="text-sm text-destructive">
          Failed to load boards. Try refreshing.
        </p>
      )}

      {boards && boards.length === 0 && (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <p className="text-sm text-muted-foreground">
            No boards yet. Create your first one to get started.
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards?.map((board) => (
          <Link key={board.id} to={`/boards/${board.id}`}>
            <Card className="h-full transition-shadow hover:shadow-md">
              <CardHeader>
                <CardTitle>{board.name}</CardTitle>
                <CardDescription className="line-clamp-2">
                  {board.description || "No description"}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex items-center gap-4 text-sm text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <ListTodo className="size-4" />
                  {board._count?.tasks ?? 0} tasks
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Users2 className="size-4" />
                  {board.members.length} members
                </span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
