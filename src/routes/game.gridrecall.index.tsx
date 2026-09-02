import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Gamepad2, HelpCircle, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameLeaderboardSheet } from "@/components/leaderboard/GameLeaderboardSheet";
import { getGame } from "@/lib/games";

export const Route = createFileRoute("/game/gridrecall/")({
  head: () => ({
    meta: [
      { title: "Grid Recall — 5x5 Visual Memory Game" },
      {
        name: "description",
        content:
          "Remember the cards, find every pair and keep your combo alive. Play Grid Recall solo, ranked, with friends or as a daily challenge.",
      },
      { property: "og:title", content: "Grid Recall" },
      { property: "og:description", content: "Watch the pattern. Tap it back." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GridRecallLobby,
});

const ICONS = { online: Swords, friend: Users, daily: CalendarDays, solo: Gamepad2 } as const;

function GridRecallLobby() {
  const game = getGame("gridrecall")!;

  return (
    <AppShell>
      <div className="mb-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Link
          to="/"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground active:scale-95"
          aria-label="Back"
        >
          <ArrowRight className="size-5 rotate-180" />
        </Link>
        <h1 className="truncate text-center font-display text-2xl font-bold">Grid Recall</h1>
        <div className="flex shrink-0 items-center gap-2">
        <GameLeaderboardSheet gameId="gridrecall" />
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground active:scale-95"
              aria-label="Help"
            >
              <HelpCircle className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle>How to Play</SheetTitle>
            </SheetHeader>
            <ol className="mt-4 space-y-2 pb-4 text-sm text-muted-foreground">
              <li>1. Watch the lit squares.</li>
              <li>2. Remember where they were.</li>
              <li>3. Tap them all back.</li>
              <li>4. Wrong taps and misses cost points.</li>
              <li>5. A perfect round earns a bonus.</li>
            </ol>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <div className="space-y-3">
        {game.modes.map((mode, i) => {
          const Icon = ICONS[mode.id as keyof typeof ICONS] ?? Gamepad2;
          return (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
            >
              <Link
                to={mode.path}
                className="group flex items-center gap-4 rounded-3xl bg-card p-5 soft-card transition-transform active:scale-[0.98]"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="size-6" />
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-lg font-bold">{mode.label}</h2>
                </div>
                <ArrowRight className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </AppShell>
  );
}
