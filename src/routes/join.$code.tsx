import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { GameShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { getGame } from "@/lib/games";

export const Route = createFileRoute("/join/$code")({
  head: () => ({
    meta: [
      { title: "Join a Private Room — Play With Friends" },
      {
        name: "description",
        content: "Open your invite link to jump straight into a friend's private game room.",
      },
      { property: "og:title", content: "Join a Private Room" },
      { property: "og:description", content: "Your friend is waiting — tap to join the match." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: JoinRoom,
});

function JoinRoom() {
  const { code } = Route.useParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabase
        .from("game_rooms")
        .select("id, code, game_id, status, guest_id, created_at")
        .eq("code", code.toUpperCase())
        .maybeSingle();

      if (!data) {
        setError("This room link is no longer available. Ask your friend for a new one.");
        return;
      }
      if (data.status === "abandoned" || data.status === "finished") {
        setError("This match has already ended. Ask your friend to create a new room.");
        return;
      }
      if (data.guest_id) {
        setError("This room is already full — the game has started without you.");
        return;
      }
      const game = getGame(data.game_id);
      if (!game) {
        setError("That game is not available anymore.");
        return;
      }
      void navigate({
        to: `${game.path}/friend`,
        search: { code: data.code },
      });
    };
    void run();
  }, [code, navigate]);

  return (
    <GameShell>
      <div className="flex flex-1 flex-col items-center justify-center gap-5 px-4 text-center">
        {error ? (
          <>
            <p className="text-4xl">😕</p>
            <h1 className="font-display text-xl font-bold">Room unavailable</h1>
            <p className="max-w-xs text-sm text-muted-foreground">{error}</p>
            <Button asChild variant="hero" className="h-12 w-full max-w-xs">
              <Link to="/">Back to games</Link>
            </Button>
          </>
        ) : (
          <>
            <Loader2 className="size-7 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Joining room {code.toUpperCase()}…</p>
          </>
        )}
      </div>
    </GameShell>
  );
}
