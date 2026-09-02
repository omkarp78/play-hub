import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { MatchStage } from "@/games/battlexo/MatchStage";
import { MatchSetup } from "@/games/battlexo/MatchSetup";
import {
  applyAction,
  botAction,
  createState,
  isOver,
  nextRound as makeNextRound,
  seriesWinner,
  type BxoAction,
  type Difficulty,
} from "@/games/battlexo/engine";
import { DEFAULT_SETTINGS } from "@/games/battlexo/settings";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/battlexo/bot")({
  head: () => ({
    meta: [
      { title: "Battle XO vs Bot — Place, Slide, Outsmart" },
      {
        name: "description",
        content:
          "Play Battle XO against Easy, Medium, Hard or Impossible bots. Three pieces each and sliding moves.",
      },
      { property: "og:title", content: "Battle XO vs Bot" },
      { property: "og:description", content: "Four bot difficulties and best-of series." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BotBattle,
});

function BotBattle() {
  const player = usePlayer();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [started, setStarted] = useState(false);
  const [state, setState] = useState(() => createState());
  const [elapsed, setElapsed] = useState(0);
  const [thinking, setThinking] = useState(false);
  const settled = useRef("");
  const recorded = useRef(false);

  const me = "X" as const;
  const settings = DEFAULT_SETTINGS;
  const over = isOver(state);
  const matchWinner = seriesWinner(state, settings.bestOf);

  useEffect(() => {
    if (!started || matchWinner) return;
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, matchWinner]);

  // bot turn
  useEffect(() => {
    if (!started || state.turn !== "O" || over) return;
    setThinking(true);
    const t = setTimeout(() => {
      const action = botAction(state, difficulty);
      if (action) {
        setState((s) => applyAction(s, action) ?? s);
        if (action.type === "place") sfx.place();
        else sfx.slide();
      }
      setThinking(false);
    }, 420);
    return () => clearTimeout(t);
  }, [state, difficulty, over, started]);

  // round sounds
  useEffect(() => {
    const key = `${state.round}-${state.winner ?? (state.drawn ? "d" : "")}`;
    if (!over || settled.current === key) return;
    settled.current = key;
    if (state.drawn) sfx.draw();
    else if (state.winner === me) sfx.win();
    else sfx.lose();
  }, [state, over]);

  // match result
  useEffect(() => {
    if (!matchWinner || recorded.current) return;
    recorded.current = true;
    const outcome = matchWinner === me ? "win" : "loss";
    if (outcome === "win") sfx.victory();
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "battlexo",
        mode: "bot",
        outcome,
        opponentName: `bot (${difficulty})`,
        score: state.scores.X,
        durationSeconds: elapsed,
      });
    } else {
      guestRecord(outcome);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchWinner]);

  const act = (action: BxoAction) => setState((s) => applyAction(s, action) ?? s);

  const randomOwnAction = (): BxoAction | null => botAction(state, "easy");

  const restart = () => {
    settled.current = "";
    recorded.current = false;
    setElapsed(0);
    setState(createState());
  };

  if (!started) {
    return (
      <GameShell>
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-2 text-center">
          <h1 className="font-display text-2xl font-bold">Bot Duel</h1>
          <div className="w-full max-w-xs">
            <MatchSetup difficulty={difficulty} onChange={setDifficulty} />
          </div>
          <Button
            variant="hero"
            className="h-12 w-full max-w-xs"
            onClick={() => {
              restart();
              setStarted(true);
            }}
          >
            Start Match
          </Button>
        </div>
      </GameShell>
    );
  }

  return (
    <GameShell>
      <MatchStage
        state={state}
        me={me}
        meName={player.name}
        oppName={`Bot (${difficulty})`}
        myTurn={state.turn === "X"}
        thinking={thinking}
        settings={settings}
        durationSeconds={elapsed}
        onAction={act}
        onTimeout={() => {
          const a = randomOwnAction();
          if (a) act(a);
        }}
        onNextRound={() => setState((s) => makeNextRound(s))}
        onRematch={() => restart()}
        onLeave={() => setStarted(false)}
      />
    </GameShell>
  );
}
