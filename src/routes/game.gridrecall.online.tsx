import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerGridRecall, initialGridRecallRoomState } from "@/games/gridrecall/MultiplayerGridRecall";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/gridrecall/online")({
  head: () => ({
    meta: [
      { title: "Grid Recall Online — Ranked Memory Duels" },
      {
        name: "description",
        content:
          "Race a real opponent through the exact same Grid Recall board. Same cards, same clock, highest score takes the rating.",
      },
      { property: "og:title", content: "Grid Recall Online" },
      { property: "og:description", content: "Ranked realtime memory duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GridRecallOnline,
});

function GridRecallOnline() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "gridrecall",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialGridRecallRoomState() as unknown as Record<string, unknown>,
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
        <MultiplayerGridRecall
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
        onBotFallback={() => void navigate({ to: "/game/gridrecall/bot" })}
        onExit={() => void navigate({ to: "/game/gridrecall" })}
      />
    </GameShell>
  );
}
