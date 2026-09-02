import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell, GameShell } from "@/components/layout/AppShell";
import { LocalSetup, type LocalNames } from "@/components/local/LocalSetup";
import { PassPhone } from "@/components/local/PassPhone";
import { RpsArena } from "@/games/rps/RpsArena";
import { DEFAULT_RPS_SETTINGS } from "@/games/rps/settings";
import {
  createState,
  matchWinner,
  nextRound,
  resolveRound,
  submitPick,
  type Hand,
  type RpsState,
  type Side,
} from "@/games/rps/engine";
import { recordLocalMatch } from "@/lib/localStats";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/rps/local")({
  head: () => ({
    meta: [
      { title: "Rock Paper Scissors Local — Pass & Play" },
      {
        name: "description",
        content:
          "Play Rock Paper Scissors with a friend on one phone. Player 1 picks in secret, pass the device, then both hands reveal.",
      },
      { property: "og:title", content: "Rock Paper Scissors Local" },
      { property: "og:description", content: "Offline pass-and-play Rock Paper Scissors." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalRps,
});

const SETTINGS = DEFAULT_RPS_SETTINGS;

function LocalRps() {
  const [names, setNames] = useState<LocalNames | null>(null);
  const [state, setState] = useState<RpsState>(() => createState());
  const [viewer, setViewer] = useState<Side>("P1");
  const [passTo, setPassTo] = useState<Side | null>(null);
  const recorded = useRef(false);

  const reset = () => {
    recorded.current = false;
    setState(createState());
    setViewer("P1");
    setPassTo(null);
  };

  if (!names) {
    return (
      <AppShell>
        <LocalSetup
          title="Play Local"
          back="/game/rps"
          onStart={(n) => {
            reset();
            setNames(n);
          }}
        />
      </AppShell>
    );
  }

  const nameOf = (side: Side) => (side === "P1" ? names.p1 : names.p2);
  const winner = matchWinner(state, SETTINGS.bestOf);

  if (winner && !recorded.current) {
    recorded.current = true;
    recordLocalMatch("rps", nameOf(winner));
    sfx.victory();
  }

  if (passTo) {
    return (
      <GameShell>
        <PassPhone
          to={nameOf(passTo)}
          onContinue={() => {
            setViewer(passTo);
            setPassTo(null);
          }}
        />
      </GameShell>
    );
  }

  const opp: Side = viewer === "P1" ? "P2" : "P1";
  const roundWinner = state.last?.winner;
  const banner = state.revealed
    ? roundWinner === "draw"
      ? "Round drawn"
      : `${nameOf(roundWinner === "P1" ? "P1" : "P2")} wins the round`
    : `${nameOf(viewer)} — make your choice`;

  return (
    <GameShell>
      <RpsArena
        state={state}
        me={viewer}
        meName={nameOf(viewer)}
        oppName={nameOf(opp)}
        settings={SETTINGS}
        youTag={false}
        hideReactions
        bannerOverride={winner ? undefined : banner}
        resultTitleOverride={winner ? `🏆 ${nameOf(winner)} wins` : undefined}
        onPick={(hand: Hand | null) => {
          setState((s) => {
            const next = submitPick(s, viewer, hand);
            return next.locked.P1 && next.locked.P2 ? resolveRound(next, SETTINGS.bestOf) : next;
          });
          if (viewer === "P1") setPassTo("P2");
        }}
        onReact={() => undefined}
        onNextRound={() => {
          setState((s) => nextRound(s));
          setPassTo("P1");
        }}
        onRematch={reset}
        onLeave={() => setNames(null)}
      />
    </GameShell>
  );
}
