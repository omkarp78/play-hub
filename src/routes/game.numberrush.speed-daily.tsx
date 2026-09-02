import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { SpeedArena } from "@/games/numberrush/SpeedArena";
import { dailySeed } from "@/games/numberrush/engine";
import { formatSpeedScore, type SpeedResult } from "@/games/numberrush/speedrun";
import { usePlayer } from "@/hooks/useAuth";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import {
  DailyBoards,
  DailyStartPanel,
  DailyResultPanel,
} from "@/components/DailyChallenge";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/numberrush/speed-daily")({
  head: () => ({
    meta: [
      { title: "Number Rush Speed Run Daily — Same 11 Questions For Everyone" },
      {
        name: "description",
        content:
          "One attempt a day on today's 11 Number Rush Speed Run questions. Fastest accurate finish tops the leaderboard. No account needed.",
      },
      { property: "og:title", content: "Number Rush Speed Run Daily" },
      { property: "og:description", content: "One attempt. 11 questions. Fastest time wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeedDaily,
});

function SpeedDaily() {
  const player = usePlayer();
  const daily = useDailyChallenge("numberrushspeed");
  const seed = dailySeed() + 7;
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const recorded = useRef(false);

  const finish = (r: SpeedResult) => {
    if (recorded.current) return;
    recorded.current = true;
    setResult(r);
    void daily.submit(r.score, seed);
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "numberrush",
        mode: "daily",
        outcome: "draw",
        opponentName: "Speed Run Daily",
        score: r.score,
      });
    }
  };

  if (playing) {
    return (
      <GameShell>
        <SpeedArena
          key={`${seed}-${round}`}
          seed={seed}
          meName={daily.name || player.name}
          note={result ? undefined : "Daily questions — same for everyone"}
          onAction={daily.record}
          onFinish={finish}
          resultExtra={
            result ? (
              <DailyResultPanel
                gameId="numberrushspeed"
                score={result.score}
                attemptsUsed={daily.used}
                needsName={daily.needsName}
                onName={daily.confirmName}
                board={daily.board}
                setBoard={daily.setBoard}
                entries={daily.entries}
                formatScore={formatSpeedScore}
                totalAttempts={daily.attempts}
                canEarnExtraAttempt={daily.canEarnExtraAttempt}
                onExtraAttempt={daily.grantExtraAttempt}
              />
            ) : null
          }
          onLeave={() => {
            setPlaying(false);
            setResult(null);
            recorded.current = false;
          }}
        />
      </GameShell>
    );
  }

  const left = daily.left;

  return (
    <AppShell>
      <PageHeader title="Speed Run Daily" back="/game/numberrush" />

      <div className="rounded-3xl bg-card p-6 text-center soft-card">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Today&apos;s 11 questions</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone solves the exact same set today. Fastest accurate run wins.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Stat label="Attempts left" value={`${left}`} />
          <Stat
            label="Your result"
            value={daily.best ? formatSpeedScore(daily.best) : "—"}
          />
        </div>

        {daily.loading ? (
          <div className="mt-6 rounded-2xl bg-secondary px-4 py-3 text-sm font-medium text-muted-foreground">
            Checking today&apos;s attempt…
          </div>
        ) : (
          <DailyStartPanel
            daily={daily}
            onStart={() => {
              recorded.current = false;
              setResult(null);
              setRound((r) => r + 1);
              setPlaying(true);
            }}
          />
        )}


      </div>

      <div className="mt-4">
        <DailyBoards
          board={daily.board}
          setBoard={daily.setBoard}
          entries={daily.entries}
          formatScore={formatSpeedScore}
        />
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
