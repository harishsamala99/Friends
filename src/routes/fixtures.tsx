import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchFixtures,
  fetchTeams,
  fetchTournaments,
  type Team,
  type Tournament,
} from "@/lib/football";

export const Route = createFileRoute("/fixtures")({
  validateSearch: (search: Record<string, unknown>): { tournamentId?: string } => ({
    ...(typeof search["tournamentId"] === "string" ? { tournamentId: search["tournamentId"] } : {}),
  }),
  head: () => ({
    meta: [
      { title: "Fixtures & Results — FRIENDS LEAGUE" },
      { name: "description", content: "Scheduled fixtures and completed results by tournament." },
      { property: "og:title", content: "Fixtures & Results — FRIENDS LEAGUE" },
      {
        property: "og:description",
        content: "Scheduled fixtures and completed results by tournament.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FixturesPage,
});

function FixturesPage() {
  const { tournamentId: requestedTournamentId } = Route.useSearch();
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: fetchTournaments });
  const [tournamentId, setTournamentId] = useState("");
  const tournamentList = useMemo<Tournament[]>(
    () => (Array.isArray(tournaments.data) ? tournaments.data : []),
    [tournaments.data],
  );
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
    const selectedId =
      (tournamentList.some((tournament) => tournament.id === requestedTournamentId)
        ? requestedTournamentId
        : tournamentList.some((tournament) => tournament.id === storedId)
          ? storedId
          : firstTournament?.id) ?? "";
    setTournamentId(selectedId);
  }, [requestedTournamentId, tournamentList]);

  const playedFixtureIds = new Set(
    (fixtures.data ?? [])
      .filter(
        (fixture) =>
          fixture.status === "Full Time" ||
          fixture.home_score != null ||
          fixture.away_score != null,
      )
      .map((fixture) => fixture.id),
  );
  const fixturesByTeams = new Map<
    string,
    { key: string; teamNames: [string, string]; fixtures: NonNullable<typeof fixtures.data> }
  >();
  for (const fixture of fixtures.data ?? []) {
    const sortedNames = [
      byId.get(fixture.home_team_id)?.name ?? "Home team",
      byId.get(fixture.away_team_id)?.name ?? "Away team",
    ].sort((a, b) => a.localeCompare(b));
    const teamNames: [string, string] = [
      sortedNames[0] ?? "Home team",
      sortedNames[1] ?? "Away team",
    ];
    const key = [fixture.home_team_id, fixture.away_team_id].sort().join(":");
    const group = fixturesByTeams.get(key);
    if (group) {
      group.fixtures.push(fixture);
    } else {
      fixturesByTeams.set(key, { key, teamNames, fixtures: [fixture] });
    }
  }
  const fixtureGroups = [...fixturesByTeams.values()].sort(
    (a, b) =>
      a.teamNames[0].localeCompare(b.teamNames[0]) || a.teamNames[1].localeCompare(b.teamNames[1]),
  );
  for (const group of fixtureGroups) {
    group.fixtures.sort((a, b) => +new Date(a.kickoff) - +new Date(b.kickoff));
  }

  return (
    <SiteLayout>
      <PageHeader
        title={selectedTournament?.tournament_name ?? "Fixtures & Results"}
        subtitle="Scheduled fixtures and completed results for the selected tournament."
      />
      <div className="page-content mx-auto max-w-4xl space-y-8 px-4 py-10">
        {tournamentList.length > 0 && (
          <div className="tournament-switcher">
            <label htmlFor="fixtures-tournament" className="text-sm font-medium">
              Tournament
            </label>
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
                <option key={tournament.id} value={tournament.id}>
                  {tournament.tournament_name}
                </option>
              ))}
            </select>
          </div>
        )}
        {tournaments.isError ? (
          <EmptyState message="Unable to load tournaments. Refresh the page and try again." />
        ) : fixtures.isLoading ? (
          <ListSkeleton rows={8} />
        ) : fixtureGroups.length === 0 ? (
          selectedTournament?.status === "completed" ? (
            <Card>
              <CardContent className="space-y-3 p-5">
                <p className="text-xs font-semibold uppercase tracking-wider text-primary">
                  Archived final · {selectedTournament.tournament_name}
                </p>
                <p className="font-display text-xl font-bold">
                  {selectedTournament.home_team} <span className="text-muted-foreground">vs</span>{" "}
                  {selectedTournament.away_team}
                </p>
                <p className="font-display text-3xl font-bold tabular-nums">
                  {selectedTournament.home_score} – {selectedTournament.away_score}
                </p>
                <p className="text-sm text-muted-foreground">
                  Champion: {selectedTournament.winner} · {selectedTournament.date}
                </p>
                <p className="text-sm text-muted-foreground">
                  No individual match fixtures are linked to this archived result.
                </p>
              </CardContent>
            </Card>
          ) : (
            <EmptyState message="No fixtures or results for this tournament." />
          )
        ) : (
          <div className="space-y-5">
            {fixtureGroups.map((group) => (
              <section key={group.key} className="overflow-hidden rounded-md border">
                <h2 className="bg-muted/50 px-4 py-3 font-display text-lg font-bold">
                  {group.teamNames[0]} vs {group.teamNames[1]}
                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                    ({group.fixtures.length} {group.fixtures.length === 1 ? "match" : "matches"})
                  </span>
                </h2>
                <div className="divide-y">
                  {group.fixtures.map((fixture) => {
                    const home = byId.get(fixture.home_team_id);
                    const away = byId.get(fixture.away_team_id);
                    const isPlayed = playedFixtureIds.has(fixture.id);
                    return (
                      <Link
                        key={fixture.id}
                        to="/match/$fixtureId"
                        params={{ fixtureId: fixture.id }}
                        className="block"
                      >
                        <Card className="fixture-card rounded-none border-0 shadow-none">
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="fixture-card__teams flex flex-1 items-center gap-2">
                              {home && <TeamBadge team={home} size={30} />}
                              <span className="truncate font-medium">{home?.name}</span>
                            </div>
                            <div className="fixture-card__score shrink-0 text-center">
                              {isPlayed ? (
                                <div className="rounded-md bg-secondary px-3 py-1 font-semibold tabular-nums">
                                  {fixture.home_score ?? 0} - {fixture.away_score ?? 0}
                                </div>
                              ) : (
                                <span className="text-sm text-muted-foreground">Upcoming</span>
                              )}
                            </div>
                            <div className="fixture-card__teams fixture-card__teams--away flex flex-1 items-center justify-end gap-2">
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
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
