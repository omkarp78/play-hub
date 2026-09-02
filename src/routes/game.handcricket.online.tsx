import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import {
  MultiplayerCricket,
  initialCricketRoomState,
} from "@/games/handcricket/MultiplayerCricket";
import { DEFAULT_CRICKET_SETTINGS } from "@/games/handcricket/settings";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/handcricket/online")({
  head: () => ({
    meta: [
      { title: "Hand Cricket Online — Realtime Matches" },
      {
        name: "description",
        content: "Get matched instantly for realtime Hand Cricket — bat, bowl and chase live.",
      },
      { property: "og:title", content: "Hand Cricket Online" },
      { property: "og:description", content: "Realtime matchmaking, 1–3 minute matches." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CricketOnline,
});

function CricketOnline() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "handcricket",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialCricketRoomState(DEFAULT_CRICKET_SETTINGS) as unknown as Record<
      string,
      unknown
    >,
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
        <MultiplayerCricket
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
        onBotFallback={() => void navigate({ to: "/game/handcricket/bot" })}
        onExit={() => void navigate({ to: "/game/handcricket" })}
      />
    </GameShell>
  );
}
