import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { BullseyeArena } from "@/games/bullseye/BullseyeArena";
import {
  createState,
  dailySeed,
  isFinished,
  throwDart,
  type BullseyeState,
} from "@/games/bullseye/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useDailyChallenge } from "@/hooks/useDailyChallenge";
import {
  DailyBoards,
  DailyStartPanel,
  DailyResultPanel,
} from "@/components/DailyChallenge";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/bullseye/daily")({
  head: () => ({
    meta: [
      { title: "Bullseye Rush Daily Challenge — Same Board For Everyone" },
      {
        name: "description",
        content:
          "Two attempts a day on the exact same dartboard. No account needed — enter a name and climb today's leaderboard.",
      },
      { property: "og:title", content: "Bullseye Rush Daily Challenge" },
      {
        property: "og:description",
        content: "Two attempts. One board. Global, friends and weekly ranks.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BullseyeDaily,
});

function BullseyeDaily() {
  const player = usePlayer();
  const daily = useDailyChallenge("bullseye");
  const seed = dailySeed();
  const [state, setState] = useState<BullseyeState | null>(null);
  const recorded = useRef(false);

  const finished = state ? isFinished(state) : false;

  useEffect(() => {
    if (!state || !finished || recorded.current) return;
    recorded.current = true;
    void daily.submit(state.score, seed);
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "bullseye",
        mode: "daily",
        outcome: "draw",
        opponentName: "Daily Challenge",
        score: state.score,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const left = daily.left;

  if (state) {
    return (
      <GameShell>
        <BullseyeArena
          state={state}
          meName={daily.name || player.name}
          note={finished ? undefined : "Daily board — same for everyone"}
          result={finished ? { title: "Attempt complete", subtitle: `${state.score}` } : null}
          playAgainLabel={left > 0 ? `Attempt ${daily.used + 1} of ${daily.attempts}` : ""}
          onThrow={(x, y) => {
            daily.record({ k: `d${state.thrown.length}`, t: "throw", x, y });
            setState((s) => (s ? throwDart(s, x, y) : s));
          }}
          {...(left > 0
            ? {
                onRematch: () => {
                  void daily.begin().then((a) => {
                    if (!a) return;
                  recorded.current = false;
                  setState(createState(seed));
                  });
                },
              }
            : {})}
          resultExtra={
            finished ? (
              <DailyResultPanel
                gameId="bullseye"
                score={state.score}
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
            setState(null);
            recorded.current = false;
          }}
        />
      </GameShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Daily Challenge" back="/game/bullseye" />

      <div className="rounded-3xl bg-card p-6 text-center soft-card">
        <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
          <CalendarDays className="size-6" />
        </div>
        <h2 className="mt-4 font-display text-xl font-bold">Today&apos;s board</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Everyone throws at the exact same dartboard today.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2">
          <Stat label="Attempts left" value={`${left}`} />
          <Stat label="Best score" value={`${daily.best}`} />
        </div>

        <DailyStartPanel
          daily={daily}
          onStart={() => {
              recorded.current = false;
              setState(createState(seed));
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
