import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { MoveHorizontal } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { MovingCountArena } from "@/games/movingcount/MovingCountArena";
import type { Summary } from "@/games/movingcount/engine";
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

export const Route = createFileRoute("/moving-count/challenge/$code")({
  head: () => ({
    meta: [
      { title: "Moving Count Challenge — Beat This Score" },
      {
        name: "description",
        content:
          "Open a Moving Count challenge link, count the exact same blocks and climb this challenge's private leaderboard. No account needed.",
      },
      { property: "og:title", content: "Can you beat this Moving Count score?" },
      {
        property: "og:description",
        content: "Same blocks, same rules. Enter your name and play.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovingCountChallengePage,
});

function MovingCountChallengePage() {
  const { code } = Route.useParams();
  const player = usePlayer();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { key: meKey } = useChallengeIdentity();
  const att = useChallengeAttempt("movingcount", challenge?.id ?? null, meKey);

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
    async (s: Summary) => {
      setSummary(s);
      if (!challenge) return;
      if (!meKey) return;
      await att.finish(s.score, name.trim() || "Guest", challenge.seed);
      setEntries(await fetchChallengeEntries(challenge.id));
      setSubmitted(true);
    },
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

  if (playing && !expired) {
    return (
      <GameShell>
        <MovingCountArena
          key={`${challenge.seed}-${round}`}
          seed={challenge.seed}
          meName={name.trim() || "You"}
          note={summary ? undefined : "Challenge blocks — same for everyone"}
          onAction={att.record}
          onFinish={(s) => void finish(s)}
          result={summary ? { title: "Round complete", subtitle: `${summary.score}` } : null}
          onLeave={() => void navigate({ to: "/" })}
          resultExtra={
            submitted && summary ? (
              <ChallengeResultPanel
                score={summary.score}
                entries={entries}
                meKey={meKey ?? ""}
                code={challenge.code}
                gameId="movingcount"
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
      title="Moving Count Challenge"
      icon={<MoveHorizontal className="size-6" />}
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
      subtitle="Same blocks, same rules. One attempt only."
      onPlay={() => {
        if (played) return;
        void att.begin().then((a) => {
          if (!a) return;
        setSummary(null);
        setSubmitted(false);
        setRound((r) => r + 1);
        setPlaying(true);
        });
      }}
    />
  );
}
