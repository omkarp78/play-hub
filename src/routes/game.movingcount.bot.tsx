import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { MovingCountArena } from "@/games/movingcount/MovingCountArena";
import {
  botTargetScore,
  makeSeed,
  winnerOf,
  type BotLevel,
  type Summary,
} from "@/games/movingcount/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/movingcount/bot")({
  head: () => ({
    meta: [
      { title: "Moving Count vs Bot — Practice Your Tracking" },
      {
        name: "description",
        content:
          "Play a bot on the Moving Count board and sharpen your counting. Casual only — no rating change.",
      },
      { property: "og:title", content: "Moving Count vs Bot" },
      { property: "og:description", content: "Count more accurately than the bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovingCountBot,
});

const LEVEL: BotLevel = "medium";
/** Rough pace of the bot's score climb, in seconds. */
const BOT_STEPS = 60;

function MovingCountBot() {
  const player = usePlayer();
  const navigate = useNavigate();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [seed, setSeed] = useState(() => makeSeed());
  const [target, setTarget] = useState(() => botTargetScore(LEVEL));
  const [botScore, setBotScore] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const recorded = useRef(false);

  // Bot ticks its score up steadily across the game.
  useEffect(() => {
    setBotScore(0);
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setBotScore(Math.round((target * i) / BOT_STEPS));
      if (i >= BOT_STEPS) clearInterval(t);
    }, 1000);
    return () => clearInterval(t);
  }, [seed, target]);

  const outcome = summary ? winnerOf(summary.score, target) : null;

  useEffect(() => {
    if (!outcome || recorded.current || !summary) return;
    recorded.current = true;
    const res = outcome === "a" ? "win" : outcome === "draw" ? "draw" : "loss";
    if (res === "win") sfx.victory();
    if (player.isAuthed && player.id) {
      // Bot matches are casual — recordResult keeps rating untouched for mode "bot".
      void recordResult({
        userId: player.id,
        gameId: "movingcount",
        mode: "bot",
        outcome: res,
        opponentName: `Bot (${LEVEL})`,
        score: summary.score,
      });
    } else {
      guestRecord(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <GameShell>
      <MovingCountArena
        key={seed}
        seed={seed}
        meName={player.name}
        oppName={`Bot (${LEVEL})`}
        oppScore={summary ? target : botScore}
        onFinish={setSummary}
        result={
          outcome && summary
            ? {
                title:
                  outcome === "draw" ? "It's a tie!" : outcome === "a" ? "🏆 You win!" : "Bot wins",
                subtitle: `${summary.score} : ${target}`,
              }
            : null
        }
        onRematch={() => {
          recorded.current = false;
          setSummary(null);
          setTarget(botTargetScore(LEVEL));
          setSeed(makeSeed());
        }}
        onLeave={() => void navigate({ to: "/game/movingcount" })}
      />
    </GameShell>
  );
}
