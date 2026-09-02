import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { CricketArena } from "@/games/handcricket/CricketArena";
import { DEFAULT_CRICKET_SETTINGS } from "@/games/handcricket/settings";
import {
  botPick,
  chooseSide,
  createState,
  nextBall,
  react as makeReact,
  resolveBall,
  submitPick,
  type BotLevel,
  type CricketState,
  type Num,
} from "@/games/handcricket/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/handcricket/bot")({
  head: () => ({
    meta: [
      { title: "Hand Cricket vs Bot — Number-Reading AI" },
      {
        name: "description",
        content:
          "Bat and bowl against a Hand Cricket AI that learns your favourite numbers. Easy, medium and hard difficulty.",
      },
      { property: "og:title", content: "Hand Cricket vs Bot" },
      { property: "og:description", content: "Chase a target against a number-reading AI." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CricketBot,
});

const LEVELS: { id: BotLevel; label: string }[] = [
  { id: "easy", label: "Easy" },
  { id: "medium", label: "Medium" },
  { id: "hard", label: "Hard" },
];

function CricketBot() {
  const player = usePlayer();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [level, setLevel] = useState<BotLevel>("medium");
  const settings = DEFAULT_CRICKET_SETTINGS;
  const [started, setStarted] = useState(false);
  const [state, setState] = useState<CricketState>(() => createState());
  const [elapsed, setElapsed] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    if (!started) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started]);

  const finished = state.phase === "done";

  // Bot answers once the player has committed.
  useEffect(() => {
    if (!started || finished) return;
    if (state.phase !== "play") return;
    if (!state.locked.P1 || state.locked.P2 || state.revealed) return;
    const t = setTimeout(() => {
      setState((s) => {
        if (!s.locked.P1 || s.locked.P2 || s.revealed) return s;
        return resolveBall(submitPick(s, "P2", botPick(s, "P2", level)));
      });
    }, 700);
    return () => clearTimeout(t);
  }, [started, state, level, finished]);

  // The bot takes the toss decision when it wins the toss.
  useEffect(() => {
    if (!started || state.phase !== "toss" || state.tossWinner !== "P2") return;
    const t = setTimeout(
      () => setState((s) => chooseSide(s, Math.random() < 0.6 ? "bat" : "bowl")),
      900,
    );
    return () => clearTimeout(t);
  }, [started, state.phase, state.tossWinner]);

  useEffect(() => {
    if (!finished || recorded.current) return;
    recorded.current = true;
    const outcome = state.winner === "tie" ? "draw" : state.winner === "P1" ? "win" : "loss";
    if (outcome === "win") sfx.win();
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "handcricket",
        mode: "bot",
        outcome,
        opponentName: `Bot (${level})`,
        score: state.scores.P1,
        durationSeconds: elapsed,
      });
    } else {
      guestRecord(outcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [finished]);

  const reset = () => {
    recorded.current = false;
    setElapsed(0);
    setState(createState());
  };

  if (!started) {
    return (
      <AppShell>
        <PageHeader title="Play With Bot" back="/game/handcricket" />
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
              reset();
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
      <CricketArena
        state={state}
        me="P1"
        meName={player.name}
        oppName={`Bot (${level})`}
        settings={settings}
        thinking={state.locked.P1 && !state.revealed}
        canChoose={state.tossWinner === "P1"}
        onChoose={(choice) => setState((s) => chooseSide(s, choice))}
        onPick={(num: Num | null) => setState((s) => submitPick(s, "P1", num))}
        onReact={(emoji) => setState((s) => makeReact(s, "P1", emoji))}
        onNextBall={() => setState((s) => nextBall(s))}
        onRematch={reset}
        onLeave={() => setStarted(false)}
      />
    </GameShell>
  );
}
