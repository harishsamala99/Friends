import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { SiteLayout } from "@/components/SiteLayout";
import { TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
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
                Matchday {f.matchday}
              </p>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-4 py-10">
            <MatchEditor
              fixture={f}
              homeTeamId={f.home_team_id}
              awayTeamId={f.away_team_id}
              players={(players.data ?? []).filter((p) => p.team_id === f.home_team_id || p.team_id === f.away_team_id)}
              events={events.data ?? []}
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
  homeTeamId,
  awayTeamId,
  players,
  events,
  onSaved,
}: {
  fixture: { id: string; home_score: number | null; away_score: number | null };
  homeTeamId: string;
  awayTeamId: string;
  players: { id: string; name: string; team_id: string | null }[];
  events: { id: string; player_id: string | null; team_id: string | null; event_type: string }[];
  onSaved: () => void;
}) {
  const [homeScore, setHomeScore] = useState(fixture.home_score?.toString() ?? "");
  const [awayScore, setAwayScore] = useState(fixture.away_score?.toString() ?? "");
  const [homePlayerId, setHomePlayerId] = useState("");
  const [awayPlayerId, setAwayPlayerId] = useState("");
  const [homeGoals, setHomeGoals] = useState("1");
  const [awayGoals, setAwayGoals] = useState("1");
  const [homeGKId, setHomeGKId] = useState("");
  const [awayGKId, setAwayGKId] = useState("");
  const [homeSaves, setHomeSaves] = useState("1");
  const [awaySaves, setAwaySaves] = useState("1");
  const [savingScore, setSavingScore] = useState(false);
  const [savingHomeScorer, setSavingHomeScorer] = useState(false);
  const [savingAwayScorer, setSavingAwayScorer] = useState(false);
  const [savingHomeGK, setSavingHomeGK] = useState(false);
  const [savingAwayGK, setSavingAwayGK] = useState(false);

  // Filter players by team
  const homeTeamPlayers = players.filter((p) => p.team_id === homeTeamId);
  const awayTeamPlayers = players.filter((p) => p.team_id === awayTeamId);

  // Filter goalkeepers
  const homeGKs = homeTeamPlayers.filter((p) => p.position?.toLowerCase().includes("goalkeeper"));
  const awayGKs = awayTeamPlayers.filter((p) => p.position?.toLowerCase().includes("goalkeeper"));

  // Aggregate goals by player and team from events
  const goalsByPlayerAndTeam = events
    .filter((e) => e.event_type === "goal" && e.player_id)
    .reduce(
      (acc, event) => {
        const key = `${event.player_id}-${event.team_id}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Aggregate saves by goalkeeper
  const savesByPlayerAndTeam = events
    .filter((e) => e.event_type === "save" && e.player_id)
    .reduce(
      (acc, event) => {
        const key = `${event.player_id}-${event.team_id}`;
        acc[key] = (acc[key] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

  // Group scorers by team
  const homeScorers = homeTeamPlayers.filter((p) => {
    const key = `${p.id}-${homeTeamId}`;
    return goalsByPlayerAndTeam[key];
  });
  const awayScorers = awayTeamPlayers.filter((p) => {
    const key = `${p.id}-${awayTeamId}`;
    return goalsByPlayerAndTeam[key];
  });

  // Group GK saves by team
  const homeGKSaves = homeGKs.filter((p) => {
    const key = `${p.id}-${homeTeamId}`;
    return savesByPlayerAndTeam[key];
  });
  const awayGKSaves = awayGKs.filter((p) => {
    const key = `${p.id}-${awayTeamId}`;
    return savesByPlayerAndTeam[key];
  });

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

  async function saveHomeScorer(): Promise<void> {
    const scorer = homeTeamPlayers.find((player) => player.id === homePlayerId);
    const count = Math.max(1, Math.min(20, Number(homeGoals) || 1));
    if (!scorer) {
      toast.error("Select a home team player");
      return;
    }
    setSavingHomeScorer(true);
    try {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          addEvent({
            fixture_id: fixture.id,
            team_id: scorer.team_id,
            player_id: scorer.id,
            minute: index + 1,
            event_type: "goal",
          }),
        ),
      );
      toast.success(`${scorer.name} added to the score sheet`);
      setHomePlayerId("");
      setHomeGoals("1");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save goal scorer");
    } finally {
      setSavingHomeScorer(false);
    }
  }

  async function saveAwayScorer(): Promise<void> {
    const scorer = awayTeamPlayers.find((player) => player.id === awayPlayerId);
    const count = Math.max(1, Math.min(20, Number(awayGoals) || 1));
    if (!scorer) {
      toast.error("Select an away team player");
      return;
    }
    setSavingAwayScorer(true);
    try {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          addEvent({
            fixture_id: fixture.id,
            team_id: scorer.team_id,
            player_id: scorer.id,
            minute: index + 1,
            event_type: "goal",
          }),
        ),
      );
      toast.success(`${scorer.name} added to the score sheet`);
      setAwayPlayerId("");
      setAwayGoals("1");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save goal scorer");
    } finally {
      setSavingAwayScorer(false);
    }
  }

  async function saveHomeGK(): Promise<void> {
    const gk = homeGKs.find((player) => player.id === homeGKId);
    const count = Math.max(1, Math.min(30, Number(homeSaves) || 1));
    if (!gk) {
      toast.error("Select a home team goalkeeper");
      return;
    }
    setSavingHomeGK(true);
    try {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          addEvent({
            fixture_id: fixture.id,
            team_id: gk.team_id,
            player_id: gk.id,
            minute: index + 1,
            event_type: "save",
          }),
        ),
      );
      toast.success(`${gk.name} saves recorded`);
      setHomeGKId("");
      setHomeSaves("1");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save goalkeeper saves");
    } finally {
      setSavingHomeGK(false);
    }
  }

  async function saveAwayGK(): Promise<void> {
    const gk = awayGKs.find((player) => player.id === awayGKId);
    const count = Math.max(1, Math.min(30, Number(awaySaves) || 1));
    if (!gk) {
      toast.error("Select an away team goalkeeper");
      return;
    }
    setSavingAwayGK(true);
    try {
      await Promise.all(
        Array.from({ length: count }, (_, index) =>
          addEvent({
            fixture_id: fixture.id,
            team_id: gk.team_id,
            player_id: gk.id,
            minute: index + 1,
            event_type: "save",
          }),
        ),
      );
      toast.success(`${gk.name} saves recorded`);
      setAwayGKId("");
      setAwaySaves("1");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save goalkeeper saves");
    } finally {
      setSavingAwayGK(false);
    }
  }

  return (
    <Card className="mb-10">
      <CardHeader>
        <CardTitle>Match editor</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score Input Section */}
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

        {/* Two-sided Goal Scorer Widget */}
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-4 text-sm font-semibold">Add Goal Scorers</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Home Team Section */}
            <div className="space-y-3 rounded-lg border border-border/40 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home Team</h4>
              <label className="space-y-2 text-sm font-medium">
                Player
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={homePlayerId}
                  onChange={(event) => setHomePlayerId(event.target.value)}
                  disabled={homeTeamPlayers.length === 0}
                >
                  <option value="">Select home player</option>
                  {homeTeamPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              {homeTeamPlayers.length === 0 && (
                <span className="text-xs text-muted-foreground">No players available for home team</span>
              )}
              {homeTeamPlayers.length > 0 && (
                <>
                  <label className="space-y-2 text-sm font-medium">
                    Goals
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={homeGoals}
                      onChange={(event) => setHomeGoals(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={saveHomeScorer}
                    disabled={savingHomeScorer || !homePlayerId}
                  >
                    {savingHomeScorer ? "Adding…" : "Add Goal"}
                  </Button>
                </>
              )}
            </div>

            {/* Away Team Section */}
            <div className="space-y-3 rounded-lg border border-border/40 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Away Team</h4>
              <label className="space-y-2 text-sm font-medium">
                Player
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={awayPlayerId}
                  onChange={(event) => setAwayPlayerId(event.target.value)}
                  disabled={awayTeamPlayers.length === 0}
                >
                  <option value="">Select away player</option>
                  {awayTeamPlayers.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name}
                    </option>
                  ))}
                </select>
              </label>
              {awayTeamPlayers.length === 0 && (
                <span className="text-xs text-muted-foreground">No players available for away team</span>
              )}
              {awayTeamPlayers.length > 0 && (
                <>
                  <label className="space-y-2 text-sm font-medium">
                    Goals
                    <Input
                      type="number"
                      min="1"
                      max="20"
                      value={awayGoals}
                      onChange={(event) => setAwayGoals(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={saveAwayScorer}
                    disabled={savingAwayScorer || !awayPlayerId}
                  >
                    {savingAwayScorer ? "Adding…" : "Add Goal"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Two-sided Goalkeeper Saves Widget */}
        <div className="border-t border-border/60 pt-4">
          <h3 className="mb-4 text-sm font-semibold">Add Goalkeeper Saves</h3>
          <div className="grid gap-4 sm:grid-cols-2">
            {/* Home Team Section */}
            <div className="space-y-3 rounded-lg border border-border/40 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home Team Goalkeeper</h4>
              <label className="space-y-2 text-sm font-medium">
                Goalkeeper
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={homeGKId}
                  onChange={(event) => setHomeGKId(event.target.value)}
                  disabled={homeGKs.length === 0}
                >
                  <option value="">Select home goalkeeper</option>
                  {homeGKs.map((gk) => (
                    <option key={gk.id} value={gk.id}>
                      {gk.name}
                    </option>
                  ))}
                </select>
              </label>
              {homeGKs.length === 0 && (
                <span className="text-xs text-muted-foreground">No goalkeepers available for home team</span>
              )}
              {homeGKs.length > 0 && (
                <>
                  <label className="space-y-2 text-sm font-medium">
                    Saves
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={homeSaves}
                      onChange={(event) => setHomeSaves(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={saveHomeGK}
                    disabled={savingHomeGK || !homeGKId}
                  >
                    {savingHomeGK ? "Recording…" : "Record Saves"}
                  </Button>
                </>
              )}
            </div>

            {/* Away Team Section */}
            <div className="space-y-3 rounded-lg border border-border/40 p-3">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Away Team Goalkeeper</h4>
              <label className="space-y-2 text-sm font-medium">
                Goalkeeper
                <select
                  className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                  value={awayGKId}
                  onChange={(event) => setAwayGKId(event.target.value)}
                  disabled={awayGKs.length === 0}
                >
                  <option value="">Select away goalkeeper</option>
                  {awayGKs.map((gk) => (
                    <option key={gk.id} value={gk.id}>
                      {gk.name}
                    </option>
                  ))}
                </select>
              </label>
              {awayGKs.length === 0 && (
                <span className="text-xs text-muted-foreground">No goalkeepers available for away team</span>
              )}
              {awayGKs.length > 0 && (
                <>
                  <label className="space-y-2 text-sm font-medium">
                    Saves
                    <Input
                      type="number"
                      min="1"
                      max="30"
                      value={awaySaves}
                      onChange={(event) => setAwaySaves(event.target.value)}
                    />
                  </label>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={saveAwayGK}
                    disabled={savingAwayGK || !awayGKId}
                  >
                    {savingAwayGK ? "Recording…" : "Record Saves"}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Scorecard Display */}
        {(homeScorers.length > 0 || awayScorers.length > 0) && (
          <div className="border-t border-border/60 pt-4">
            <h3 className="mb-3 text-sm font-semibold">Goal Scorers</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Home Team Scorers */}
              {homeScorers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home Team</h4>
                  <div className="space-y-1">
                    {homeScorers.map((player) => {
                      const key = `${player.id}-${homeTeamId}`;
                      const goalCount = goalsByPlayerAndTeam[key];
                      return (
                        <div key={player.id} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1.5 text-sm">
                          <span className="font-medium">{player.name}</span>
                          <span className="font-semibold tabular-nums text-foreground">{goalCount} goal{goalCount !== 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Away Team Scorers */}
              {awayScorers.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Away Team</h4>
                  <div className="space-y-1">
                    {awayScorers.map((player) => {
                      const key = `${player.id}-${awayTeamId}`;
                      const goalCount = goalsByPlayerAndTeam[key];
                      return (
                        <div key={player.id} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1.5 text-sm">
                          <span className="font-medium">{player.name}</span>
                          <span className="font-semibold tabular-nums text-foreground">{goalCount} goal{goalCount !== 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Goalkeeper Saves Display */}
        {(homeGKSaves.length > 0 || awayGKSaves.length > 0) && (
          <div className="border-t border-border/60 pt-4">
            <h3 className="mb-3 text-sm font-semibold">Goalkeeper Saves</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Home Team Saves */}
              {homeGKSaves.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Home Team</h4>
                  <div className="space-y-1">
                    {homeGKSaves.map((gk) => {
                      const key = `${gk.id}-${homeTeamId}`;
                      const saveCount = savesByPlayerAndTeam[key];
                      return (
                        <div key={gk.id} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1.5 text-sm">
                          <span className="font-medium">{gk.name}</span>
                          <span className="font-semibold tabular-nums text-foreground">{saveCount} save{saveCount !== 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Away Team Saves */}
              {awayGKSaves.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Away Team</h4>
                  <div className="space-y-1">
                    {awayGKSaves.map((gk) => {
                      const key = `${gk.id}-${awayTeamId}`;
                      const saveCount = savesByPlayerAndTeam[key];
                      return (
                        <div key={gk.id} className="flex items-center justify-between rounded-sm bg-muted/40 px-2 py-1.5 text-sm">
                          <span className="font-medium">{gk.name}</span>
                          <span className="font-semibold tabular-nums text-foreground">{saveCount} save{saveCount !== 1 ? "s" : ""}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
