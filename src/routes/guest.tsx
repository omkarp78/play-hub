import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChangeUsernameDialog } from "@/components/ChangeUsername";
import { useAuth } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { CoinChip } from "@/components/rewards/CoinsSheet";

export const Route = createFileRoute("/guest")({
  head: () => ({
    meta: [
      { title: "Guest Profile | Play With Friends" },
      {
        name: "description",
        content:
          "Your guest profile on Play With Friends — change your display name and see your play record without an account.",
      },
      { property: "og:title", content: "Guest Profile — Play With Friends" },
      {
        property: "og:description",
        content: "Play as a guest, keep your name and scores, no account needed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GuestProfilePage,
});

function GuestProfilePage() {
  const { user, profile, loading } = useAuth();
  const navigate = useNavigate();
  const guestId = useGuestStore((s) => s.guestId);
  const guestName = useGuestStore((s) => s.guestName);
  const stats = useGuestStore((s) => s.stats);
  const createGuest = useGuestStore((s) => s.createGuest);
  const [renameOpen, setRenameOpen] = useState(false);

  // Signed-in players belong on their real profile.
  useEffect(() => {
    if (!loading && user && profile?.username) {
      void navigate({
        to: "/profile/$username",
        params: { username: profile.username },
        replace: true,
      });
    }
  }, [loading, user, profile?.username, navigate]);

  // Ensure a stable guest identity exists — never regenerate an existing one.
  useEffect(() => {
    if (!user && !guestId) createGuest();
  }, [user, guestId, createGuest]);

  const name = guestName ?? "guest";

  return (
    <AppShell>
      <PageHeader title="Profile" />

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-3xl soft-card p-6 sm:p-8"
      >
        <div className="flex flex-wrap items-center gap-5">
          <Avatar className="size-20 ring-2 ring-primary/50">
            <AvatarFallback className="bg-primary/20 text-xl">
              {name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <Badge variant="secondary">Guest</Badge>
            <h1 className="mt-1 font-display text-2xl font-bold sm:text-3xl">{name}</h1>
            <p className="truncate text-xs text-muted-foreground">{guestId}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Button size="sm" variant="outline" className="rounded-xl" onClick={() => setRenameOpen(true)}>
                Change Name
              </Button>
              <CoinChip />
            </div>
          </div>
        </div>
      </motion.section>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Played" value={stats.gamesPlayed} />
        <StatCard label="Wins" value={stats.wins} />
        <StatCard label="Losses" value={stats.losses} />
      </div>

      <div className="mt-6 rounded-3xl soft-card p-6 text-center">
        <p className="text-sm text-muted-foreground">
          Create an account to keep your scores, rating and friends across devices.
        </p>
        <Button asChild variant="hero" className="mt-4">
          <Link to="/register">Create account</Link>
        </Button>
      </div>

      <ChangeUsernameDialog
        open={renameOpen}
        onOpenChange={setRenameOpen}
        mode="guest"
        current={guestName ?? ""}
      />
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-2xl soft-card px-4 py-3 text-center">
      <p className="font-display text-2xl font-bold">{value}</p>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
    </div>
  );
}
