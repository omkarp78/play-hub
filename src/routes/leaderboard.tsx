import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Crown, Medal, Trophy } from "lucide-react";
import { z } from "zod";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { callRpc } from "@/lib/rpc";

import { useAuth } from "@/hooks/useAuth";
import { GAMES } from "@/lib/games";

const searchSchema = z.object({
  game: z.string().optional(),
  tab: z.enum(["global", "friends", "weekly", "monthly"]).optional(),
});

export const Route = createFileRoute("/leaderboard")({
  validateSearch: searchSchema,
  head: () => ({
    meta: [
      { title: "Leaderboards — Play With Friends" },
      {
        name: "description",
        content:
          "Global, friends, weekly and monthly rankings across every game on Play With Friends.",
      },
      { property: "og:title", content: "Leaderboards — Play With Friends" },
      { property: "og:description", content: "See who tops the rating charts this week." },
    ],
  }),
  component: LeaderboardPage,
});

type Row = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number;
  wins: number;
  losses: number;
  country: string | null;
};

function LeaderboardPage() {
  const { game, tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const { user } = useAuth();
  const activeTab = tab ?? "global";
  const activeGame = game ?? "all";
  const [rows, setRows] = useState<Row[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setRows(null);
      let ids: string[] | null = null;

      if (activeTab === "friends") {
        if (!user) {
          if (!cancelled) setRows([]);
          return;
        }
        const { data } = await supabase.from("friends").select("friend_id").eq("user_id", user.id);
        ids = [...(data ?? []).map((f) => f.friend_id), user.id];
      }

      const days =
        activeTab === "weekly" ? 7 : activeTab === "monthly" ? 30 : null;

      const data = await callRpc<Row>("leaderboard_profiles", {
        p_game_id: activeGame === "all" ? null : activeGame,
        p_days: days,
        p_ids: ids,
      });
      if (!cancelled) setRows(data);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [activeTab, activeGame, user]);


  return (
    <AppShell>
      <PageHeader
        title="Leaderboards"
        action={
          <div className="flex flex-wrap gap-2">
            <GameChip
              label="All games"
              active={activeGame === "all"}
              onClick={() => void navigate({ search: { tab: activeTab } })}
            />
            {GAMES.map((g) => (
              <GameChip
                key={g.id}
                label={`${g.emoji} ${g.name}`}
                active={activeGame === g.id}
                onClick={() => void navigate({ search: { game: g.id, tab: activeTab } })}
              />
            ))}
          </div>
        }
      />

      <Tabs
        value={activeTab}
        onValueChange={(v) =>
          void navigate({
            search: {
              game: activeGame === "all" ? undefined : activeGame,
              tab: v as "global" | "friends" | "weekly" | "monthly",
            },
          })
        }
      >
        <TabsList className="h-12 rounded-2xl bg-secondary/50">
          <TabsTrigger value="global">Global</TabsTrigger>
          <TabsTrigger value="friends">Friends</TabsTrigger>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="mt-5 overflow-hidden rounded-3xl soft-card">
        <div className="hidden grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem_4rem] gap-2 border-b border-border/60 px-5 py-3 text-xs uppercase tracking-wide text-muted-foreground sm:grid">
          <span>#</span>
          <span>Player</span>
          <span className="text-right">Rating</span>
          <span className="text-right">Wins</span>
          <span className="text-right">Losses</span>
          <span className="text-right">Win %</span>
          <span className="text-right">Country</span>
        </div>

        {rows === null &&
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-3">
              <Skeleton className="h-8 w-full rounded-lg" />
            </div>
          ))}

        {rows?.length === 0 && (
          <p className="px-5 py-12 text-center text-sm text-muted-foreground">
            {activeTab === "friends" && !user
              ? "Sign in and add friends to see this board."
              : "No ranked players yet — be the first!"}
          </p>
        )}

        {rows?.map((row, index) => {
          const total = row.wins + row.losses;
          const winRate = total === 0 ? 0 : Math.round((row.wins / total) * 100);
          return (
            <motion.div
              key={row.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.02 }}
              className={`grid grid-cols-[2.5rem_1fr_auto] items-center gap-2 border-b border-border/40 px-5 py-3 text-sm last:border-0 sm:grid-cols-[3rem_1fr_5rem_4rem_4rem_5rem_4rem] ${
                row.id === user?.id ? "bg-primary/10" : ""
              }`}
            >
              <span className="flex items-center font-display font-bold">
                {index === 0 ? (
                  <Crown className="size-4 text-warning" />
                ) : index === 1 ? (
                  <Medal className="size-4 text-muted-foreground" />
                ) : index === 2 ? (
                  <Trophy className="size-4 text-accent" />
                ) : (
                  index + 1
                )}
              </span>
              <Link
                to="/profile/$username"
                params={{ username: row.username ?? "" }}
                className="flex min-w-0 items-center gap-3 hover:underline"
              >
                <Avatar className="size-8">
                  <AvatarImage src={row.avatar_url ?? undefined} />
                  <AvatarFallback className="bg-primary/20 text-xs">
                    {(row.username ?? "P").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="truncate font-medium">{row.username}</span>
              </Link>
              <span className="text-right sm:hidden">
                <Badge variant="secondary">{row.rating}</Badge>
              </span>
              <span className="hidden text-right font-semibold text-primary sm:block">
                {row.rating}
              </span>
              <span className="hidden text-right sm:block">{row.wins}</span>
              <span className="hidden text-right sm:block">{row.losses}</span>
              <span className="hidden text-right sm:block">{winRate}%</span>
              <span className="hidden text-right text-muted-foreground sm:block">
                {row.country ?? "WW"}
              </span>
            </motion.div>
          );
        })}
      </div>
    </AppShell>
  );
}

function GameChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-2xl border px-3 py-2 text-xs font-medium transition-colors ${
        active
          ? "border-primary/60 bg-primary/15 text-foreground"
          : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
    </button>
  );
}
