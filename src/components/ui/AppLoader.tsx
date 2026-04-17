import { Loader2 } from "lucide-react";

/**
 * Single, unified full-screen loader used across Hub, business app, portal,
 * auth, lazy boundaries and protected routes. Same size, color and position
 * everywhere so navigation feels like one continuous spinner.
 */
export const AppLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--hub-green)" }} />
  </div>
);

export default AppLoader;
