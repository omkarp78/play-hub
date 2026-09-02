import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { RoomStatus, OpponentLeft } from "@/components/RoomStatus";
import { GameShell } from "@/components/layout/AppShell";
import { MatchChat } from "@/components/MatchChat";
import { GuestGate } from "@/components/GuestGate";
import { MatchSearch } from "@/components/MatchSearch";
import { MultiplayerBattle, initialRoomState } from "@/games/battlexo/MultiplayerBattle";
import { DEFAULT_SETTINGS } from "@/games/battlexo/settings";
import { useGameRoom } from "@/hooks/useGameRoom";
import { usePlayer } from "@/hooks/useAuth";

export const Route = createFileRoute("/game/battlexo/online")({
  head: () => ({
    meta: [
      { title: "Battle XO Online — Ranked Realtime Matches" },
      {
        name: "description",
        content:
          "Get matched with a random Battle XO opponent for realtime ranked duels with turn timers and best-of series.",
      },
      { property: "og:title", content: "Battle XO Online" },
      { property: "og:description", content: "Ranked realtime matchmaking with live rating." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OnlineBattle,
});

function OnlineBattle() {
  const navigate = useNavigate();
  const player = usePlayer();
  const room = useGameRoom({
    gameId: "battlexo",
    mode: "online",
    playerId: player.id,
    playerName: player.name,
    initialState: initialRoomState(DEFAULT_SETTINGS) as unknown as Record<string, unknown>,
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
        <MultiplayerBattle
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
        onBotFallback={() => void navigate({ to: "/game/battlexo/bot" })}
        onExit={() => void navigate({ to: "/game/battlexo" })}
      />
    </GameShell>
  );
}
