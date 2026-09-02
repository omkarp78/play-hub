import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { NumberArena } from "@/games/numberrush/NumberArena";
import { dailySeed, type Summary } from "@/games/numberrush/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import {
  DailyBoards,
  DailyStartPanel,
  DailyResultPanel,
} from "@/components/DailyChallenge";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/numberrush/daily")({
  head: () => ({
    meta: [
      { title: "Number Rush Daily Challenge — Same Questions For Everyone" },
      {
        name: "description",
        content:
          "One attempt a day on the exact same Number Rush questions as every other player. No account needed — enter a name and climb today's leaderboard.",
      },
      { property: "og:title", content: "Number Rush Daily Challenge" },
      { property: "og:description", content: "One attempt. One question set. Global ranks." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NumberRushDaily,
});

function NumberRushDaily() {
  const player = usePlayer();
  const daily = useDailyChallenge("numberrush");
  const seed = dailySeed();
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const recorded = useRef(false);

  const finish = (s: Summary) => {
    if (recorded.current) return;
    recorded.current = true;
    setSummary(s);
    void daily.submit(s.score, seed);
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "numberrush",
        mode: "daily",
        outcome: "draw",
        opponentName: "Daily Challenge",
        score: s.score,
      });
    }
  };

  const left = daily.left;

  if (playing) {
    return (
      <GameShell>
        <NumberArena
          key={`${seed}-${round}`}
          seed={seed}
          duration={daily.playSeconds(30)}
          meName={daily.name || player.name}
          note={summary ? undefined : "Daily questions — same for everyone"}
          onAction={daily.record}
          onFinish={finish}
          result={summary ? { title: "Attempt complete", subtitle: `${summary.score}` } : null}
          playAgainLabel={left > 0 ? `Attempt ${daily.used + 1} of ${daily.attempts}` : ""}
          {...(left > 0
            ? {
                onRematch: () => {
                  void daily.begin().then((a) => {
                    if (!a) return;
                  recorded.current = false;
                  setSummary(null);
                  setRound((r) => r + 1);
                  });
                },
              }
            : {})}
          resultExtra={
            summary ? (
              <DailyResultPanel
                gameId="numberrush"
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
            ) : null
          }
          onLeave={() => {
            setPlaying(false);
            setSummary(null);
            recorded.current = false;
          }}
        />
      </GameShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Daily Challenge" back="/game/numberrush" />

      <div className="rounded-3xl bg-card p-6 text-center soft-card">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Today&apos;s questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone solves the exact same set today.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Stat label="Attempts left" value={`${left}`} />
          <Stat label="Best score" value={`${daily.best}`} />
        </div>

        <DailyStartPanel
          daily={daily}
          onStart={() => {
              recorded.current = false;
              setSummary(null);
              setRound((r) => r + 1);
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-xl font-bold">{value}</p>
    </div>
  );
}
