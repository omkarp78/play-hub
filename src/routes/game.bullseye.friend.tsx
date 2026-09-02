import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link2, Users } from "lucide-react";
import { AppShell, GameShell, PageHeader } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuestGate } from "@/components/GuestGate";
import {
  MultiplayerBullseye,
  initialBullseyeRoomState,
} from "@/games/bullseye/MultiplayerBullseye";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";
import { RoomInvite } from "@/components/RoomInvite";

type Search = { code?: string | undefined };

export const Route = createFileRoute("/game/bullseye/friend")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Bullseye Rush With a Friend — Private Room" },
      {
        name: "description",
        content:
          "Create a private Bullseye Rush room, share the code and throw darts head to head.",
      },
      { property: "og:title", content: "Private Bullseye Rush Room" },
      { property: "og:description", content: "Share a room code and duel your friend." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: BullseyeFriend,
});

function BullseyeFriend() {
  const { code: incoming } = Route.useSearch();
  const player = usePlayer();
  const [code, setCode] = useState(incoming ?? "");
  const room = useGameRoom({
    gameId: "bullseye",
    mode: "friend",
    playerId: player.id,
    playerName: player.name,
    initialState: initialBullseyeRoomState() as unknown as Record<string, unknown>,
  });
  const oppName = (room.isHost ? room.room?.guest_name : room.room?.host_name) ?? "Opponent";

  const joined = room.room;
  useEffect(() => {
    if (incoming && player.id && !joined) void room.joinRoom(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, player.id]);

  if (!player.id) {
    return (
      <AppShell>
        <PageHeader title="Play With a Friend" back="/game/bullseye" />
        <GuestGate />
      </AppShell>
    );
  }

  if (joined && !joined.guest_id && room.isHost) {
    return (
      <GameShell>
        <RoomInvite code={joined.code} gameName="Bullseye Rush" onLeave={() => void room.leave()} />
      </GameShell>
    );
  }

  if (joined) {
    return (
      <GameShell>
        <RoomStatus net={room.net} oppName={oppName} />
        {room.net.opponentForfeited && (
          <OpponentLeft oppName={oppName} onLeave={() => void room.leave()} />
        )}
        <MultiplayerBullseye
          room={joined}
          isHost={room.isHost}
          onPatch={room.patchState}
          onLeave={() => void room.leave()}
        />

        {room.room && player.id && (
          <MatchChat
            roomId={room.room.id}
            meId={player.id}
            meName={player.name}
            onRoomEvent={room.onRoomEvent}
            sendRoomEvent={room.sendRoomEvent}
          />
        )}
      </GameShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Play With a Friend" back="/game/bullseye" />
      <div className="grid gap-4">
        <div className="rounded-3xl bg-card p-6 text-center soft-card sm:p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-primary/15 text-primary">
            <Link2 className="size-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold">Create a room</h2>
          <Button variant="hero" className="mt-5 w-full" onClick={() => void room.createRoom()}>
            Create private room
          </Button>
        </div>

        <div className="rounded-3xl bg-card p-6 text-center soft-card sm:p-8">
          <div className="mx-auto grid size-14 place-items-center rounded-2xl bg-accent/15 text-accent">
            <Users className="size-6" />
          </div>
          <h2 className="mt-4 font-display text-xl font-bold">Join a room</h2>
          <div className="mt-6 flex gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD123"
              maxLength={7}
              className="rounded-xl text-center font-display tracking-[0.3em]"
            />
            <Button
              variant="hero"
              disabled={code.length < 4}
              onClick={() => void room.joinRoom(code)}
            >
              Join
            </Button>
          </div>
          {room.error && <p className="mt-3 text-sm text-destructive">{room.error}</p>}
        </div>
      </div>
    </AppShell>
  );
}
