import { useEffect, useRef, useState } from "react";
import { Settings } from "lucide-react";
import type { Board } from "@/lib/types";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Button } from "./ui/button";
import { ManageMembersDialog } from "./manage-members-dialog";
import { cn } from "@/lib/utils";

const MAX_VISIBLE = 4;

export function TeamMembers({ board }: { board: Board }) {
  const [open, setOpen] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const visible = board.members.slice(0, MAX_VISIBLE);
  const overflow = board.members.length - MAX_VISIBLE;

  return (
    <>
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center rounded-full p-0.5 transition-colors hover:bg-muted"
          aria-label={`${board.members.length} team members`}
        >
          <div className="flex -space-x-2">
            {visible.map((m) => (
              <Avatar
                key={m.user.id}
                className="size-8 border-2 border-background"
                title={m.user.username}
              >
                <AvatarFallback className="text-[10px]">
                  {m.user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
            ))}
            {overflow > 0 && (
              <div className="flex size-8 items-center justify-center rounded-full border-2 border-background bg-muted text-[11px] font-medium">
                +{overflow}
              </div>
            )}
          </div>
        </button>

        {open && (
          <div className="absolute right-0 top-full z-30 mt-2 w-64 max-w-[calc(100vw-2rem)] rounded-xl border bg-popover p-3 shadow-lg">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">
                Team members{" "}
                <span className="text-xs font-normal text-muted-foreground">
                  ({board.members.length})
                </span>
              </h3>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2"
                onClick={() => {
                  setOpen(false);
                  setManageOpen(true);
                }}
              >
                <Settings className="size-3.5" /> Manage
              </Button>
            </div>
            <ul className="flex max-h-80 flex-col gap-2 overflow-y-auto">
              {board.members.map((m) => (
                <li
                  key={m.user.id}
                  className={cn(
                    "flex items-center gap-2 rounded-md p-1.5 text-sm hover:bg-accent",
                  )}
                >
                  <Avatar className="size-7">
                    <AvatarFallback className="text-[10px]">
                      {m.user.username.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col leading-tight">
                    <span className="font-medium">{m.user.username}</span>
                    <span className="text-[11px] text-muted-foreground">
                      {m.user.id === board.creator.id
                        ? "Creator"
                        : m.user.email}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <ManageMembersDialog
        board={board}
        open={manageOpen}
        onOpenChange={setManageOpen}
      />
    </>
  );
}
