import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerNumber, initialNumberRoomState } from "@/games/numberrush/MultiplayerNumber";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/numberrush/online")({
  head: () => ({
    meta: [
      { title: "Number Rush Online — Ranked Mental Math Duels" },
      {
        name: "description",
        content:
          "Race a real opponent through the exact same math questions. Same time, same board, highest score wins the rating.",
      },
      { property: "og:title", content: "Number Rush Online" },
      { property: "og:description", content: "Ranked realtime mental-math duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: NumberRushOnline,
});

function NumberRushOnline() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "numberrush",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialNumberRoomState() as unknown as Record<string, unknown>,
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
        <MultiplayerNumber
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
        onBotFallback={() => void navigate({ to: "/game/numberrush/bot" })}
        onExit={() => void navigate({ to: "/game/numberrush" })}
      />
    </GameShell>
  );
}
