import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell, GameShell } from "@/components/layout/AppShell";
import { LocalSetup, type LocalNames } from "@/components/local/LocalSetup";
import { MatchStage } from "@/games/battlexo/MatchStage";
import {
  applyAction,
  createState,
  isOver,
  nextRound as makeNextRound,
  seriesWinner,
  type BxoAction,
} from "@/games/battlexo/engine";
import { DEFAULT_SETTINGS } from "@/games/battlexo/settings";
import { recordLocalMatch } from "@/lib/localStats";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/battlexo/local")({
  head: () => ({
    meta: [
      { title: "Battle XO Local — Two Players, One Device" },
      {
        name: "description",
        content:
          "Play Battle XO with a friend on the same phone. No login, no internet — just pass the device and play.",
      },
      { property: "og:title", content: "Battle XO Local" },
      { property: "og:description", content: "Offline two-player Battle XO on one device." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalBattle,
});

const SETTINGS = { ...DEFAULT_SETTINGS, timer: 0 };

function LocalBattle() {
  const [names, setNames] = useState<LocalNames | null>(null);
  const [state, setState] = useState(() => createState());
  const recorded = useRef(false);

  if (!names) {
    return (
      <AppShell>
        <LocalSetup
          title="Play Local"
          back="/game/battlexo"
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
    recordLocalMatch("battlexo", nameOf(winner));
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
        onAction={(action: BxoAction) => setState((s) => applyAction(s, action) ?? s)}
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
