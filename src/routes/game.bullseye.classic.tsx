import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { BullseyeArena } from "@/games/bullseye/BullseyeArena";
import {
  createState,
  isFinished,
  makeSeed,
  throwDart,
  type BullseyeState,
} from "@/games/bullseye/engine";
import { Button } from "@/components/ui/button";
import { ChallengeShare } from "@/components/ChallengeShare";
import { createChallenge, playerKey, type ChallengeRow } from "@/lib/challenges";
import { useActionLog } from "@/lib/scoring/useActionLog";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/bullseye/classic")({
  head: () => ({
    meta: [
      { title: "Bullseye Rush Classic — Score & Challenge Friends" },
      {
        name: "description",
        content:
          "Play a solo Classic round of Bullseye Rush, then share your score as a challenge link with its own private leaderboard.",
      },
      { property: "og:title", content: "Bullseye Rush Classic" },
      { property: "og:description", content: "Six darts, one score, challenge your friends." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BullseyeClassic,
});

function BullseyeClassic() {
  const player = usePlayer();
  const navigate = useNavigate();
  const [seed, setSeed] = useState(() => makeSeed());
  const [state, setState] = useState<BullseyeState>(() => createState(seed));
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [creating, setCreating] = useState(false);
  const log = useActionLog();

  const done = isFinished(state);

  const create = async () => {
    setCreating(true);
    const row = await createChallenge({
      seed,
      creatorKey: playerKey(player.isAuthed ? player.id : null),
      creatorName: player.name,
      actions: log.list(),
    });
    setCreating(false);
    if (row) setChallenge(row);
  };

  return (
    <GameShell>
      <BullseyeArena
        key={seed}
        state={state}
        meName={player.name}
        result={done ? { title: "Your score", subtitle: `${state.score}` } : null}
        onThrow={(x, y) => {
          log.record({ k: `d${state.thrown.length}`, t: "throw", x, y });
          setState((s) => throwDart(s, x, y));
        }}
        onRematch={() => {
          log.reset();
          const next = makeSeed();
          setSeed(next);
          setChallenge(null);
          setState(createState(next));
        }}
        onLeave={() => void navigate({ to: "/game/bullseye" })}
        resultExtra={
          challenge ? (
            <ChallengeShare code={challenge.code} name={player.name} score={state.score} />
          ) : (
            <Button variant="hero" disabled={creating} onClick={() => void create()}>
              🎯 Challenge friends
            </Button>
          )
        }
      />
    </GameShell>
  );
}
