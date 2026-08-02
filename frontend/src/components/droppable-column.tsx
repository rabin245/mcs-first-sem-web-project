import { useDroppable } from "@dnd-kit/core";
import { cn } from "@/lib/utils";

export function DroppableColumn({
  status,
  children,
  className,
}: {
  status: string;
  children: React.ReactNode;
  className?: string;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: status });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex flex-col gap-2 rounded-md p-1 transition-colors",
        isOver && "bg-primary/10",
        className,
      )}
    >
      {children}
    </div>
  );
}
