import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { GameShell } from "@/components/layout/AppShell";
import { NumberArena } from "@/games/numberrush/NumberArena";
import {
  DEFAULT_DURATION,
  botTargetScore,
  makeSeed,
  winnerOf,
  type BotLevel,
  type Summary,
} from "@/games/numberrush/engine";
import { usePlayer } from "@/hooks/useAuth";
import { useGuestStore } from "@/lib/identity";
import { recordResult } from "@/lib/results";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/numberrush/bot")({
  head: () => ({
    meta: [
      { title: "Number Rush vs Bot — Practice Your Speed" },
      {
        name: "description",
        content:
          "Race a bot through 30 seconds of quick mental math and sharpen your reaction speed.",
      },
      { property: "og:title", content: "Number Rush vs Bot" },
      { property: "og:description", content: "30 seconds of math against a bot." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NumberRushBot,
});

const LEVEL: BotLevel = "medium";

function NumberRushBot() {
  const player = usePlayer();
  const navigate = useNavigate();
  const guestRecord = useGuestStore((s) => s.recordResult);
  const [seed, setSeed] = useState(() => makeSeed());
  const [target, setTarget] = useState(() => botTargetScore(LEVEL));
  const [botScore, setBotScore] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const recorded = useRef(false);

  // Bot ticks its score up steadily across the round.
  useEffect(() => {
    setBotScore(0);
    const steps = DEFAULT_DURATION;
    let i = 0;
    const t = setInterval(() => {
      i += 1;
      setBotScore(Math.round((target * i) / steps));
      if (i >= steps) clearInterval(t);
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
      void recordResult({
        userId: player.id,
        gameId: "numberrush",
        mode: "bot",
        outcome: res,
        opponentName: `Bot (${LEVEL})`,
        score: summary.score,
        durationSeconds: DEFAULT_DURATION,
      });
    } else {
      guestRecord(res);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <GameShell>
      <NumberArena
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
        onLeave={() => void navigate({ to: "/game/numberrush" })}
      />
    </GameShell>
  );
}
