import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { Bot, Smartphone, ChevronRight, HelpCircle, Swords, Users } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { GameLeaderboardSheet } from "@/components/leaderboard/GameLeaderboardSheet";
import { getGame } from "@/lib/games";

export const Route = createFileRoute("/game/battlexo/")({
  head: () => ({
    meta: [
      { title: "Battle XO — Strategic 3-Piece Duel" },
      {
        name: "description",
        content:
          "Battle XO: place three pieces, then slide them to line up 3. Play a bot, go online, or challenge a friend.",
      },
      { property: "og:title", content: "Battle XO — Strategic 3-Piece Duel" },
      {
        property: "og:description",
        content: "Almost zero draws. Best-of series and realtime duels.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BattleLobby,
});

const ICONS = { local: Smartphone, bot: Bot, online: Swords, friend: Users } as const;

function BattleLobby() {
  const game = getGame("battlexo")!;

  return (
    <AppShell>
      <header className="mb-6 grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
        <Link
          to="/"
          className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground transition-transform active:scale-95"
          aria-label="Back"
        >
          <ChevronRight className="size-5 rotate-180" />
        </Link>
        <h1 className="truncate text-center font-display text-2xl font-bold">{game.name}</h1>
        <div className="flex shrink-0 items-center gap-2">
        <GameLeaderboardSheet gameId="battlexo" />
        <Sheet>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label="Rules"
              className="grid size-11 shrink-0 place-items-center rounded-2xl border border-border bg-card text-foreground transition-transform active:scale-95"
            >
              <HelpCircle className="size-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="bottom" className="rounded-t-3xl">
            <SheetHeader>
              <SheetTitle className="font-display text-xl">Battle XO</SheetTitle>
            </SheetHeader>
            <div className="mt-4 space-y-5 pb-6">
              <div>
                <h3 className="font-display font-bold">Rules</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Each player has exactly 3 pieces. There are no extra pieces — once placed, they
                  move around the board.
                </p>
              </div>
              <div>
                <h3 className="font-display font-bold">How to play</h3>
                <ol className="mt-1 space-y-1 text-sm text-muted-foreground">
                  <li>1. Place your 3 pieces, alternating turns.</li>
                  <li>2. Then slide a piece into any adjacent empty cell.</li>
                  <li>3. Line up 3 to take the round.</li>
                </ol>
              </div>
              <div>
                <h3 className="font-display font-bold">How to move</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  Your X/O pieces can slide into any adjacent empty cell.
                </p>
                <p className="mt-3 text-sm font-semibold text-foreground">↩️ No back-and-forth</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  A piece can&apos;t immediately move back to the cell it just came from. So
                  A → B → A is fine, but right after that B is temporarily blocked for that
                  piece. Move it elsewhere and B opens up again.
                </p>
              </div>
              <div>
                <h3 className="font-display font-bold">Winning conditions</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  First to line up 3 pieces wins the round. Matches are best of 3 rounds.
                </p>
              </div>
            </div>
          </SheetContent>
        </Sheet>
        </div>
      </header>

      <div className="grid gap-4">
        {game.modes.map((mode, i) => {
          const Icon = ICONS[mode.id as keyof typeof ICONS] ?? Swords;
          return (
            <motion.div
              key={mode.id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              whileTap={{ scale: 0.97 }}
            >
              <Link
                to={mode.path}
                className="flex h-20 items-center gap-4 rounded-3xl bg-card px-5 soft-card"
              >
                <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/15 text-primary">
                  <Icon className="size-6" />
                </div>
                <span className="flex-1 font-display text-lg font-bold">{mode.label}</span>
                <ChevronRight className="size-5 text-muted-foreground" />
              </Link>
            </motion.div>
          );
        })}
      </div>
    </AppShell>
  );
}
