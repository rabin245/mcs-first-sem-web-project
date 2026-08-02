import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Textarea } from "./ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { useUpdateBoard } from "@/lib/queries";
import { errorMessage } from "@/lib/errors";
import type { Board } from "@/lib/types";

const schema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  description: z.string().max(500).optional(),
});

type FormValues = z.infer<typeof schema>;

export function EditBoardDialog({
  board,
  trigger,
}: {
  board: Board;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const update = useUpdateBoard();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: board.name,
      description: board.description ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      reset({ name: board.name, description: board.description ?? "" });
    }
  }, [open, board.name, board.description, reset]);

  const onSubmit = async (values: FormValues) => {
    try {
      await update.mutateAsync({
        id: board.id,
        name: values.name,
        description: values.description?.trim()
          ? values.description.trim()
          : null,
      });
      toast.success("Board updated");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error, "Failed to update board"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit board</DialogTitle>
          <DialogDescription>
            Update the board name and description.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-board-name">Name</Label>
            <Input id="edit-board-name" autoFocus {...register("name")} />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="edit-board-description">Description</Label>
            <Textarea
              id="edit-board-description"
              rows={3}
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">
                {errors.description.message}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={update.isPending}>
              {update.isPending ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
