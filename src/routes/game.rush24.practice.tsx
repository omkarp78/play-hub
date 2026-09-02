import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { Rush24Arena } from "@/games/rush24/Rush24Arena";
import {
  ROUNDS,
  encodeRushScore,
  formatSeconds,
  makeSeed,
  pointsOf,
  type RushSummary,
  type Step,
} from "@/games/rush24/engine";
import { localSource } from "@/games/rush24/source";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { usePlayer } from "@/hooks/useAuth";
import { recordResult } from "@/lib/results";
import type { GameAction } from "@/lib/scoring/types";

export const Route = createFileRoute("/game/rush24/practice")({
  head: () => ({
    meta: [
      { title: "24 Rush Practice — Unlimited Number Puzzles" },
      {
        name: "description",
        content:
          "Practise 24 Rush as often as you like, then turn your best run into a challenge link for your friends. No login needed.",
      },
      { property: "og:title", content: "24 Rush Practice" },
      { property: "og:description", content: "Play, beat your time, challenge your friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rush24Practice,
});

const BEST_KEY = "pwf-rush24-best";

function Rush24Practice() {
  const player = usePlayer();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(() => makeSeed());
  const [summary, setSummary] = useState<RushSummary | null>(null);
  const [best, setBest] = useState(() =>
    typeof window === "undefined" ? 0 : Number(localStorage.getItem(BEST_KEY) ?? 0),
  );
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const recorded = useRef(false);
  const actions = useRef<GameAction[]>([]);

  const source = useMemo(() => {
    actions.current = [];
    return localSource(seed, ({ round, ms, steps }: { round: number; ms: number; steps: Step[] }) => {
      actions.current.push({ k: `r${round}`, n: round, t: "solve", r: round, ms, s: steps });
    });
  }, [seed]);

  const bestBefore = useRef(best);

  const finish = (s: RushSummary) => {
    setSummary(s);
    if (s.score > best) {
      setBest(s.score);
      if (typeof window !== "undefined") localStorage.setItem(BEST_KEY, String(s.score));
    }
    if (!recorded.current && player.isAuthed && player.id) {
      recorded.current = true;
      void recordResult({
        userId: player.id,
        gameId: "rush24",
        mode: "solo",
        outcome: "draw",
        opponentName: "Practice",
        score: s.score,
      });
    }
  };

  const create = async () => {
    if (!summary) return;
    setCreating(true);
    const row = await createChallenge({
      gameId: "rush24",
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: actions.current,
      config: { game: "rush24", rounds: ROUNDS },
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  const beatenBest = summary ? summary.score >= bestBefore.current && summary.correct > 0 : false;

  return (
    <GameShell>
      <Rush24Arena
        key={seed}
        source={source}
        meName={player.name}
        onFinish={finish}
        result={
          summary
            ? {
                title: "🎉 Finished!",
                subtitle: `${formatSeconds(summary.ms)}`,
              }
            : null
        }
        resultExtra={
          summary ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                <Cell label="Correct" value={`${summary.correct} / ${ROUNDS}`} />
                <Cell label="Score" value={`${pointsOf(summary.correct, summary.ms)}`} />
              </div>
              <p className="text-sm text-muted-foreground">
                {beatenBest ? "🏆 New personal best!" : `🏆 Personal best ${bestLabel(best)}`}
              </p>
              {challenge ? (
                <ChallengeShare
                  gameId="rush24"
                  code={challenge.code}
                  name={player.name}
                  score={encodeRushScore(summary.correct, summary.ms)}
                />
              ) : (
                <Button variant="hero" disabled={creating} onClick={() => void create()}>
                  🧮 Challenge friends
                </Button>
              )}
            </>
          ) : null
        }
        onRematch={() => {
          recorded.current = false;
          bestBefore.current = best;
          setSummary(null);
          setChallenge(null);
          setSeed(makeSeed());
        }}
        onLeave={() => void navigate({ to: "/game/rush24" })}
      />
    </GameShell>
  );
}

function bestLabel(score: number) {
  if (!score) return "—";
  const ms = 1_000_000 - 1 - (score % 1_000_000);
  return formatSeconds(ms);
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
