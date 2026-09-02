import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Award, Gamepad2 } from "lucide-react";
import { AddFriendButton } from "@/components/AddFriendButton";
import { TopperChip } from "@/components/leaderboard/TopperBadge";
import { fetchTopperBadges, type TopperBadge } from "@/lib/toppers";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

import { useAuth, PROFILE_COLUMNS } from "@/hooks/useAuth";
import type { Profile } from "@/hooks/useAuth";
import { GAMES } from "@/lib/games";
import { ChangeUsernameDialog } from "@/components/ChangeUsername";
import { CoinChip } from "@/components/rewards/CoinsSheet";

export const Route = createFileRoute("/profile/$username")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.username} — Player Profile | Play With Friends` },
      {
        name: "description",
        content: `Rating, wins, achievements and match history for ${params.username} on Play With Friends.`,
      },
      { property: "og:title", content: `${params.username} — Player Profile` },
      {
        property: "og:description",
        content: `See ${params.username}'s rating, record and recent matches.`,
      },
    ],
  }),
  component: ProfilePage,
});

type ResultRow = {
  id: string;
  game_id: string;
  mode: string;
  result: string;
  opponent_name: string | null;
  rating_delta: number;
  points: number;
  created_at: string;
};

type CoinRow = {
  id: string;
  kind: string;
  amount: number;
  day: string;
  note: string | null;
  created_at: string;
};

type RewardsSummary = { coins: number; challenge_streak: number; reward_streak: number };


function ProfilePage() {
  const { username } = Route.useParams();
  const { user, profile: mine } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [renameOpen, setRenameOpen] = useState(false);
  const navigate = useNavigate();
  const [history, setHistory] = useState<ResultRow[]>([]);
  const [achievements, setAchievements] = useState<
    { id: string; name: string; description: string; unlocked: boolean }[]
  >([]);
  const [coins, setCoins] = useState<CoinRow[]>([]);
  const [rewards, setRewards] = useState<RewardsSummary | null>(null);
  const [topper, setTopper] = useState<TopperBadge | null>(null);


  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const lookup = username === "me" && mine?.username ? mine.username : username;
      const { data } = await supabase
        .from("profiles")
        .select(PROFILE_COLUMNS)
        .eq("username", lookup)
        .maybeSingle();
      if (cancelled) return;
      const p = data as Profile | null;
      setProfile(p);
      setLoading(false);
      if (!p) return;

      const [results, { data: all }, { data: unlocked }, coinRows, summary, badges] =
        await Promise.all([
          callRpc<ResultRow>("profile_recent_results", { p_user_id: p.id, p_limit: 20 }),
          supabase.from("achievements").select("id, name, description"),
          supabase.from("user_achievements").select("achievement_id").eq("user_id", p.id),
          callRpc<CoinRow>("public_coin_history", { p_user_id: p.id, p_limit: 30 }),
          callRpc<RewardsSummary>("public_rewards_summary", { p_user_id: p.id }),
          fetchTopperBadges([p.id]),
        ]);

      if (cancelled) return;
      setHistory(results);
      setCoins(coinRows);
      setRewards(summary[0] ?? null);
      setTopper(badges.get(p.id) ?? null);


      const unlockedIds = new Set((unlocked ?? []).map((u) => u.achievement_id));
      setAchievements((all ?? []).map((a) => ({ ...a, unlocked: unlockedIds.has(a.id) })));
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [username, mine]);

  if (loading) {
    return (
      <AppShell>
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="mt-6 grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      </AppShell>
    );
  }

  if (!profile) {
    return (
      <AppShell>
        <div className="mx-auto max-w-md rounded-3xl soft-card p-10 text-center">
          <h1 className="font-display text-2xl font-bold">Player not found</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            No player is using the handle “{username}”.
          </p>
          <Button asChild variant="hero" className="mt-5">
            <Link to="/leaderboard">Browse leaderboard</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const played = profile.wins + profile.losses + profile.draws;
  const winRate = played ? Math.round((profile.wins / played) * 100) : 0;
  const favorite = GAMES.find((g) => g.id === profile.favorite_game);

  return (
    <AppShell>
      <PageHeader
        title="Profile"
        back={user?.id === profile.id ? undefined : "/leaderboard"}
        action={
          user?.id === profile.id ? (
            <Button asChild size="sm" variant="outline">
              <Link to="/settings">Edit</Link>
            </Button>
          ) : undefined
        }
      />

      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-3xl soft-card p-6 sm:p-8"
      >
        <div className="relative flex flex-wrap items-center gap-5">
          <Avatar className="size-20 ring-2 ring-primary/50">
            <AvatarImage src={profile.avatar_url ?? undefined} />
            <AvatarFallback className="bg-primary/20 text-xl">
              {(profile.username ?? "P").slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold sm:text-3xl">{profile.username}</h1>
            <p className="text-sm text-muted-foreground">
              {favorite ? `Loves ${favorite.name}` : "Exploring the arcade"}
            </p>
            {topper && (
              <div className="mt-2">
                <TopperChip badge={topper} />
              </div>
            )}
            {user && user.id !== profile.id && (
              <div className="mt-3">
                <AddFriendButton
                  opponentId={profile.id}
                  opponentName={profile.username ?? "player"}
                />
              </div>
            )}
            {user?.id === profile.id && (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-xl"
                  onClick={() => setRenameOpen(true)}
                >
                  Change Username
                </Button>
                <CoinChip />
              </div>
            )}
          </div>
        </div>
        <ChangeUsernameDialog
          open={renameOpen}
          onOpenChange={setRenameOpen}
          mode="user"
          current={profile.username ?? ""}
          onSaved={(name) => {
            setProfile((p) => (p ? { ...p, username: name } : p));
            void navigate({ to: "/profile/$username", params: { username: name } });
          }}
        />
      </motion.section>

      <div className="mt-6 grid grid-cols-3 gap-4">
        <StatCard label="Rating" value={profile.rating} />
        <StatCard label="Wins" value={profile.wins} />
        <StatCard label="Win rate" value={`${winRate}%`} />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <StatCard label="Coins" value={`🪙 ${rewards?.coins ?? 0}`} />
        <StatCard label="Challenge streak" value={`🔥 ${rewards?.challenge_streak ?? 0}`} />
      </div>

      <Tabs defaultValue="history" className="mt-8">
        <TabsList className="h-12 rounded-2xl bg-secondary/50">
          <TabsTrigger value="history">Match history</TabsTrigger>
          <TabsTrigger value="coins">Coins</TabsTrigger>
          <TabsTrigger value="achievements">Achievements</TabsTrigger>
        </TabsList>


        <TabsContent value="history" className="mt-4">
          <div className="overflow-hidden rounded-3xl soft-card">
            {history.length === 0 && (
              <p className="p-10 text-center text-sm text-muted-foreground">No matches yet.</p>
            )}
            {history.map((h) => (
              <div
                key={h.id}
                className="flex items-center gap-3 border-b border-border/40 px-5 py-3 text-sm last:border-0"
              >
                <Gamepad2 className="size-4 text-muted-foreground" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium capitalize">
                    {GAMES.find((g) => g.id === h.game_id)?.name ?? h.game_id}
                    <span className="ml-2 text-xs text-muted-foreground">{h.mode}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    vs {h.opponent_name ?? "opponent"} ·{" "}
                    {new Date(h.created_at).toLocaleDateString()}
                  </p>
                </div>
                <Badge
                  variant={h.result === "win" ? "default" : "secondary"}
                  className="capitalize"
                >
                  {h.result}
                </Badge>
                <span
                  className={`w-14 text-right text-xs font-semibold ${
                    (h.points ?? 0) > 0
                      ? "text-success"
                      : (h.points ?? 0) < 0
                        ? "text-destructive"
                        : "text-muted-foreground"
                  }`}
                >
                  {(h.points ?? 0) > 0 ? "+" : ""}
                  {h.points ?? 0} pts
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="coins" className="mt-4">
          <div className="overflow-hidden rounded-3xl soft-card">
            {coins.length === 0 && (
              <p className="p-10 text-center text-sm text-muted-foreground">
                No coin activity yet.
              </p>
            )}
            {coins.map((c) => (
              <div
                key={c.id}
                className="flex items-center gap-3 border-b border-border/40 px-5 py-3 text-sm last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">
                    {c.kind === "topper" ? "👑 Topper Bonus" : (c.note ?? c.kind)}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {c.kind === "topper" && c.note ? `${c.note} · ` : ""}
                    {new Date(c.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span
                  className={`shrink-0 font-semibold ${c.amount >= 0 ? "text-success" : "text-muted-foreground"}`}
                >
                  {c.amount >= 0 ? "+" : ""}
                  {c.amount} 🪙
                </span>
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="achievements" className="mt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {achievements.map((a) => (
              <div
                key={a.id}
                className={`rounded-2xl p-4 ${a.unlocked ? "soft-card" : "border border-dashed border-border opacity-60"}`}
              >
                <Award
                  className={`size-5 ${a.unlocked ? "text-warning" : "text-muted-foreground"}`}
                />
                <p className="mt-2 font-semibold">{a.name}</p>
                <p className="text-xs text-muted-foreground">{a.description}</p>
              </div>
            ))}
          </div>
        </TabsContent>
      </Tabs>
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
