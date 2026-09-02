import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { GameCard } from "@/components/GameCard";
import { Input } from "@/components/ui/input";
import { GAMES } from "@/lib/games";
import { useHomeBackGuard } from "@/hooks/useHomeBackGuard";
import { AdSlot } from "@/components/ads/AdSlot";
import { CoinChip } from "@/components/rewards/CoinsSheet";
import { useRewards } from "@/hooks/useRewards";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Play With Friends — Quick Multiplayer Games" },
      {
        name: "description",
        content:
          "Pick a game and play in seconds. Battle XO, Hand Cricket and Rock Paper Scissors — solo, online or with a friend.",
      },
      { property: "og:title", content: "Play With Friends" },
      { property: "og:description", content: "Pick a game and play in seconds." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const ONLINE: Record<string, number> = {
  battlexo: 128,
  handcricket: 96,
  rps: 174,
  bullseye: 142,
  reflexrush: 118,
  numberrush: 133,
  gridrecall: 104,
  movingcount: 88,
};


function HomePage() {
  useHomeBackGuard();
  const [query, setQuery] = useState("");
  const rewards = useRewards();
  const streak = rewards.d.liveChallengeStreak;
  const claimedToday = rewards.d.claimedToday;


  const games = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? GAMES.filter((g) => g.name.toLowerCase().includes(q)) : GAMES;
  }, [query]);

  return (
    <AppShell>
      <h1 className="sr-only">Play With Friends — quick multiplayer games</h1>

      <div className="mt-5 flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {streak > 0 ? `🔥 ${streak} day streak` : claimedToday ? "🎁 Reward claimed" : "🎁 Daily reward"}
        </p>
        <CoinChip />
      </div>

      <div className="relative mt-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search games"
          className="h-13 rounded-2xl border-border bg-card pl-12 text-base shadow-none"
        />
      </div>

      <h2 className="mt-8 mb-3 font-display text-lg font-bold">Games</h2>
      <div className="space-y-3">
        {games.map((game) => (
          <GameCard key={game.id} game={game} online={ONLINE[game.id] ?? 42} />
        ))}
        {games.length === 0 && (
          <p className="py-10 text-center text-sm text-muted-foreground">No games found</p>
        )}
      </div>

      <AdSlot placement="home-banner" className="mt-6" />
    </AppShell>

  );
}
