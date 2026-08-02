import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { Avatar, AvatarFallback } from "./ui/avatar";
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "./ui/combobox";
import { ConfirmDialog } from "./confirm-dialog";
import {
  useAddBoardMember,
  useRemoveBoardMember,
  useUserSearch,
} from "@/lib/queries";
import type { Board } from "@/lib/types";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/lib/auth-context";
import { useDebouncedValue } from "@/lib/utils";

interface UserOption {
  value: string;
  label: string;
  hint?: string;
}

export function ManageMembersDialog({
  board,
  trigger,
  open: controlledOpen,
  onOpenChange,
}: {
  board: Board;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false);
  const open = controlledOpen ?? uncontrolledOpen;
  const setOpen = onOpenChange ?? setUncontrolledOpen;
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const { user: me } = useAuth();
  const { data: results, isFetching } = useUserSearch(debouncedSearch, open);
  const add = useAddBoardMember(board.id);
  const remove = useRemoveBoardMember(board.id);

  const isOwner = me?.id === board.creator.id;

  const options = useMemo<UserOption[]>(() => {
    const memberIds = new Set(board.members.map((m) => m.user.id));
    return (results ?? [])
      .filter((u) => !memberIds.has(u.id))
      .map((u) => ({ value: u.id, label: u.username, hint: u.email }));
  }, [results, board.members]);

  const handleAdd = async (option: UserOption | null) => {
    if (!option) return;
    try {
      await add.mutateAsync({ userId: option.value });
      toast.success("Member added");
      setSearch("");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to add member"));
    }
  };

  const handleRemove = async (userId: string) => {
    try {
      await remove.mutateAsync(userId);
      toast.success("Member removed");
    } catch (err) {
      toast.error(errorMessage(err, "Failed to remove member"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Manage members</DialogTitle>
          <DialogDescription>
            Search users to add them to this board.
          </DialogDescription>
        </DialogHeader>

        <Combobox<UserOption>
          items={options}
          value={null}
          inputValue={search}
          filter={null}
          isItemEqualToValue={(a, b) => a.value === b.value}
          onValueChange={(opt) => void handleAdd(opt)}
          onInputValueChange={setSearch}
        >
          <ComboboxInput
            placeholder={add.isPending ? "Adding..." : "Search users to add..."}
            disabled={add.isPending}
            className="h-9 rounded-md bg-transparent dark:bg-transparent"
          />
          <ComboboxContent>
            <ComboboxEmpty>
              {isFetching
                ? "Searching..."
                : debouncedSearch.trim()
                  ? "No users match"
                  : "No users available"}
            </ComboboxEmpty>
            <ComboboxList>
              {(item: UserOption) => (
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

        <div>
          <h3 className="mb-2 text-sm font-medium">
            Members ({board.members.length})
          </h3>
          <ul className="flex max-h-72 flex-col gap-1 overflow-y-auto">
            {board.members.map((m) => {
              const isCreator = m.user.id === board.creator.id;
              return (
                <li
                  key={m.user.id}
                  className="flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent"
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {m.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex min-w-0 flex-1 flex-col leading-tight">
                    <span className="truncate font-medium">
                      {m.user.username}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {isCreator ? "Creator" : m.user.email}
                    </span>
                  </div>
                  {isOwner && !isCreator && (
                    <ConfirmDialog
                      title={`Remove ${m.user.username}?`}
                      description="Their tasks will remain on the board but they will lose access."
                      confirmLabel="Remove"
                      onConfirm={() => handleRemove(m.user.id)}
                      trigger={
                        <button
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                          aria-label={`Remove ${m.user.username}`}
                        >
                          <X className="size-3.5" />
                        </button>
                      }
                    />
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
