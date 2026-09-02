import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Target } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { BullseyeArena } from "@/games/bullseye/BullseyeArena";
import { createState, isFinished, throwDart, type BullseyeState } from "@/games/bullseye/engine";
import { ChallengeIntro, ChallengeResultPanel } from "@/components/ChallengeScreens";
import {
  fetchChallenge,
  fetchChallengeEntries,
  isExpired,
  type ChallengeEntry,
  type ChallengeRow,
} from "@/lib/challenges";
import { usePlayer } from "@/hooks/useAuth";
import { useChallengeIdentity } from "@/hooks/useChallengeIdentity";
import { useChallengeAttempt } from "@/hooks/useChallengeAttempt";
import { toast } from "sonner";

export const Route = createFileRoute("/bullseye/challenge/$code")({
  head: () => ({
    meta: [
      { title: "Bullseye Rush Challenge — Beat This Score" },
      {
        name: "description",
        content:
          "Open a Bullseye Rush challenge link, play the exact same board and climb this challenge's private leaderboard. No account needed.",
      },
      { property: "og:title", content: "Can you beat this Bullseye Rush score?" },
      { property: "og:description", content: "Same board, same darts. Enter your name and play." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ChallengePage,
});

function ChallengePage() {
  const { code } = Route.useParams();
  const player = usePlayer();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [name, setName] = useState("");
  const [state, setState] = useState<BullseyeState | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { key: meKey } = useChallengeIdentity();
  const att = useChallengeAttempt("bullseye", challenge?.id ?? null, meKey);
  const posted = useRef(false);

  useEffect(() => {
    if (!meKey) return;
    let active = true;
    void (async () => {
      const row = await fetchChallenge(code);
      if (!active) return;
      setChallenge(row);
      if (row) {
        const list = await fetchChallengeEntries(row.id);
        if (!active) return;
        setEntries(list);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [code, meKey]);

  useEffect(() => {
    if (player.isAuthed && player.name && !name) setName(player.name);
  }, [player.name, player.isAuthed, name]);

  const finished = state ? isFinished(state) : false;

  const submit = useCallback(async () => {
    if (!challenge || !state || !meKey) return;
    await att.finish(state.score, name.trim() || "Guest", challenge.seed);
    setEntries(await fetchChallengeEntries(challenge.id));
    setSubmitted(true);
  }, [challenge, state, name, meKey, att]);

  useEffect(() => {
    if (!finished || posted.current) return;
    posted.current = true;
    void submit();
  }, [finished, submit]);

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Challenge" back="/" />
        <p className="text-center text-sm text-muted-foreground">Loading challenge…</p>
      </AppShell>
    );
  }

  if (!challenge) {
    return (
      <AppShell>
        <PageHeader title="Challenge" back="/" />
        <div className="rounded-3xl bg-card p-6 text-center soft-card">
          <h1 className="font-display text-xl font-bold">This challenge has ended.</h1>
          <p className="mt-1 text-sm text-muted-foreground">The link is no longer available.</p>
        </div>
      </AppShell>
    );
  }

  const expired = isExpired(challenge);
  const played = att.done || entries.some((e) => e.player_key === meKey);

  // Playing: show only the game, never the leaderboard.
  if (state && !expired) {
    return (
      <GameShell>
        <BullseyeArena
          key={challenge.seed + (submitted ? "-done" : "")}
          state={state}
          meName={name.trim() || "You"}
          note="Challenge board — same for everyone"
          result={finished ? { title: "Round complete", subtitle: `${state.score}` } : null}
          onThrow={(x, y) => {
            att.record({ k: `d${state.thrown.length}`, t: "throw", x, y });
            setState((s) => (s ? throwDart(s, x, y) : s));
          }}
          onLeave={() => void navigate({ to: "/" })}
          resultExtra={
            submitted ? (
              <ChallengeResultPanel
                score={state.score}
                entries={entries}
                meKey={meKey ?? ""}
                code={challenge.code}
                gameId="bullseye"
                playerName={name.trim() || "A player"}
              />
            ) : null
          }
        />
      </GameShell>
    );
  }

  return (
    <ChallengeIntro
      title="Bullseye Challenge"
      icon={<Target className="size-6" />}
      challenge={challenge}
      entries={entries}
      meKey={meKey ?? ""}
      expired={expired}
      name={name}
      onNameChange={setName}
      authed={player.isAuthed}
      played={played}
      resume={att.live}
      busy={att.starting}
      expiredAttempt={att.expired}
      subtitle="Same board, same six darts. One attempt — can you beat it?"
      onPlay={() => {
        if (played) return;
        void att.begin().then((a) => {
          if (!a) return;
        posted.current = false;
        setSubmitted(false);
        setState(createState(challenge.seed));
        });
      }}
    />
  );
}

