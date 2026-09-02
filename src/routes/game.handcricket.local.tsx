import { createFileRoute } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { AppShell, GameShell } from "@/components/layout/AppShell";
import { LocalSetup, type LocalNames } from "@/components/local/LocalSetup";
import { PassPhone } from "@/components/local/PassPhone";
import { CricketArena } from "@/games/handcricket/CricketArena";
import { DEFAULT_CRICKET_SETTINGS } from "@/games/handcricket/settings";
import {
  chooseSide,
  createState,
  nextBall,
  resolveBall,
  submitPick,
  type CricketState,
  type Num,
  type Side,
} from "@/games/handcricket/engine";
import { recordLocalMatch } from "@/lib/localStats";
import { sfx } from "@/lib/sound";

export const Route = createFileRoute("/game/handcricket/local")({
  head: () => ({
    meta: [
      { title: "Hand Cricket Local — Pass & Play" },
      {
        name: "description",
        content:
          "Play Hand Cricket with a friend on one phone. Pick in secret, pass the device, then reveal the ball.",
      },
      { property: "og:title", content: "Hand Cricket Local" },
      { property: "og:description", content: "Offline pass-and-play Hand Cricket." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LocalCricket,
});

const SETTINGS = DEFAULT_CRICKET_SETTINGS;

function LocalCricket() {
  const [names, setNames] = useState<LocalNames | null>(null);
  const [state, setState] = useState<CricketState>(() => createState());
  const [viewer, setViewer] = useState<Side>("P1");
  const [passTo, setPassTo] = useState<Side | null>(null);
  const recorded = useRef(false);

  const reset = () => {
    recorded.current = false;
    const fresh = createState();
    setState(fresh);
    setViewer(fresh.tossWinner);
    setPassTo(null);
  };

  if (!names) {
    return (
      <AppShell>
        <LocalSetup
          title="Play Local"
          back="/game/handcricket"
          onStart={(n) => {
            reset();
            setNames(n);
          }}
        />
      </AppShell>
    );
  }

  const nameOf = (side: Side) => (side === "P1" ? names.p1 : names.p2);
  const done = state.phase === "done";

  if (done && !recorded.current) {
    recorded.current = true;
    recordLocalMatch("handcricket", state.winner === "tie" ? null : nameOf(state.winner as Side));
    if (state.winner !== "tie") sfx.victory();
  }

  if (passTo) {
    return (
      <GameShell>
        <PassPhone
          to={nameOf(passTo)}
          hint={
            state.phase === "toss"
              ? "They won the toss — let them choose."
              : "Don't peek — the other number stays hidden."
          }
          onContinue={() => {
            setViewer(passTo);
            setPassTo(null);
          }}
        />
      </GameShell>
    );
  }

  const opp: Side = viewer === "P1" ? "P2" : "P1";
  const banner =
    state.phase === "toss"
      ? `${nameOf(state.tossWinner)} won the toss — bat or bowl?`
      : state.revealed
        ? state.last?.out
          ? `${nameOf(state.last.batting)} is out!`
          : `${state.last?.runs} run${state.last?.runs === 1 ? "" : "s"} for ${nameOf(state.batting)}`
        : `${nameOf(viewer)} — ${state.batting === viewer ? "bat: pick a number" : "bowl: guess their number"}`;

  const resultTitle =
    state.winner === "tie" ? "It's a Draw" : `🏆 ${nameOf(state.winner as Side)} wins`;

  return (
    <GameShell>
      <CricketArena
        state={state}
        me={viewer}
        meName={nameOf(viewer)}
        oppName={nameOf(opp)}
        settings={SETTINGS}
        youTag={false}
        hideReactions
        canChoose={state.tossWinner === viewer}
        bannerOverride={done ? undefined : banner}
        resultTitleOverride={done ? resultTitle : undefined}
        onChoose={(choice) => {
          setState((s) => chooseSide(s, choice));
          if (viewer !== "P1") setPassTo("P1");
        }}
        onPick={(num: Num | null) => {
          setState((s) => {
            const next = submitPick(s, viewer, num);
            return next.locked.P1 && next.locked.P2 ? resolveBall(next) : next;
          });
          if (viewer === "P1") setPassTo("P2");
        }}
        onReact={() => undefined}
        onNextBall={() => {
          setState((s) => nextBall(s));
          setPassTo("P1");
        }}
        onRematch={reset}
        onLeave={() => setNames(null)}
      />
    </GameShell>
  );
}
