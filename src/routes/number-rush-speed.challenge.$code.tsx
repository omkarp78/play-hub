import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { Hash } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { SpeedArena } from "@/games/numberrush/SpeedArena";
import { formatSpeedScore, type SpeedResult } from "@/games/numberrush/speedrun";
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

export const Route = createFileRoute("/number-rush-speed/challenge/$code")({
  head: () => ({
    meta: [
      { title: "Number Rush Speed Run Challenge — Beat This Time" },
      {
        name: "description",
        content:
          "Open a Number Rush Speed Run challenge link, solve the exact same 11 questions and try to post a faster time. One attempt, no account needed.",
      },
      { property: "og:title", content: "Can you beat this Speed Run time?" },
      {
        property: "og:description",
        content: "Same 11 questions. One attempt. Fastest accurate run wins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SpeedChallengePage,
});

function SpeedChallengePage() {
  const { code } = Route.useParams();
  const player = usePlayer();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [challenge, setChallenge] = useState<ChallengeRow | null>(null);
  const [entries, setEntries] = useState<ChallengeEntry[]>([]);
  const [name, setName] = useState("");
  const [playing, setPlaying] = useState(false);
  const [round, setRound] = useState(0);
  const [result, setResult] = useState<SpeedResult | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const { key: meKey } = useChallengeIdentity();
  const att = useChallengeAttempt("numberrushspeed", challenge?.id ?? null, meKey);

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
    async (r: SpeedResult) => {
      setResult(r);
      if (!challenge) return;
      if (!meKey) return;
      await att.finish(r.score, name.trim() || "Guest", challenge.seed);
      setEntries(await fetchChallengeEntries(challenge.id));
      setSubmitted(true);
    },
    [challenge, name, meKey],
  );

  if (loading) {
    return (
      <AppShell>
        <PageHeader title="Speed Run Challenge" back="/" />
        <p className="text-center text-sm text-muted-foreground">Loading challenge…</p>
      </AppShell>
    );
  }

  if (!challenge) {
    return (
      <AppShell>
        <PageHeader title="Speed Run Challenge" back="/" />
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
        <SpeedArena
          key={`${challenge.seed}-${round}`}
          seed={challenge.seed}
          meName={name.trim() || "You"}
          note={result ? undefined : "Challenge questions — same for everyone"}
          onAction={att.record}
          onFinish={(r) => void finish(r)}
          onLeave={() => void navigate({ to: "/" })}
          resultExtra={
            submitted && result ? (
              <ChallengeResultPanel
                score={result.score}
                entries={entries}
                meKey={meKey ?? ""}
                code={challenge.code}
                gameId="numberrushspeed"
                playerName={name.trim() || "A player"}
                formatScore={formatSpeedScore}
              />
            ) : null
          }
        />
      </GameShell>
    );
  }

  return (
    <ChallengeIntro
      title="Speed Run Challenge"
      icon={<Hash className="size-6" />}
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
      formatScore={formatSpeedScore}
      subtitle="Same 11 questions. One attempt — fastest accurate run wins."
      onPlay={() => {
        if (played) return;
        void att.begin().then((a) => {
          if (!a) return;
        setResult(null);
        setSubmitted(false);
        setRound((r) => r + 1);
        setPlaying(true);
        });
      }}
    />
  );
}
