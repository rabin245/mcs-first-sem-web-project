import { Outlet } from "react-router-dom";
import { AppHeader } from "./app-header";

export function AppLayout() {
  return (
    <div className="min-h-screen bg-muted/20">
      <AppHeader />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
