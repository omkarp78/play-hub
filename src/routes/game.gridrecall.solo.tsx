import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { SoloTargetBanner, SoloTargetResult } from "@/components/SoloTargetNote";
import { GridRecallArena } from "@/games/gridrecall/GridRecallArena";
import { makeSeed, type Summary } from "@/games/gridrecall/engine";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { useActionLog } from "@/lib/scoring/useActionLog";
import { usePlayer } from "@/hooks/useAuth";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/gridrecall/solo")({
  head: () => ({
    meta: [
      { title: "Grid Recall Solo — Unlimited Memory Practice" },
      {
        name: "description",
        content:
          "Practise Grid Recall as often as you like, then turn your best score into a challenge link for your friends.",
      },
      { property: "og:title", content: "Grid Recall Solo" },
      { property: "og:description", content: "Play, score, challenge your friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GridRecallSolo,
});

const BEST_KEY = "pwf-gridrecall-best";

function GridRecallSolo() {
  const player = usePlayer();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(() => makeSeed());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [best, setBest] = useState(() =>
    typeof window === "undefined" ? 0 : Number(localStorage.getItem(BEST_KEY) ?? 0),
  );
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const recorded = useRef(false);
  const log = useActionLog();

  const finish = (s: Summary) => {
    setSummary(s);
    if (s.score > best) {
      setBest(s.score);
      if (typeof window !== "undefined") localStorage.setItem(BEST_KEY, String(s.score));
    }
    if (!recorded.current && player.isAuthed && player.id) {
      recorded.current = true;
      void recordResult({
        userId: player.id,
        gameId: "gridrecall",
        mode: "solo",
        outcome: "draw",
        opponentName: "Solo",
        score: s.score,
      });
    }
  };

  const create = async () => {
    if (!summary) return;
    setCreating(true);
    const row = await createChallenge({
      gameId: "gridrecall",
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: log.list(),
      config: { game: "gridrecall" },
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  return (
    <GameShell>
      <SoloTargetBanner gameId="gridrecall" className="mb-2" />
      <GridRecallArena
        key={seed}
        seed={seed}
        meName={player.name}
        onAction={log.record}
        onFinish={finish}
        result={
          summary
            ? {
                title: "Your score",
                subtitle: `${summary.score}`,
              }
            : null
        }
        resultExtra={
          <>
            <p className="text-sm text-muted-foreground">
              Best score <span className="font-display font-bold text-foreground">{best}</span>
            </p>
            {summary && (
              <SoloTargetResult gameId="gridrecall" score={summary.score} authed={player.isAuthed} />
            )}
            {challenge ? (
              <ChallengeShare
                gameId="gridrecall"
                code={challenge.code}
                name={player.name}
                score={summary?.score ?? 0}
              />
            ) : (
              <Button variant="hero" disabled={creating} onClick={() => void create()}>
                🟦 Challenge friends
              </Button>
            )}
          </>
        }
        onRematch={() => {
          log.reset();
          recorded.current = false;
          setSummary(null);
          setChallenge(null);
          setSeed(makeSeed());
        }}
        onLeave={() => void navigate({ to: "/game/gridrecall" })}
      />
    </GameShell>
  );
}
