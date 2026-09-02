import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { BullseyeArena } from "@/games/bullseye/BullseyeArena";
import {
  botThrow,
  createState,
  dartsLeft,
  isFinished,
  makeSeed,
  throwDart,
  winnerOf,
  type BotLevel,
  type BullseyeState,
} from "@/games/bullseye/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/bullseye/bot")({
  head: () => ({
    meta: [
      { title: "Bullseye Rush vs Bot — Practice Your Aim" },
      {
        name: "description",
        content:
          "Throw six darts against a bot opponent and sharpen your aim in under two minutes.",
      },
      { property: "og:title", content: "Bullseye Rush vs Bot" },
      { property: "og:description", content: "Six darts against a bot. Highest score wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BullseyeBot,
});

const LEVEL: BotLevel = "medium";

function BullseyeBot() {
  const player = usePlayer();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [seed, setSeed] = useState(() => makeSeed());
  const [mine, setMine] = useState<BullseyeState>(() => createState(seed));
  const [bot, setBot] = useState<BullseyeState>(() => createState(seed));
  const [elapsed, setElapsed] = useState(0);
  const recorded = useRef(false);

  useEffect(() => {
    const t = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);

  // The bot answers each of your darts a beat later.
  useEffect(() => {
    if (isFinished(bot)) return;
    if (mine.thrown.length <= bot.thrown.length) return;
    const t = setTimeout(() => {
      setBot((s) => {
        const { x, y } = botThrow(s, LEVEL);
        return throwDart(s, x, y);
      });
    }, 650);
    return () => clearTimeout(t);
  }, [mine.thrown.length, bot]);

  const bothDone = isFinished(mine) && isFinished(bot);
  const outcome = bothDone ? winnerOf(mine.score, bot.score) : null;

  useEffect(() => {
    if (!outcome || recorded.current) return;
    recorded.current = true;
    const res = outcome === "a" ? "win" : outcome === "draw" ? "draw" : "loss";
    if (res === "win") sfx.victory();
    if (player.isAuthed && player.id) {
      void recordResult({
        userId: player.id,
        gameId: "bullseye",
        mode: "bot",
        outcome: res,
        opponentName: `Bot (${LEVEL})`,
        score: mine.score,
        durationSeconds: elapsed,
      });
    } else {
      guestRecord(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  const reset = () => {
    const next = makeSeed();
    recorded.current = false;
    setSeed(next);
    setElapsed(0);
    setMine(createState(next));
    setBot(createState(next));
  };

  return (
    <GameShell>
      <BullseyeArena
        key={seed}
        state={mine}
        meName={player.name}
        oppName={`Bot (${LEVEL})`}
        oppScore={bot.score}
        oppDarts={dartsLeft(bot)}
        note={isFinished(mine) && !bothDone ? "Bot is throwing…" : undefined}
        result={
          outcome
            ? {
                title:
                  outcome === "draw" ? "It's a tie!" : outcome === "a" ? "🏆 You win!" : "Bot wins",
                subtitle: `${mine.score} : ${bot.score}`,
              }
            : null
        }
        onThrow={(x, y) => setMine((s) => throwDart(s, x, y))}
        onRematch={reset}
        onLeave={() => history.back()}
      />
    </GameShell>
  );
}
