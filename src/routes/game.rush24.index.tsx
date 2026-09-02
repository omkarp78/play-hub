import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, CalendarDays, Gamepad2, HelpCircle, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameLeaderboardSheet } from "@/components/leaderboard/GameLeaderboardSheet";
import { getGame } from "@/lib/games";

export const Route = createFileRoute("/game/rush24/")({
  head: () => ({
    meta: [
      { title: "24 Rush — Make 24 With Four Numbers" },
      {
        name: "description",
        content:
          "Use all four numbers exactly once to make 24. Ten rounds, fastest time wins. Play ranked, with friends, as a daily challenge or practice free.",
      },
      { property: "og:title", content: "24 Rush" },
      { property: "og:description", content: "Make 24. Use all 4 numbers exactly once." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rush24Lobby,
});

const ICONS = { online: Swords, friend: Users, daily: CalendarDays, solo: Gamepad2 } as const;

function Rush24Lobby() {
  const game = getGame("rush24")!;

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
        <h1 className="truncate text-center font-display text-2xl font-bold">24 Rush</h1>
        <div className="flex shrink-0 items-center gap-2">
          <GameLeaderboardSheet gameId="rush24" />
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
              <div className="mt-4 space-y-2 pb-4 text-sm text-muted-foreground">
                <p>Goal: make 24 using all 4 numbers exactly once.</p>
                <p>Allowed: + - × ÷</p>
                <p>Tap a number, an operator, then another number to combine them.</p>
                <p>
                  Example: 8, 3, 2, 1 →{" "}
                  <span className="font-display text-foreground">(8 - 2) × (3 + 1) = 24</span>
                </p>
                <p>Ten rounds. Faster and correct scores better.</p>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </div>

      <div className="mb-5 rounded-3xl bg-card p-6 text-center soft-card">
        <p className="font-display text-3xl font-bold">24</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Make 24. Use all 4 numbers exactly once.
        </p>
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
                  <p className="truncate text-xs text-muted-foreground">{mode.description}</p>
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
