import { Link } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

export function AppHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-[1800px] items-center justify-between px-3 sm:px-6">
        <Link to="/" className="font-semibold tracking-tight">
          Task Manager
        </Link>
        {user && (
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarFallback>
                  {user.username.slice(0, 2).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <span className="hidden text-sm sm:inline">{user.username}</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={logout}
              aria-label="Log out"
            >
              <LogOut />
            </Button>
          </div>
        )}
      </div>
    </header>
  );
}
