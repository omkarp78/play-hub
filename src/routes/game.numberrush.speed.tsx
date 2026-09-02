import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { SpeedArena } from "@/games/numberrush/SpeedArena";
import { makeSeed } from "@/games/numberrush/engine";
import type { SpeedResult } from "@/games/numberrush/speedrun";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { useActionLog } from "@/lib/scoring/useActionLog";
import { usePlayer } from "@/hooks/useAuth";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/numberrush/speed")({
  head: () => ({
    meta: [
      { title: "Number Rush Speed Run — 11 Questions Against The Clock" },
      {
        name: "description",
        content:
          "Solve exactly 11 math questions as fast as you can. No countdown — your completion time is your score. Challenge friends with a link.",
      },
      { property: "og:title", content: "Number Rush Speed Run" },
      { property: "og:description", content: "11 questions. Fastest time wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NumberRushSpeed,
});

function NumberRushSpeed() {
  const player = usePlayer();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(() => makeSeed());
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const recorded = useRef(false);
  const log = useActionLog();

  const finish = (r: SpeedResult) => {
    setResult(r);
    if (!recorded.current && player.isAuthed && player.id) {
      recorded.current = true;
      void recordResult({
        userId: player.id,
        gameId: "numberrush",
        mode: "speed",
        outcome: "draw",
        opponentName: "Speed Run",
        score: r.score,
      });
    }
  };

  const create = async () => {
    if (!result) return;
    setCreating(true);
    const row = await createChallenge({
      gameId: "numberrushspeed",
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: log.list(),
      config: { questions: 11 },
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  return (
    <GameShell>
      <SpeedArena
        key={seed}
        seed={seed}
        meName={player.name}
        onAction={log.record}
        onFinish={finish}
        onRematch={() => {
          log.reset();
          recorded.current = false;
          setResult(null);
          setChallenge(null);
          setSeed(makeSeed());
        }}
        onLeave={() => void navigate({ to: "/game/numberrush" })}
        resultExtra={
          challenge ? (
            <ChallengeShare
              gameId="numberrushspeed"
              code={challenge.code}
              name={player.name}
              score={result?.score ?? 0}
            />
          ) : (
            <Button variant="hero" disabled={creating} onClick={() => void create()}>
              🔢 Challenge friends
            </Button>
          )
        }
      />
    </GameShell>
  );
}
