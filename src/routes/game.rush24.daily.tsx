import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Rush24Arena } from "@/games/rush24/Rush24Arena";
import {
  ROUNDS,
  dailySeed,
  formatSeconds,
  pointsOf,
  type RushSummary,
} from "@/games/rush24/engine";
import { serverSource } from "@/games/rush24/source";
import { usePlayer } from "@/hooks/useAuth";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import { DailyBoards, DailyStartPanel, DailyResultPanel } from "@/components/DailyChallenge";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/rush24/daily")({
  head: () => ({
    meta: [
      { title: "24 Rush Daily Challenge — Same 10 Puzzles For Everyone" },
      {
        name: "description",
        content:
          "One attempt a day on the exact same ten 24 Rush puzzles. Fastest correct run tops today's leaderboard — no account needed.",
      },
      { property: "og:title", content: "24 Rush Daily Challenge" },
      { property: "og:description", content: "One attempt. Ten puzzles. Best time wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rush24Daily,
});

function Rush24Daily() {
  const player = usePlayer();
  const daily = useDailyChallenge("rush24");
  const seed = dailySeed();
  const [playing, setPlaying] = useState(false);
  const [summary, setSummary] = useState<RushSummary | null>(null);
  const recorded = useRef(false);
  const attemptId = daily.attempt.attemptId;

  /* The server owns the puzzles, the clock and the answers for this run. */
  const source = useMemo(
    () => (attemptId && daily.key ? serverSource(attemptId, daily.key) : null),
    [attemptId, daily.key],
  );

  const finish = (s: RushSummary) => {
    if (recorded.current) return;
    recorded.current = true;
    setSummary(s);
    void daily.submit(s.score, seed);
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "rush24",
        mode: "daily",
        outcome: "draw",
        opponentName: "Daily Challenge",
        score: s.score,
      });
    }
  };

  if (playing && source && attemptId) {
    return (
      <GameShell>
        <Rush24Arena
          key={attemptId}
          source={source}
          meName={daily.name || player.name}
          note={summary ? undefined : "Today's puzzles — same for everyone"}
          onFinish={finish}
          result={
            summary
              ? {
                  title: "🎉 Finished!",
                  subtitle: formatSeconds(summary.ms),
                }
              : null
          }
          resultExtra={
            summary ? (
              <>
                <div className="grid grid-cols-2 gap-2 text-center">
                  <Stat label="Correct" value={`${summary.correct} / ${ROUNDS}`} />
                  <Stat label="Score" value={`${pointsOf(summary.correct, summary.ms)}`} />
                </div>
                <DailyResultPanel
                  gameId="rush24"
                  score={summary.score}
                  attemptsUsed={daily.used}
                  needsName={daily.needsName}
                  onName={daily.confirmName}
                  board={daily.board}
                  setBoard={daily.setBoard}
                  entries={daily.entries}
                  totalAttempts={daily.attempts}
                  canEarnExtraAttempt={daily.canEarnExtraAttempt}
                  onExtraAttempt={daily.grantExtraAttempt}
                />
              </>
            ) : null
          }
          onLeave={() => {
            setPlaying(false);
            setSummary(null);
            recorded.current = false;
            void daily.refresh();
          }}
        />
      </GameShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Daily Challenge" back="/game/rush24" />

      <div className="rounded-3xl bg-card p-6 text-center soft-card">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Today&apos;s ten puzzles</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone plays the exact same set. Fastest correct run wins.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Stat label="Attempts left" value={`${daily.left}`} />
          <Stat label="Best" value={bestLabel(daily.best)} />
        </div>

        <DailyStartPanel
          daily={daily}
          onStart={() => {
            recorded.current = false;
            setSummary(null);
            setPlaying(true);
          }}
        />
      </div>

      <div className="mt-4">
        <DailyBoards board={daily.board} setBoard={daily.setBoard} entries={daily.entries} />
      </div>
    </AppShell>
  );
}

function bestLabel(score: number) {
  if (!score) return "—";
  const correct = Math.floor(score / 1_000_000);
  const ms = 1_000_000 - 1 - (score % 1_000_000);
  return `${correct}/${ROUNDS} · ${formatSeconds(ms)}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
