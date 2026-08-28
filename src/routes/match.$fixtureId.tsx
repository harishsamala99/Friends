import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EVENT_TYPES, addEvent, fetchEvents, fetchFixture, fetchPlayers, fetchTeams, updateFixture } from "@/lib/football";

export const Route = createFileRoute("/match/$fixtureId")({
  head: () => ({
    meta: [
      { title: "Match Centre — FRIENDS LEAGUE" },
      { name: "description", content: "Live match centre with score, timeline of goals and cards." },
      { property: "og:title", content: "Match Centre — FRIENDS LEAGUE" },
      { property: "og:description", content: "Score, goals, assists and cards for this fixture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
  errorComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState message="This match could not be loaded." />
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState message="Match not found." />
      </div>
    </SiteLayout>
  ),
});

function MatchPage() {
  const { fixtureId } = Route.useParams();
  const fixture = useQuery({ queryKey: ["fixture", fixtureId], queryFn: () => fetchFixture(fixtureId) });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const events = useQuery({ queryKey: ["events", fixtureId], queryFn: () => fetchEvents(fixtureId) });

  const f = fixture.data;
  const byId = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]));
  const home = f ? byId.get(f.home_team_id) : undefined;
  const away = f ? byId.get(f.away_team_id) : undefined;

  return (
    <SiteLayout>
      {fixture.isLoading ? (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ListSkeleton rows={4} />
        </div>
      ) : !f ? (
        <div className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState message="Match not found." />
        </div>
      ) : (
        <>
          <section className="pitch-gradient text-pitch-foreground">
            <div className="mx-auto max-w-4xl px-4 py-12 text-center">
              <Badge className="mb-4">{f.status}</Badge>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex flex-1 flex-col items-center gap-2">
                  {home && <TeamBadge team={home} size={56} />}
                  <span className="text-sm font-semibold sm:text-lg">{home?.name}</span>
                </div>
                <div className="font-display text-4xl font-bold tabular-nums sm:text-6xl">
                  {f.home_score ?? 0} : {f.away_score ?? 0}
                </div>
                <div className="flex flex-1 flex-col items-center gap-2">
                  {away && <TeamBadge team={away} size={56} />}
                  <span className="text-sm font-semibold sm:text-lg">{away?.name}</span>
                </div>
              </div>
              <p className="mt-6 text-sm opacity-80">
                Matchday {f.matchday} · {formatKickoff(f.kickoff)}
                {f.venue ? ` · ${f.venue}` : ""}
              </p>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-4 py-10">
            <MatchEditor
              fixture={f}
              players={(players.data ?? []).filter((p) => p.team_id === f.home_team_id || p.team_id === f.away_team_id)}
              onSaved={() => {
                void fixture.refetch();
                void events.refetch();
              }}
            />
            <h2 className="mb-4 font-display text-2xl font-bold">Timeline</h2>
            {(events.data ?? []).length === 0 ? (
              <EmptyState message="No match events recorded." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(events.data ?? []).map((e) => {
                    const meta = EVENT_TYPES.find((t) => t.value === e.event_type);
                    const player = e.player_id ? playerById.get(e.player_id) : undefined;
                    const team = e.team_id ? byId.get(e.team_id) : undefined;
                    return (
                      <div key={e.id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
                        <span className="w-10 text-sm font-semibold tabular-nums text-muted-foreground">
                          {e.minute}'
                        </span>
                        <span aria-hidden>{meta?.icon ?? "•"}</span>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{player?.name ?? meta?.label}</span>
                          {player && <span className="text-muted-foreground"> — {meta?.label}</span>}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">{team?.name}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </SiteLayout>
  );
}

function MatchEditor({
  fixture,
  players,
  onSaved,
}: {
  fixture: { id: string; home_score: number | null; away_score: number | null };
  players: { id: string; name: string; team_id: string | null }[];
  onSaved: () => void;
}) {
  const [homeScore, setHomeScore] = useState(fixture.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(fixture.away_score?.toString() ?? "");
  const [scorerId, setScorerId] = useState("");
  const [goals, setGoals] = useState("1");
  const [savingScore, setSavingScore] = useState(false);
  const [savingScorer, setSavingScorer] = useState(false);

  async function saveScore() {
    if (homeScore === "" || awayScore === "") {
      toast.error("Enter both the home and away scores before saving.");
      return;
    }
    setSavingScore(true);
    try {
      await updateFixture(fixture.id, {
        home_score: Number(homeScore),
        away_score: Number(awayScore),
        status: "Full Time",
      });
      toast.success("Match score saved");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save score");
    } finally {
      setSavingScore(false);
    }
  }

  async function saveScorer() {
    const scorer = players.find((player) => player.id === scorerId);
    const count = Math.max(1, Math.min(20, Number(goals) || 1));
    if (!scorer) return toast.error("Choose a goal scorer");
    setSavingScorer(true);
    try {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          addEvent({ fixture_id: fixture.id, team_id: scorer.team_id, player_id: scorer.id, minute: index + 1, event_type: "goal" }),
        ),
      );
      if (homeScore !== "" && awayScore !== "") {
        await updateFixture(fixture.id, {
          home_score: Number(homeScore),
          away_score: Number(awayScore),
          status: "Full Time",
        });
      }
      toast.success(`${scorer.name} added to the score sheet`);
      setScorerId("");
      setGoals("1");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save goal scorer");
    } finally {
      setSavingScorer(false);
    }
  }

  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle>Match editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_1fr_auto] sm:items-end">
          <label className="space-y-2 text-sm font-medium">
            Home score
            <Input type="number" min="0" value={homeScore} onChange={(event) => setHomeScore(event.target.value)} />
          </label>
          <span className="hidden pb-2 text-muted-foreground sm:block">-</span>
          <label className="space-y-2 text-sm font-medium">
            Away score
            <Input type="number" min="0" value={awayScore} onChange={(event) => setAwayScore(event.target.value)} />
          </label>
          <Button onClick={saveScore} disabled={savingScore || homeScore === "" || awayScore === ""}>
            {savingScore ? "Saving…" : "Save score"}
          </Button>
        </div>
        <div className="flex flex-wrap items-end gap-3 border-t border-border/60 pt-4">
          <label className="min-w-52 space-y-2 text-sm font-medium">
            Goal scorer
            <select className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" value={scorerId} onChange={(event) => setScorerId(event.target.value)}>
              <option value="">Select player</option>
              {players.map((player) => (
                <option key={player.id} value={player.id}>{player.name}</option>
              ))}
            </select>
          </label>
          <label className="w-24 space-y-2 text-sm font-medium">
            Goals
            <Input type="number" min="1" max="20" value={goals} onChange={(event) => setGoals(event.target.value)} />
          </label>
          <Button variant="outline" onClick={saveScorer} disabled={savingScorer || players.length === 0}>
            {savingScorer ? "Saving…" : "Add goals"}
          </Button>
          {players.length === 0 && <span className="text-sm text-muted-foreground">Add players to either team first.</span>}
        </div>
      </CardContent>
    </Card>
  );
}
