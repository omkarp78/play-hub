import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calculator } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { Rush24Arena } from "@/games/rush24/Rush24Arena";
import { ROUNDS, formatSeconds, pointsOf, type RushSummary } from "@/games/rush24/engine";
import { serverSource } from "@/games/rush24/source";
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

export const Route = createFileRoute("/rush-24/challenge/$code")({
  head: () => ({
    meta: [
      { title: "24 Rush Challenge — Beat This Time" },
      {
        name: "description",
        content:
          "Open a 24 Rush challenge link, solve the exact same ten puzzles and climb this challenge's private leaderboard. No account needed.",
      },
      { property: "og:title", content: "Can you beat this 24 Rush time?" },
      { property: "og:description", content: "Same ten puzzles. One attempt. Fastest wins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rush24ChallengePage,
});

function Rush24ChallengePage() {
  const { code } = Route.useParams();
  const player = usePlayer();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [summary, setSummary] = useState<RushSummary | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { key: meKey } = useChallengeIdentity();
  const att = useChallengeAttempt("rush24", challenge?.id ?? null, meKey);
  const attemptId = att.attempt.attemptId;

  const source = useMemo(
    () => (attemptId && meKey ? serverSource(attemptId, meKey) : null),
    [attemptId, meKey],
  );

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

  const finish = useCallback(
    async (s: RushSummary) => {
      setSummary(s);
      if (!challenge || !meKey) return;
      await att.finish(s.score, name.trim() || "Guest", challenge.seed);
      setEntries(await fetchChallengeEntries(challenge.id));
      setSubmitted(true);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [challenge, name, meKey],
  );

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

  if (playing && source && attemptId && !expired) {
    return (
      <GameShell>
        <Rush24Arena
          key={attemptId}
          source={source}
          meName={name.trim() || "You"}
          note={summary ? undefined : "Challenge puzzles — same for everyone"}
          onFinish={(s) => void finish(s)}
          result={summary ? { title: "🎉 Finished!", subtitle: formatSeconds(summary.ms) } : null}
          onLeave={() => void navigate({ to: "/" })}
          resultExtra={
            submitted && summary ? (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Stat label="Correct" value={`${summary.correct} / ${ROUNDS}`} />
                  <Stat label="Score" value={`${pointsOf(summary.correct, summary.ms)}`} />
                </div>
                <ChallengeResultPanel
                  score={summary.score}
                  entries={entries}
                  meKey={meKey ?? ""}
                  code={challenge.code}
                  gameId="rush24"
                  playerName={name.trim() || "A player"}
                />
              </>
            ) : null
          }
        />
      </GameShell>
    );
  }

  return (
    <ChallengeIntro
      title="24 Rush Challenge"
      icon={<Calculator className="size-6" />}
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
      subtitle="Same ten puzzles. One attempt only."
      onPlay={() => {
        if (played) return;
        void att.begin().then((a) => {
          if (!a) return;
          setSummary(null);
          setSubmitted(false);
          setPlaying(true);
        });
      }}
    />
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-secondary/60 px-3 py-3">
      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-lg font-bold">{value}</p>
    </div>
  );
}
