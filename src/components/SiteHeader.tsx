import { Link } from "@tanstack/react-router";
import { CalendarDays, LogIn, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

export function SiteHeader() {
  const { email, isEditor, signOut } = useAuth();

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <Link to="/" className="flex items-center gap-2 text-sm font-semibold text-foreground">
        <CalendarDays className="h-4 w-4 text-primary" /> Star Battle Studio
      </Link>
      <div className="flex items-center gap-2 text-xs">
        {email ? (
          <>
            <span className="text-muted-foreground">
              {isEditor ? "Owner" : "View only"}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-secondary px-2.5 py-1.5 font-medium text-secondary-foreground hover:bg-accent"
            >
              <LogOut className="h-3.5 w-3.5" /> Sign out
            </button>
          </>
        ) : (
          <Link
            to="/auth"
            className="inline-flex items-center gap-1.5 rounded-lg border border-input bg-secondary px-2.5 py-1.5 font-medium text-secondary-foreground hover:bg-accent"
          >
            <LogIn className="h-3.5 w-3.5" /> Sign in
          </Link>
        )}
      </div>
    </div>
  );
}
