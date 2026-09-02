import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerReflex, initialReflexRoomState } from "@/games/reflexrush/MultiplayerReflex";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/reflexrush/online")({
  head: () => ({
    meta: [
      { title: "Reflex Rush Online — Ranked Reaction Duels" },
      {
        name: "description",
        content:
          "Race a real opponent through the exact same target sequence. Same 30 seconds, highest score takes the rating.",
      },
      { property: "og:title", content: "Reflex Rush Online" },
      { property: "og:description", content: "Ranked realtime reaction duels." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ReflexRushOnline,
});

function ReflexRushOnline() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "reflexrush",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialReflexRoomState() as unknown as Record<string, unknown>,
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
        <MultiplayerReflex
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
        onBotFallback={() => void navigate({ to: "/game/reflexrush/bot" })}
        onExit={() => void navigate({ to: "/game/reflexrush" })}
      />
    </GameShell>
  );
}
