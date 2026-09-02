import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { SoloTargetBanner, SoloTargetResult } from "@/components/SoloTargetNote";
import { ReflexArena } from "@/games/reflexrush/ReflexArena";
import { makeSeed, type Summary } from "@/games/reflexrush/engine";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { useActionLog } from "@/lib/scoring/useActionLog";
import { usePlayer } from "@/hooks/useAuth";
import { recordResult } from "@/lib/results";

export const Route = createFileRoute("/game/reflexrush/solo")({
  head: () => ({
    meta: [
      { title: "Reflex Rush Solo — Unlimited Reaction Practice" },
      {
        name: "description",
        content:
          "Practise Reflex Rush as often as you like, then turn your best score into a challenge link for your friends.",
      },
      { property: "og:title", content: "Reflex Rush Solo" },
      { property: "og:description", content: "Play, score, challenge your friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReflexRushSolo,
});

function ReflexRushSolo() {
  const player = usePlayer();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(() => makeSeed());
  const [summary, setSummary] = useState<Summary | null>(null);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const recorded = useRef(false);
  const log = useActionLog();

  const finish = (s: Summary) => {
    setSummary(s);
    if (!recorded.current && player.isAuthed && player.id) {
      recorded.current = true;
      void recordResult({
        userId: player.id,
        gameId: "reflexrush",
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
      gameId: "reflexrush",
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: log.list(),
      config: { duration: 30 },
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  return (
    <GameShell>
      <SoloTargetBanner gameId="reflexrush" className="mb-2" />
      <ReflexArena
        key={seed}
        seed={seed}
        meName={player.name}
        onAction={log.record}
        onFinish={finish}
        result={summary ? { title: "Your score", subtitle: `${summary.score}` } : null}
        onRematch={() => {
          log.reset();
          recorded.current = false;
          setSummary(null);
          setChallenge(null);
          setSeed(makeSeed());
        }}
        onLeave={() => void navigate({ to: "/game/reflexrush" })}
        resultExtra={
          <>
            {summary && (
              <SoloTargetResult gameId="reflexrush" score={summary.score} authed={player.isAuthed} />
            )}
            {challenge ? (
              <ChallengeShare
                gameId="reflexrush"
                code={challenge.code}
                name={player.name}
                score={summary?.score ?? 0}
              />
            ) : (
              <Button variant="hero" disabled={creating} onClick={() => void create()}>
                ⚡ Challenge friends
              </Button>
            )}
          </>
        }
      />
    </GameShell>
  );
}
