import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { z } from "zod";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout, GoogleButton } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Log in — Play With Friends" },
      {
        name: "description",
        content: "Log in to Play With Friends to keep your rating, friends and match history.",
      },
      { property: "og:title", content: "Log in — Play With Friends" },
      {
        property: "og:description",
        content: "Sign in with email or Google and get back to the games.",
      },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => {
    const next = typeof search["next"] === "string" ? search["next"] : "";
    // Only same-origin relative paths may be used as a post-login redirect.
    const safe = next.startsWith("/") && !next.startsWith("//") ? next : undefined;
    return safe ? { next: safe } : {};
  },
  component: LoginPage,
});

const schema = z.object({
  email: z.string().trim().email("Enter a valid email").max(255),
  password: z.string().min(6, "Password must be at least 6 characters").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch() as { next?: string };
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    if (next && profile?.username) {
      window.location.href = next;
      return;
    }
    void navigate({ to: profile?.username ? "/" : "/username" });
  }, [user, profile, loading, navigate, next]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!remember) localStorage.setItem("pwf-remember", "false");
    toast.success("Welcome back!");
  };

  const forgot = async () => {
    const parsed = z.string().email().safeParse(email.trim());
    if (!parsed.success) {
      toast.error("Enter your email first, then tap Forgot password.");
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent — check your inbox.");
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: next ? `${window.location.origin}${next}` : window.location.origin,
      },
    });
    if (error) toast.error("Google sign-in failed. Please try again.");
  };

  return (
    <AuthLayout title="Welcome back" subtitle="Log in and get back to the leaderboard.">
      <motion.form
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        onSubmit={submit}
        className="space-y-4"
      >
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            className="rounded-xl"
            autoComplete="email"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            className="rounded-xl"
            autoComplete="current-password"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} /> Remember me
          </label>
          <button type="button" onClick={forgot} className="text-sm text-primary hover:underline">
            Forgot password?
          </button>
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? "Signing in…" : "Log in"}
        </Button>
      </motion.form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton onClick={google} label="Continue with Google" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        New here?{" "}
        <Link to="/register" className="text-primary hover:underline">
          Create an account
        </Link>
      </p>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        or{" "}
        <Link to="/" className="text-primary hover:underline">
          play instantly as guest
        </Link>
      </p>
    </AuthLayout>
  );
}
