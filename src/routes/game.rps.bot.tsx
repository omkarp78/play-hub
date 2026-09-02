import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameShell, PageHeader } from "@/components/layout/AppShell";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { RpsArena } from "@/games/rps/RpsArena";
import { DEFAULT_RPS_SETTINGS } from "@/games/rps/settings";
import {
  botPick,
  createState,
  matchWinner,
  nextRound,
  react as makeReact,
  resolveRound,
  submitPick,
  type BotLevel,
  type Hand,
  type RpsState,
} from "@/games/rps/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/rps/bot")({
  head: () => ({
    meta: [
      { title: "Rock Paper Scissors vs Bot — Pattern-Reading AI" },
      {
        name: "description",
        content:
          "Practice Rock Paper Scissors against an AI that reads your patterns. Easy, medium and hard difficulty.",
      },
      { property: "og:title", content: "Rock Paper Scissors vs Bot" },
      { property: "og:description", content: "Beat an AI that learns your favourite hand." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RpsBot,
});

const LEVELS: { id: BotLevel; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

function RpsBot() {
  const player = usePlayer();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [level, setLevel] = useState<BotLevel>("medium");
  const settings = DEFAULT_RPS_SETTINGS;
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<RpsState>(() => createState());
  const [elapsed, setElapsed] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const winner = matchWinner(state, settings.bestOf);

  // Bot answers once the player has committed.
  useEffect(() => {
    if (!started || winner) return;
    if (!state.locked.P1 || state.locked.P2 || state.revealed) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s.locked.P1 || s.locked.P2 || s.revealed) return s;
        const next = submitPick(s, "P2", botPick(s, "P2", level));
        return resolveRound(next, settings.bestOf);
      });
    }, 700);
    return () => clearTimeout(t);
  }, [started, state, level, settings.bestOf, winner]);

  useEffect(() => {
    if (!winner || recorded.current) return;
    recorded.current = true;
    const outcome = winner === "P1" ? "win" : "loss";
    if (outcome === "win") sfx.victory();
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "rps",
        mode: "bot",
        outcome,
        opponentName: `Bot (${level})`,
        score: state.scores.P1,
        mistakes: state.scores.P2 === 0 ? 0 : 1,
        durationSeconds: elapsed,
      });
    } else {
      guestRecord(outcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner]);

  const reset = () => {
    recorded.current = false;
    setElapsed(0);
    setState(createState());
  };

  if (!started) {
    return (
      <AppShell>
        <PageHeader title="Play With Bot" back="/game/rps" />
        <div className="mx-auto max-w-md rounded-3xl bg-card p-6 soft-card sm:p-8">
          <p className="text-xs uppercase tracking-wide text-muted-foreground">Difficulty</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {LEVELS.map((l) => (
              <Button
                key={l.id}
                size="sm"
                variant={level === l.id ? "hero" : "outline"}
                className="rounded-xl"
                onClick={() => setLevel(l.id)}
              >
                {l.label}
              </Button>
            ))}
          </div>
          <Button
            variant="hero"
            className="mt-6 w-full"
            onClick={() => {
              setState(createState());
              setStarted(true);
            }}
          >
            Start match
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <GameShell>
      <RpsArena
        state={state}
        me="P1"
        meName={player.name}
        oppName={`Bot (${level})`}
        settings={settings}
        thinking={state.locked.P1 && !state.revealed}
        durationSeconds={elapsed}
        onPick={(hand: Hand | null) => setState((s) => submitPick(s, "P1", hand))}
        onReact={(emoji) => setState((s) => makeReact(s, "P1", emoji))}
        onNextRound={() => setState((s) => nextRound(s))}
        onRematch={reset}
        onLeave={() => setStarted(false)}
      />
    </GameShell>
  );
}
