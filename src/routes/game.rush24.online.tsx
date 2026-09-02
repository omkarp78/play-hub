import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerRush24, initialRush24RoomState } from "@/games/rush24/MultiplayerRush24";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/rush24/online")({
  head: () => ({
    meta: [
      { title: "24 Rush Online — Ranked Number Duels" },
      {
        name: "description",
        content:
          "Race a real opponent through the same ten 24 Rush puzzles. First to solve them all takes the win and the rating.",
      },
      { property: "og:title", content: "24 Rush Online" },
      { property: "og:description", content: "Ranked realtime number duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Rush24Online,
});

function Rush24Online() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "rush24",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialRush24RoomState() as unknown as Record<string, unknown>,
  });
  const oppName = (room.isHost ? room.room?.guest_name : room.room?.host_name) ?? "Opponent";

  if (!player.id) {
    return (
      <GameShell>
        <GuestGate />
      </GameShell>
    );
  }

  if (room.room?.guest_id) {
    return (
      <GameShell>
        <RoomStatus net={room.net} oppName={oppName} />
        {room.net.opponentForfeited && (
          <OpponentLeft oppName={oppName} onLeave={() => void room.leave()} />
        )}
        <MultiplayerRush24
          room={room.room}
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
    <GameShell>
      <MatchSearch
        room={room}
        onBotFallback={() => void navigate({ to: "/game/rush24/practice" })}
        onExit={() => void navigate({ to: "/game/rush24" })}
      />
    </GameShell>
  );
}
