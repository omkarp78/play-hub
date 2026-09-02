import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Check, Search, Swords, UserMinus, UserPlus, X } from "lucide-react";
import { toast } from "sonner";
import { AppShell, PageHeader } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { notify } from "@/lib/results";

export const Route = createFileRoute("/friends")({
  head: () => ({
    meta: [
      { title: "Friends — Play With Friends" },
      {
        name: "description",
        content: "Search players, send friend requests and challenge your friends to a match.",
      },
      { property: "og:title", content: "Friends — Play With Friends" },
      { property: "og:description", content: "Build your squad and challenge them anytime." },
    ],
  }),
  component: FriendsPage,
});

type MiniProfile = {
  id: string;
  username: string | null;
  avatar_url: string | null;
  rating: number;
  wins: number;
};

function FriendsPage() {
  const { user, profile } = useAuth();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<MiniProfile[]>([]);
  const [friends, setFriends] = useState<MiniProfile[]>([]);
  const [incoming, setIncoming] = useState<{ id: string; sender: MiniProfile }[]>([]);
  const [outgoing, setOutgoing] = useState<string[]>([]);

  const load = useCallback(async () => {
    if (!user) return;
    const { data: friendRows } = await supabase
      .from("friends")
      .select("friend_id")
      .eq("user_id", user.id);
    const ids = (friendRows ?? []).map((r) => r.friend_id);
    if (ids.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, rating, wins")
        .in("id", ids);
      setFriends((data as MiniProfile[]) ?? []);
    } else setFriends([]);

    const { data: reqs } = await supabase
      .from("friend_requests")
      .select("id, sender_id, receiver_id, status")
      .or(`sender_id.eq.${user.id},receiver_id.eq.${user.id}`)
      .eq("status", "pending");

    const incomingIds = (reqs ?? []).filter((r) => r.receiver_id === user.id);
    setOutgoing((reqs ?? []).filter((r) => r.sender_id === user.id).map((r) => r.receiver_id));

    if (incomingIds.length) {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, rating, wins")
        .in(
          "id",
          incomingIds.map((r) => r.sender_id),
        );
      setIncoming(
        incomingIds.map((r) => ({
          id: r.id,
          sender: (data ?? []).find((p) => p.id === r.sender_id) as MiniProfile,
        })),
      );
    } else setIncoming([]);
  }, [user]);

  useEffect(() => {
    void load();
    if (!user) return;
    const channel = supabase
      .channel(`friends-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "friend_requests" },
        () => void load(),
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user, load]);

  useEffect(() => {
    if (query.trim().length < 2) return setResults([]);
    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, username, avatar_url, rating, wins")
        .ilike("username", `%${query.trim().toLowerCase()}%`)
        .limit(10);
      setResults(((data as MiniProfile[]) ?? []).filter((p) => p.id !== user?.id));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, user]);

  const sendRequest = async (target: MiniProfile) => {
    if (!user) return;
    const { error } = await supabase
      .from("friend_requests")
      .insert({ sender_id: user.id, receiver_id: target.id });
    if (error) {
      toast.error("Request already sent or not possible");
      return;
    }
    await notify(
      target.id,
      "friend_request",
      "New friend request",
      `${profile?.username ?? "A player"} wants to be friends`,
      "/friends",
    );
    setOutgoing((o) => [...o, target.id]);
    toast.success(`Request sent to ${target.username}`);
  };

  const respond = async (requestId: string, sender: MiniProfile, accept: boolean) => {
    if (!user) return;
    if (!accept) {
      await supabase.from("friend_requests").update({ status: "rejected" }).eq("id", requestId);
      await load();
      return;
    }

    const { data, error } = await supabase.rpc("accept_friend_request", {
      _request_id: requestId,
    });
    if (error || data !== true) {
      toast.error("Could not accept this request");
      await load();
      return;
    }

    await notify(
      sender.id,
      "friend_accepted",
      "Friend request accepted",
      `${profile?.username ?? "A player"} is now your friend`,
      "/friends",
    );
    toast.success(`You and ${sender.username} are now friends`);
    await load();
  };


  const removeFriend = async (friend: MiniProfile) => {
    if (!user) return;
    await supabase
      .from("friends")
      .delete()
      .or(
        `and(user_id.eq.${user.id},friend_id.eq.${friend.id}),and(user_id.eq.${friend.id},friend_id.eq.${user.id})`,
      );
    await supabase
      .from("friend_requests")
      .delete()
      .or(
        `and(sender_id.eq.${user.id},receiver_id.eq.${friend.id}),and(sender_id.eq.${friend.id},receiver_id.eq.${user.id})`,
      );
    toast.success("Friend removed");
    await load();
  };

  const challenge = async (friend: MiniProfile) => {
    await notify(
      friend.id,
      "challenge",
      "Challenge received",
      `${profile?.username ?? "A player"} challenged you to Tic Tac Toe`,
      "/game/battlexo/friend",
    );
    toast.success(`Challenge sent to ${friend.username}`);
  };

  if (!user) {
    return (
      <AppShell>
        <PageHeader title="Friends" />
        <div className="mx-auto max-w-md rounded-3xl soft-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Sign in to add friends and challenge them.
          </p>
          <Button asChild variant="hero" size="lg" className="mt-5 h-12 w-full">
            <Link to="/register">Create account</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <PageHeader title="Friends" />

      <div className="relative mb-6">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by username…"
          className="h-12 rounded-2xl pl-9"
        />
      </div>

      {results.length > 0 && (
        <div className="mb-8 space-y-2">
          {results.map((p) => (
            <PlayerRow
              key={p.id}
              player={p}
              action={
                friends.some((f) => f.id === p.id) ? (
                  <Badge variant="secondary">Friend</Badge>
                ) : outgoing.includes(p.id) ? (
                  <Badge variant="secondary">Pending</Badge>
                ) : (
                  <Button size="sm" variant="hero" onClick={() => void sendRequest(p)}>
                    <UserPlus className="size-4" /> Add
                  </Button>
                )
              }
            />
          ))}
        </div>
      )}

      <Tabs defaultValue="all">
        <TabsList className="rounded-2xl bg-secondary/50 h-12">
          <TabsTrigger value="all">My friends ({friends.length})</TabsTrigger>
          <TabsTrigger value="requests">Requests ({incoming.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-2">
          {friends.length === 0 && (
            <p className="rounded-2xl soft-card p-8 text-center text-sm text-muted-foreground">
              No friends yet. Search a username above to send your first request.
            </p>
          )}
          {friends.map((f) => (
            <PlayerRow
              key={f.id}
              player={f}
              online
              action={
                <div className="flex gap-2">
                  <Button size="sm" variant="neon" onClick={() => void challenge(f)}>
                    <Swords className="size-4" /> Challenge
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void removeFriend(f)}>
                    <UserMinus className="size-4" />
                  </Button>
                </div>
              }
            />
          ))}
        </TabsContent>

        <TabsContent value="requests" className="mt-4 space-y-2">
          {incoming.length === 0 && (
            <p className="rounded-2xl soft-card p-8 text-center text-sm text-muted-foreground">
              No pending requests.
            </p>
          )}
          {incoming.map((r) => (
            <PlayerRow
              key={r.id}
              player={r.sender}
              action={
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="hero"
                    onClick={() => void respond(r.id, r.sender, true)}
                  >
                    <Check className="size-4" /> Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void respond(r.id, r.sender, false)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              }
            />
          ))}
        </TabsContent>
      </Tabs>
    </AppShell>
  );
}

function PlayerRow({
  player,
  action,
  online,
}: {
  player: MiniProfile;
  action: React.ReactNode;
  online?: boolean;
}) {
  if (!player) return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-center gap-3 rounded-2xl soft-card px-4 py-3"
    >
      <div className="relative">
        <Avatar className="size-10">
          <AvatarImage src={player.avatar_url ?? undefined} />
          <AvatarFallback className="bg-primary/20 text-xs">
            {(player.username ?? "P").slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {online && (
          <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-success" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <Link
          to="/profile/$username"
          params={{ username: player.username ?? "" }}
          className="truncate font-medium hover:underline"
        >
          {player.username}
        </Link>
        <p className="text-xs text-muted-foreground">
          {player.rating} rating · {player.wins} wins
        </p>
      </div>
      {action}
    </motion.div>
  );
}
