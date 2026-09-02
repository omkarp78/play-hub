import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerMovingCount, initialMovingCountRoomState } from "@/games/movingcount/MultiplayerMovingCount";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/movingcount/online")({
  head: () => ({
    meta: [
      { title: "Moving Count Online — Ranked Counting Duels" },
      {
        name: "description",
        content:
          "Face a real opponent on the exact same Moving Count board. Same blocks, same sweeps, highest score takes the rating.",
      },
      { property: "og:title", content: "Moving Count Online" },
      { property: "og:description", content: "Ranked realtime counting duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MovingCountOnline,
});

function MovingCountOnline() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "movingcount",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialMovingCountRoomState() as unknown as Record<string, unknown>,
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
        <MultiplayerMovingCount
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
        onBotFallback={() => void navigate({ to: "/game/movingcount/bot" })}
        onExit={() => void navigate({ to: "/game/movingcount" })}
      />
    </GameShell>
  );
}
