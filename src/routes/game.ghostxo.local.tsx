import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell, GameShell } from "@/components/layout/AppShell";
import { LocalSetup, type LocalNames } from "@/components/local/LocalSetup";
import { MatchStage } from "@/games/ghostxo/MatchStage";
import {
  applyAction,
  createState,
  isOver,
  nextRound as makeNextRound,
  seriesWinner,
  type GxoAction,
} from "@/games/ghostxo/engine";
import { DEFAULT_SETTINGS } from "@/games/ghostxo/settings";
import { recordLocalMatch } from "@/lib/localStats";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/ghostxo/local")({
  head: () => ({
    meta: [
      { title: "Ghost XO Local — Two Players, One Device" },
      {
        name: "description",
        content:
          "Play Ghost XO with a friend on the same phone. No login, no internet — pass the device and move the fading piece.",
      },
      { property: "og:title", content: "Ghost XO Local" },
      { property: "og:description", content: "Offline two-player Ghost XO on one device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalGhost,
});

const SETTINGS = { ...DEFAULT_SETTINGS, timer: 0 };

function LocalGhost() {
  const [names, setNames] = useState<LocalNames | null>(null);
  const [state, setState] = useState(() => createState());
  const recorded = useRef(false);

  if (!names) {
    return (
      <AppShell>
        <LocalSetup
          title="Play Local"
          back="/game/ghostxo"
          onStart={(n) => {
            setState(createState());
            recorded.current = false;
            setNames(n);
          }}
        />
      </AppShell>
    );
  }

  const nameOf = (mark: "X" | "O") => (mark === "X" ? names.p1 : names.p2);
  const me = state.turn;
  const opp = me === "X" ? "O" : "X";
  const over = isOver(state);
  const winner = seriesWinner(state, SETTINGS.bestOf);

  if (winner && !recorded.current) {
    recorded.current = true;
    recordLocalMatch("ghostxo", nameOf(winner));
    sfx.victory();
  }

  const resultTitle = winner
    ? `🏆 ${nameOf(winner)} wins the match`
    : state.drawn
      ? "It's a Draw"
      : state.winner
        ? `${nameOf(state.winner)} wins the round`
        : "";

  return (
    <GameShell>
      <MatchStage
        state={state}
        me={me}
        meName={nameOf(me)}
        oppName={nameOf(opp)}
        myTurn={!over}
        settings={SETTINGS}
        youTag={false}
        resultTitleOverride={over ? resultTitle : undefined}
        onAction={(action: GxoAction) => setState((s) => applyAction(s, action) ?? s)}
        onTimeout={() => undefined}
        onNextRound={() => setState((s) => makeNextRound(s))}
        onRematch={() => {
          recorded.current = false;
          setState(createState());
        }}
        onLeave={() => setNames(null)}
      />
    </GameShell>
  );
}
