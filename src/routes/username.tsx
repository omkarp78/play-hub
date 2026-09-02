import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { toast } from "sonner";
import { Check, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AuthLayout } from "@/components/auth/AuthLayout";

export const Route = createFileRoute("/username")({
  head: () => ({
    meta: [
      { title: "Choose your username — Play With Friends" },
      {
        name: "description",
        content: "Pick the permanent handle other players will see on leaderboards.",
      },
      { property: "og:title", content: "Choose your username — Play With Friends" },
      {
        property: "og:description",
        content: "Your handle for leaderboards, friends and challenges.",
      },
    ],
  }),
  component: UsernamePage,
});

const usernameSchema = z
  .string()
  .min(3, "At least 3 characters")
  .max(16, "At most 16 characters")
  .regex(/^[a-z0-9_]+$/, "Lowercase letters, numbers and underscore only");

function UsernamePage() {
  const navigate = useNavigate();
  const { user, profile, loading, refreshProfile } = useAuth();
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<"idle" | "checking" | "free" | "taken" | "invalid">("idle");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!user) void navigate({ to: "/login" });
    else if (profile?.username) void navigate({ to: "/" });
  }, [user, profile, loading, navigate]);

  useEffect(() => {
    if (!value) return setStatus("idle");
    const parsed = usernameSchema.safeParse(value);
    if (!parsed.success) return setStatus("invalid");
    setStatus("checking");
    const timer = setTimeout(async () => {
      const { data, error } = await supabase.rpc("username_available", { _username: value });
      if (error) return setStatus("idle");
      setStatus(data ? "free" : "taken");
    }, 400);
    return () => clearTimeout(timer);
  }, [value]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = usernameSchema.safeParse(value);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid username");
      return;
    }
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({ username: parsed.data, display_name: parsed.data })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message.includes("duplicate") ? "That username is taken" : error.message);
      return;
    }
    await refreshProfile();
    toast.success(`Welcome, ${parsed.data}!`);
    void navigate({ to: "/" });
  };

  return (
    <AuthLayout
      title="Choose your username"
      subtitle="This is permanent — it can't be changed later."
    >
      <form onSubmit={submit} className="space-y-4">
        <div className="relative">
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value.toLowerCase().replace(/\s/g, ""))}
            placeholder="player_one"
            maxLength={16}
            className="rounded-xl pr-10 lowercase"
            autoFocus
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2">
            {status === "checking" && (
              <Loader2 className="size-4 animate-spin text-muted-foreground" />
            )}
            {status === "free" && <Check className="size-4 text-success" />}
            {(status === "taken" || status === "invalid") && (
              <X className="size-4 text-destructive" />
            )}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">
          Lowercase letters, numbers and underscores. Examples: <code>omkar</code>,{" "}
          <code>omkar7</code>, <code>player_one</code>
        </p>
        {status === "taken" && <p className="text-xs text-destructive">That username is taken.</p>}
        <Button
          type="submit"
          variant="hero"
          size="lg"
          className="w-full"
          disabled={busy || status !== "free"}
        >
          {busy ? "Saving…" : "Claim username"}
        </Button>
      </form>
    </AuthLayout>
  );
}
