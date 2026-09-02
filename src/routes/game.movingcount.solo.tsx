import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { SoloTargetBanner, SoloTargetResult } from "@/components/SoloTargetNote";
import { MovingCountArena } from "@/games/movingcount/MovingCountArena";
import { makeSeed, type Summary } from "@/games/movingcount/engine";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { useActionLog } from "@/lib/scoring/useActionLog";
import { usePlayer } from "@/hooks/useAuth";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/movingcount/solo")({
  head: () => ({
    meta: [
      { title: "Moving Count Solo — Unlimited Memory Practice" },
      {
        name: "description",
        content:
          "Practise Moving Count as often as you like, then turn your best score into a challenge link for your friends.",
      },
      { property: "og:title", content: "Moving Count Solo" },
      { property: "og:description", content: "Play, score, challenge your friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovingCountSolo,
});

const BEST_KEY = "pwf-movingcount-best";

function MovingCountSolo() {
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
        gameId: "movingcount",
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
      gameId: "movingcount",
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: log.list(),
      config: { game: "movingcount" },
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  return (
    <GameShell>
      <SoloTargetBanner gameId="movingcount" className="mb-2" />
      <MovingCountArena
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
              <SoloTargetResult gameId="movingcount" score={summary.score} authed={player.isAuthed} />
            )}
            {challenge ? (
              <ChallengeShare
                gameId="movingcount"
                code={challenge.code}
                name={player.name}
                score={summary?.score ?? 0}
              />
            ) : (
              <Button variant="hero" disabled={creating} onClick={() => void create()}>
                🧠 Challenge friends
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
        onLeave={() => void navigate({ to: "/game/movingcount" })}
      />
    </GameShell>
  );
}
