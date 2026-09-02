import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { CheckCircle2, MailCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout, GoogleButton } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Create your account — Play With Friends" },
      {
        name: "description",
        content: "Sign up free to save your rating, unlock the global leaderboard and add friends.",
      },
      { property: "og:title", content: "Create your account — Play With Friends" },
      {
        property: "og:description",
        content: "Free account: ratings, friends, achievements and cloud progress.",
      },
    ],
  }),
  component: RegisterPage,
});

const schema = z
  .object({
    email: z.string().trim().email("Enter a valid email").max(255),
    password: z.string().min(6, "Password must be at least 6 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, {
    message: "Passwords do not match",
    path: ["confirm"],
  });

function RegisterPage() {
  const navigate = useNavigate();
  const { user, profile, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (loading || !user) return;
    void navigate({ to: profile?.username ? "/" : "/username" });
  }, [user, profile, loading, navigate]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({ email, password, confirm });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid details");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: { emailRedirectTo: `${window.location.origin}/username` },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (!data.session) {
      setSent(true);
      return;
    }
    void navigate({ to: "/username" });
  };

  const google = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/username` },
    });
    if (error) toast.error("Google sign-up failed. Please try again.");
  };

  if (sent) {
    return (
      <AuthLayout title="Verify your email" subtitle="One step left before you pick a username.">
        <div className="rounded-2xl bg-secondary/50 p-5 text-center">
          <MailCheck className="mx-auto size-10 text-primary" />
          <p className="mt-3 text-sm text-muted-foreground">
            We sent a confirmation link to <span className="text-foreground">{email}</span>. Open it
            to activate your account, then choose your username.
          </p>
        </div>
        <Button asChild variant="outline" className="mt-5 w-full">
          <Link to="/login">Back to login</Link>
        </Button>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free forever. Ratings, friends, achievements."
    >
      <div className="mb-6 flex items-center gap-2 text-xs text-muted-foreground">
        <Step active label="Account" />
        <span className="h-px flex-1 bg-border" />
        <Step label="Verify" />
        <span className="h-px flex-1 bg-border" />
        <Step label="Username" />
      </div>

      <form onSubmit={submit} className="space-y-4">
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
            placeholder="At least 6 characters"
            className="rounded-xl"
            autoComplete="new-password"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="Repeat password"
            className="rounded-xl"
            autoComplete="new-password"
          />
        </div>
        <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
          {busy ? "Creating account…" : "Create account"}
        </Button>
      </form>

      <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" /> OR <span className="h-px flex-1 bg-border" />
      </div>
      <GoogleButton onClick={google} label="Sign up with Google" />

      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="text-primary hover:underline">
          Log in
        </Link>
      </p>
    </AuthLayout>
  );
}

function Step({ label, active }: { label: string; active?: boolean }) {
  return (
    <span className={`flex items-center gap-1.5 ${active ? "text-primary" : ""}`}>
      <CheckCircle2 className="size-3.5" /> {label}
    </span>
  );
}
