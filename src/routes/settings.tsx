import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { useTheme, type ThemeMode } from "@/hooks/useTheme";
import { ChangeUsernameDialog } from "@/components/ChangeUsername";
import { InstallAppButton } from "@/components/InstallAppButton";

const THEMES: { id: ThemeMode; label: string; emoji: string }[] = [
  { id: "light", label: "Light", emoji: "☀️" },
  { id: "dark", label: "Dark", emoji: "🌙" },
  { id: "system", label: "System", emoji: "📱" },
];

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Play With Friends" },
      {
        name: "description",
        content: "Manage your display name, country, sound effects and account.",
      },
      { property: "og:title", content: "Settings — Play With Friends" },
      { property: "og:description", content: "Tune your profile and game preferences." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  const { user, profile, refreshProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const { mode, resolved, setMode } = useTheme();
  const guestName = useGuestStore((s) => s.guestName);
  const clearGuest = useGuestStore((s) => s.clearGuest);
  const [displayName, setDisplayName] = useState("");
  const [country, setCountry] = useState("");
  const [sound, setSound] = useState(true);
  const [busy, setBusy] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);

  useEffect(() => {
    setDisplayName(profile?.display_name ?? "");
    setCountry(profile?.country ?? "WW");
  }, [profile]);

  useEffect(() => {
    setSound(localStorage.getItem("pwf-sound") !== "off");
  }, []);

  const save = async () => {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim().slice(0, 40),
        country: country.trim().toUpperCase().slice(0, 3) || "WW",
      })
      .eq("id", user.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    await refreshProfile();
    toast.success("Settings saved");
  };

  return (
    <AppShell>
      <PageHeader title="Settings" back="/profile/me" />

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl soft-card p-6">
          <h2 className="font-display text-lg font-bold">Profile</h2>
          {user ? (
            <div className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label>Username</Label>
                <div className="flex gap-2">
                  <Input
                    value={profile?.username ?? ""}
                    disabled
                    className="h-12 flex-1 rounded-2xl"
                  />
                  <Button variant="outline" className="h-12" onClick={() => setRenameOpen(true)}>
                    Change
                  </Button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dn">Display name</Label>
                <Input
                  id="dn"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="h-12 rounded-2xl"
                  maxLength={40}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="country">Country code</Label>
                <Input
                  id="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  placeholder="IN"
                  maxLength={3}
                  className="h-12 rounded-2xl uppercase"
                />
              </div>
              <Button variant="hero" onClick={save} disabled={busy}>
                {busy ? "Saving…" : "Save changes"}
              </Button>
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="text-sm text-muted-foreground">
                You're playing as{" "}
                <Badge variant="secondary">{guestName ?? "no guest session"}</Badge>. Create an
                account to sync progress across devices.
              </div>

              <div className="flex gap-2">
                <Button asChild variant="hero">
                  <Link to="/register">Create account</Link>
                </Button>
                <Button variant="outline" onClick={() => setRenameOpen(true)}>
                  Change name
                </Button>
                {guestName && (
                  <Button
                    variant="outline"
                    onClick={() => {
                      clearGuest();
                      toast.success("Guest session cleared");
                    }}
                  >
                    Reset guest session
                  </Button>
                )}
              </div>
            </div>
          )}
        </section>

        <section className="rounded-3xl soft-card p-6">
          <h2 className="font-display text-lg font-bold">Preferences</h2>
          <div className="mt-4 flex items-center justify-between rounded-2xl bg-secondary/40 px-4 py-3">
            <div>
              <p className="font-medium">Sound effects</p>
              <p className="text-xs text-muted-foreground">Move, win and notification sounds.</p>
            </div>
            <Switch
              checked={sound}
              onCheckedChange={(v) => {
                setSound(v);
                localStorage.setItem("pwf-sound", v ? "on" : "off");
              }}
            />
          </div>
          <div className="mt-3 rounded-2xl bg-secondary/40 px-4 py-3">
            <p className="font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              {mode === "system" ? `Following your device (${resolved})` : `Always ${mode}`}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-2">
              {THEMES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setMode(t.id)}
                  aria-pressed={mode === t.id}
                  className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border-2 text-xs font-semibold transition-transform active:scale-95 ${
                    mode === t.id
                      ? "border-primary bg-primary/15 text-primary"
                      : "border-transparent bg-card text-foreground"
                  }`}
                >
                  <span className="text-lg">{t.emoji}</span>
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          <InstallAppButton className="mt-3 w-full" />

          {user && (
            <Button
              variant="outline"
              className="mt-6 w-full"
              onClick={async () => {
                await signOut();
                void navigate({ to: "/" });
              }}
            >
              Sign out
            </Button>
          )}
        </section>
      </div>

      <ChangeUsernameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        mode={user ? "user" : "guest"}
        current={(user ? profile?.username : guestName) ?? ""}
      />
    </AppShell>
  );
}
