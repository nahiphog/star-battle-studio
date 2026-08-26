import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { LogIn } from "lucide-react";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Star Battle Studio" },
      {
        name: "description",
        content:
          "Sign in with Google to create, edit and publish Star Battle puzzles and their solution walkthroughs.",
      },
      { property: "og:title", content: "Sign in — Star Battle Studio" },
      {
        property: "og:description",
        content: "Owner sign-in for editing Star Battle puzzles and walkthroughs.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const { session, email, isEditor } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEditor) void navigate({ to: "/" });
  }, [isEditor, navigate]);

  const signIn = async () => {
    setBusy(true);
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
      extraParams: { prompt: "select_account" },
    });
    if (result.error) {
      setError("Google sign-in failed. Please try again.");
      setBusy(false);
      return;
    }
    if (result.redirected) return;
    void navigate({ to: "/" });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-6">
        <h1 className="text-xl font-bold text-foreground">Sign in</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Editing puzzles and walkthroughs is restricted to the site owner. Everyone else can browse
          and solve freely.
        </p>


        <button
          type="button"
          onClick={signIn}
          disabled={busy}
          className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          <LogIn className="h-4 w-4" /> Continue with Google
        </button>

        {error && <p className="mt-3 text-xs text-arrow">{error}</p>}

        {session && !isEditor && (
          <p className="mt-4 rounded-lg border border-border bg-background/40 p-3 text-xs text-muted-foreground">
            You are signed in, but this account cannot save changes.
          </p>
        )}

        <Link to="/" className="mt-5 block text-center text-xs text-muted-foreground hover:text-foreground">
          Back to puzzles
        </Link>
      </div>
    </main>
  );
}
