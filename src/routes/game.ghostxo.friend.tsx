import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GuestGate } from "@/components/GuestGate";
import { MultiplayerGhost, initialRoomState } from "@/games/ghostxo/MultiplayerGhost";
import { DEFAULT_SETTINGS } from "@/games/ghostxo/settings";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";
import { RoomInvite } from "@/components/RoomInvite";

type Search = { code?: string | undefined };

export const Route = createFileRoute("/game/ghostxo/friend")({
  validateSearch: (search: Record<string, unknown>): Search => ({
    code: typeof search["code"] === "string" ? search["code"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ghost XO With a Friend — Private Room" },
      {
        name: "description",
        content: "Create a private Ghost XO room and duel your friend in realtime.",
      },
      { property: "og:title", content: "Private Ghost XO Room" },
      { property: "og:description", content: "Share a room code and play instantly." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FriendGhost,
});

function FriendGhost() {
  const { code: incoming } = Route.useSearch();
  const player = usePlayer();
  const [code, setCode] = useState(incoming ?? "");
  const room = useGameRoom({
    gameId: "ghostxo",
    mode: "friend",
    playerId: player.id,
    playerName: player.name,
    initialState: initialRoomState(DEFAULT_SETTINGS) as unknown as Record<string, unknown>,
  });
  const oppName = (room.isHost ? room.room?.guest_name : room.room?.host_name) ?? "Opponent";

  const joined = room.room;
  useEffect(() => {
    if (incoming && player.id && !joined) void room.joinRoom(incoming);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [incoming, player.id]);

  if (!player.id) {
    return (
      <GameShell>
        <GuestGate />
      </GameShell>
    );
  }

  if (joined && !joined.guest_id && room.isHost) {
    return (
      <GameShell>
        <RoomInvite code={joined.code} gameName="Ghost XO" onLeave={() => void room.leave()} />
      </GameShell>
    );
  }

  return (
    <GameShell>
      {!joined ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-2 text-center">
          <Link
            to="/game/ghostxo"
            aria-label="Exit"
            className="absolute left-4 top-4 grid size-11 place-items-center rounded-2xl bg-muted text-foreground active:scale-95"
          >
            <X className="size-5" />
          </Link>
          <h1 className="font-display text-2xl font-bold">Play With a Friend</h1>

          <Button
            variant="hero"
            className="h-12 w-full max-w-xs"
            onClick={() => void room.createRoom()}
          >
            Create room
          </Button>

          <div className="flex w-full max-w-xs gap-2">
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCD123"
              maxLength={7}
              className="h-12 rounded-2xl text-center font-display tracking-[0.3em]"
            />
            <Button
              variant="outline"
              className="h-12"
              disabled={code.length < 4}
              onClick={() => void room.joinRoom(code)}
            >
              Join
            </Button>
          </div>
          {room.error && <p className="text-sm text-destructive">{room.error}</p>}
        </div>
      ) : (
        <>
          <RoomStatus net={room.net} oppName={oppName} />
          {room.net.opponentForfeited && (
            <OpponentLeft oppName={oppName} onLeave={() => void room.leave()} />
          )}
          <MultiplayerGhost
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
        </>
      )}
    </GameShell>
  );
}
