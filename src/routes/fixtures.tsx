import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { fetchFixtures, fetchTeams, fetchTournaments, type Team, type Tournament } from "@/lib/football";

export const Route = createFileRoute("/fixtures")({
  head: () => ({
    meta: [
      { title: "Fixtures & Results — FRIENDS LEAGUE" },
      { name: "description", content: "Scheduled fixtures and completed results by tournament." },
      { property: "og:title", content: "Fixtures & Results — FRIENDS LEAGUE" },
      { property: "og:description", content: "Scheduled fixtures and completed results by tournament." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FixturesPage,
});

function FixturesPage() {
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList: Tournament[] = Array.isArray(tournaments.data) ? tournaments.data : [];
  const selectedTournament = tournamentList.find((tournament) => tournament.id === tournamentId);
  const fixtures = useQuery({
    queryKey: ["fixtures", tournamentId],
    queryFn: () => fetchFixtures(undefined, tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const byId = new Map((teams.data ?? []).map((t: Team) => [t.id, t]));

  useEffect(() => {
    const storedId = localStorage.getItem("current-tournament-id");
    const firstTournament = tournamentList[0];
    const selectedId = tournamentList.some((tournament) => tournament.id === storedId) ? storedId : firstTournament?.id ?? "";
    setTournamentId(selectedId);
  }, [tournamentList]);

  const played = (fixtures.data ?? [])
    .filter((fixture) => fixture.status === "Full Time" || fixture.home_score != null || fixture.away_score != null)
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
  const upcoming = (fixtures.data ?? []).filter((fixture) => !played.some((match) => match.id === fixture.id));
  const groups = new Map<number, typeof upcoming>();
  for (const f of upcoming) {
    const list = groups.get(f.matchday) ?? [];
    list.push(f);
    groups.set(f.matchday, list);
  }

  return (
    <SiteLayout>
      <PageHeader
        title={selectedTournament?.tournament_name ?? "Fixtures & Results"}
        subtitle="Scheduled fixtures and completed results for the selected tournament."
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="flex items-center gap-3">
            <label htmlFor="fixtures-tournament" className="text-sm font-medium">Tournament</label>
            <select
              id="fixtures-tournament"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
              value={tournamentId}
              onChange={(event) => {
                setTournamentId(event.target.value);
                localStorage.setItem("current-tournament-id", event.target.value);
              }}
            >
              {tournamentList.map((tournament) => (
                <option key={tournament.id} value={tournament.id}>{tournament.tournament_name}</option>
              ))}
            </select>
          </div>
        )}
        {tournaments.isError ? (
          <EmptyState message="Unable to load tournaments. Refresh the page and try again." />
        ) : fixtures.isLoading ? (
          <ListSkeleton rows={8} />
        ) : upcoming.length === 0 && played.length === 0 ? (
          <EmptyState message="No fixtures or results for this tournament." />
        ) : (
          <div className="space-y-10">
            {groups.size > 0 && (
              <section>
                <h2 className="mb-3 font-display text-xl font-bold">Upcoming fixtures</h2>
                <div className="space-y-6">
                  {[...groups.entries()].map(([matchday, list]) => (
                    <div key={matchday}>
                      <h3 className="mb-3 text-sm font-semibold text-muted-foreground">Matchday {matchday}</h3>
                      <div className="space-y-3">
                        {list.map((fixture) => {
                          const home = byId.get(fixture.home_team_id);
                          const away = byId.get(fixture.away_team_id);
                          return (
                            <Link key={fixture.id} to="/match/$fixtureId" params={{ fixtureId: fixture.id }}>
                              <Card className="transition-shadow hover:shadow-md">
                                <CardContent className="flex flex-wrap items-center gap-3 p-4">
                                  <div className="flex flex-1 items-center gap-2">
                                    {home && <TeamBadge team={home} size={30} />}
                                    <span className="truncate font-medium">{home?.name}</span>
                                  </div>
                                  <div className="shrink-0 text-center text-xs text-muted-foreground">{formatKickoff(fixture.kickoff)}</div>
                                  <div className="flex flex-1 items-center justify-end gap-2">
                                    <span className="truncate font-medium">{away?.name}</span>
                                    {away && <TeamBadge team={away} size={30} />}
                                  </div>
                                </CardContent>
                              </Card>
                            </Link>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
            {played.length > 0 && (
              <section>
                <h2 className="mb-3 font-display text-xl font-bold">Results</h2>
                <div className="space-y-3">
                  {played.map((fixture) => {
                    const home = byId.get(fixture.home_team_id);
                    const away = byId.get(fixture.away_team_id);
                    return (
                      <Link key={fixture.id} to="/match/$fixtureId" params={{ fixtureId: fixture.id }}>
                        <Card className="transition-shadow hover:shadow-md">
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="flex flex-1 items-center gap-2">
                              {home && <TeamBadge team={home} size={30} />}
                              <span className="truncate font-medium">{home?.name}</span>
                            </div>
                            <div className="shrink-0 text-center">
                              <div className="rounded-md bg-secondary px-3 py-1 font-semibold tabular-nums">{fixture.home_score ?? 0} - {fixture.away_score ?? 0}</div>
                              <div className="mt-1 text-[10px] text-muted-foreground">{formatKickoff(fixture.kickoff)}</div>
                            </div>
                            <div className="flex flex-1 items-center justify-end gap-2">
                              <span className="truncate font-medium">{away?.name}</span>
                              {away && <TeamBadge team={away} size={30} />}
                            </div>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
