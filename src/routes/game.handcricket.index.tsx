import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Bot, Smartphone, HelpCircle, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameLeaderboardSheet } from "@/components/leaderboard/GameLeaderboardSheet";
import { getGame } from "@/lib/games";

export const Route = createFileRoute("/game/handcricket/")({
  head: () => ({
    meta: [
      { title: "Hand Cricket — Play With Friends" },
      {
        name: "description",
        content:
          "Play Hand Cricket online: throw 1–6 at the same time, match the number and you're out. Bat, bowl and chase against a bot or a friend.",
      },
      { property: "og:title", content: "Hand Cricket" },
      { property: "og:description", content: "Bat, bowl and chase in quick 1–3 minute matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CricketLobby,
});

const ICONS = { local: Smartphone, bot: Bot, online: Swords, friend: Users } as const;

function CricketLobby() {
  const game = getGame("handcricket")!;

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
        <h1 className="truncate text-center font-display text-2xl font-bold">Hand Cricket</h1>
        <div className="flex shrink-0 items-center gap-2">
        <GameLeaderboardSheet gameId="handcricket" />
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
              <SheetTitle>How to play</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-4 pb-4 text-sm text-muted-foreground">
              <div>
                <h3 className="font-display font-bold text-foreground">Rules</h3>
                <p className="mt-1">
                  Both players throw a number from 1 to 6 at the same time. If the numbers match,
                  the batter is out. Otherwise the batter scores their number.
                </p>
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Innings</h3>
                <p className="mt-1">
                  Every match is 6 balls and 1 wicket per innings. The toss winner picks bat or bowl
                  — when the wicket falls or the over ends, sides swap and the chase begins.
                </p>
              </div>
              <div>
                <h3 className="font-display font-bold text-foreground">Winning</h3>
                <p className="mt-1">
                  Beat the target to win the chase, or take the wicket before they get there. Level
                  scores end in a tie.
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </div>

      <div className="space-y-3">
        {game.modes.map((mode, i) => {
          const Icon = ICONS[mode.id as keyof typeof ICONS] ?? Swords;
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
