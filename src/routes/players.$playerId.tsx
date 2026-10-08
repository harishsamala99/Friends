import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Flame, Goal, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, PageHeader, TeamBadge, ListSkeleton } from "@/components/football-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchAllFixtureAppearances,
  fetchAllMatchEvents,
  fetchFixtures,
  fetchPlayerAchievements,
  fetchPlayers,
  fetchTeams,
  fetchTournamentChampionCaptains,
  fetchTournaments,
  type Fixture,
} from "@/lib/football";

export const Route = createFileRoute("/players/$playerId")({
  head: () => ({
    meta: [
      { title: "Player Profile — FRIENDS LEAGUE" },
      { name: "description", content: "Player history and earned achievements." },
    ],
  }),
  component: PlayerProfilePage,
});

const ACHIEVEMENT_DETAILS = {
  hat_trick_hero: {
    name: "Hat-Trick Hero",
    description: "Scored three or more goals in one finalized match.",
    icon: Goal,
  },
  on_fire: {
    name: "On Fire",
    description: "Scored in five consecutive finalized matches played.",
    icon: Flame,
  },
} as const;

function PlayerProfilePage() {
  const { playerId } = Route.useParams();
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: () => fetchTournaments() });
  const events = useQuery({ queryKey: ["match-events"], queryFn: () => fetchAllMatchEvents() });
  const appearances = useQuery({
    queryKey: ["player-appearances"],
    queryFn: () => fetchAllFixtureAppearances(),
  });
  const achievements = useQuery({
    queryKey: ["achievements", playerId],
    queryFn: () => fetchPlayerAchievements(playerId),
  });
  const captains = useQuery({
    queryKey: ["tournament-champion-captains"],
    queryFn: () => fetchTournamentChampionCaptains(),
  });

  const player = (players.data ?? []).find((item) => item.id === playerId);
  const team = player?.team_id
    ? (teams.data ?? []).find((item) => item.id === player.team_id)
    : null;
  const fixturesById = new Map((fixtures.data ?? []).map((fixture) => [fixture.id, fixture]));
  const tournamentsById = new Map((tournaments.data ?? []).map((item) => [item.id, item]));
  const playerEvents = (events.data ?? []).filter((event) => {
    const fixture = fixturesById.get(event.fixture_id);
    return (
      event.player_id === playerId &&
      fixture?.status === "Full Time" &&
      fixture.home_score !== null &&
      fixture.away_score !== null &&
      event.team_id !== null &&
      (event.team_id === fixture.home_team_id || event.team_id === fixture.away_team_id)
    );
  });
  const participated = new Set([
    ...(appearances.data ?? [])
      .filter((appearance) => appearance.player_id === playerId)
      .map((appearance) => appearance.fixture_id),
    ...playerEvents.map((event) => event.fixture_id),
  ]);
  const history = [...participated]
    .map((fixtureId) => fixturesById.get(fixtureId))
    .filter(
      (fixture): fixture is Fixture =>
        fixture !== undefined &&
        fixture.status === "Full Time" &&
        fixture.home_score !== null &&
        fixture.away_score !== null,
    )
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff));
  const playerHonors: { tournamentId: string; label: string }[] = [];
  if (player) {
    const matchingWinnerTeam = (winnerName: string) => {
      const matching = (teams.data ?? []).filter(
        (item) => normalize(item.name) === normalize(winnerName),
      );
      return matching.length === 1 ? matching[0] : undefined;
    };
    for (const tournament of (tournaments.data ?? []).filter(
      (item) => item.status === "completed",
    )) {
      const winner = matchingWinnerTeam(tournament.winner);
      if (winner) {
        const appearedWithWinner = (appearances.data ?? []).some((appearance) => {
          const fixture = fixturesById.get(appearance.fixture_id);
          return (
            appearance.player_id === playerId &&
            appearance.team_id === winner.id &&
            fixture?.tournament_id === tournament.id &&
            fixture.status === "Full Time" &&
            fixture.home_score !== null &&
            fixture.away_score !== null
          );
        });
        const scoredOrRecordedWithWinner = playerEvents.some((event) => {
          const fixture = fixturesById.get(event.fixture_id);
          return event.team_id === winner.id && fixture?.tournament_id === tournament.id;
        });
        if (appearedWithWinner || scoredOrRecordedWithWinner) {
          playerHonors.push({
            tournamentId: tournament.id,
            label: `Champion · ${winner.name}`,
          });
        }
      }

      for (const [awardName, personName, total] of [
        ["Top scorer", tournament.top_scorer_name, tournament.top_scorer_goals],
        ["Top assister", tournament.top_assister_name, tournament.top_assister_assists],
        ["Top saver", tournament.top_saver_name, tournament.top_saver_saves],
      ] as const) {
        if (
          personName &&
          total &&
          normalize(personName) === normalize(player.name) &&
          (players.data ?? []).filter((item) => normalize(item.name) === normalize(personName))
            .length === 1
        ) {
          playerHonors.push({
            tournamentId: tournament.id,
            label: `${awardName} · ${total}`,
          });
        }
      }
    }
    for (const assignment of captains.data ?? []) {
      const tournament = tournamentsById.get(assignment.tournament_id);
      const champion = tournament ? matchingWinnerTeam(tournament.winner) : undefined;
      if (
        assignment.player_id === playerId &&
        tournament?.status === "completed" &&
        champion?.id === assignment.team_id
      ) {
        playerHonors.push({
          tournamentId: tournament.id,
          label: `Official champion captain · ${champion.name}`,
        });
      }
    }
  }
  const goals = playerEvents.filter(
    (event) => event.event_type === "goal" && event.goal_type !== "Own Goal",
  ).length;
  const loading =
    players.isLoading ||
    teams.isLoading ||
    fixtures.isLoading ||
    tournaments.isLoading ||
    events.isLoading ||
    appearances.isLoading ||
    achievements.isLoading ||
    captains.isLoading;
  const failed =
    players.isError ||
    teams.isError ||
    fixtures.isError ||
    tournaments.isError ||
    events.isError ||
    appearances.isError ||
    achievements.isError ||
    captains.isError;

  return (
    <SiteLayout>
      <PageHeader
        title={player?.name ?? "Player Profile"}
        subtitle="Career history and earned badges."
      />
      <div className="mx-auto max-w-4xl space-y-8 px-4 py-10">
        {loading ? (
          <ListSkeleton rows={5} />
        ) : failed ? (
          <EmptyState message="Player history could not be loaded. Refresh the page to try again." />
        ) : !player ? (
          <EmptyState message="This player profile could not be found." />
        ) : (
          <>
            <Card className="overflow-hidden">
              <div className="h-2 bg-primary" />
              <CardContent className="flex flex-wrap items-center gap-4 p-6">
                <Avatar className="size-20">
                  <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
                  <AvatarFallback className="text-lg">
                    {player.name.slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <h2 className="font-display text-2xl font-bold">{player.name}</h2>
                  <p className="mt-1 text-muted-foreground">
                    {player.position}
                    {player.nationality ? ` · ${player.nationality}` : ""}
                  </p>
                  {team && (
                    <Link
                      to="/teams"
                      search={{ teamId: team.id }}
                      className="mt-2 inline-flex items-center gap-2 font-medium text-primary hover:underline"
                    >
                      <TeamBadge team={team} size={22} />
                      {team.name}
                    </Link>
                  )}
                </div>
                <div className="flex gap-2">
                  <Badge variant="secondary">{history.length} finalized matches</Badge>
                  <Badge variant="secondary">{goals} goals</Badge>
                </div>
              </CardContent>
            </Card>

            <section>
              <div className="mb-4 flex items-center justify-between gap-3">
                <h2 className="flex items-center gap-2 font-display text-2xl font-bold">
                  <Award className="size-5 text-primary" />
                  Achievements
                </h2>
                <Link
                  to="/achievements"
                  className="text-sm font-medium text-primary hover:underline"
                >
                  All achievements
                </Link>
              </div>
              {(achievements.data ?? []).length === 0 ? (
                <EmptyState message="No badges earned yet. Badges are awarded automatically from finalized match records." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {(achievements.data ?? []).map((achievement) => {
                    const details = ACHIEVEMENT_DETAILS[achievement.achievement_key];
                    const Icon = details.icon;
                    const achievementFixture = achievement.evidence_fixture_id
                      ? fixturesById.get(achievement.evidence_fixture_id)
                      : undefined;
                    const achievementTournament = achievementFixture?.tournament_id
                      ? tournamentsById.get(achievementFixture.tournament_id)
                      : undefined;
                    return (
                      <Card key={achievement.achievement_key}>
                        <CardContent className="flex items-center gap-3 p-4">
                          <span className="grid size-11 place-items-center rounded-xl bg-primary/10 text-primary">
                            <Icon className="size-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="font-semibold">{details.name}</p>
                            <p className="text-sm text-muted-foreground">{details.description}</p>
                            {achievementTournament && (
                              <p className="truncate text-xs text-primary">
                                {achievementTournament.tournament_name}
                              </p>
                            )}
                          </div>
                          <time
                            className="text-xs text-muted-foreground"
                            dateTime={achievement.unlocked_at}
                          >
                            {formatDate(achievement.unlocked_at)}
                          </time>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
                <Trophy className="size-5 text-primary" />
                Tournament honors
              </h2>
              {playerHonors.length === 0 ? (
                <EmptyState message="No tournament titles or individual awards are recorded for this player yet." />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {playerHonors.map((honor, index) => {
                    const tournament = tournamentsById.get(honor.tournamentId);
                    return (
                      <Link
                        key={`${honor.tournamentId}-${honor.label}-${index}`}
                        to="/fixtures"
                        search={{ tournamentId: honor.tournamentId }}
                      >
                        <Card className="transition-shadow hover:shadow-elevated">
                          <CardContent className="p-4">
                            <p className="font-semibold">{honor.label}</p>
                            <p className="text-sm text-muted-foreground">
                              {tournament?.tournament_name ?? tournament?.type}
                            </p>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>

            <section>
              <h2 className="mb-4 flex items-center gap-2 font-display text-2xl font-bold">
                <Trophy className="size-5 text-primary" />
                Match history
              </h2>
              {history.length === 0 ? (
                <EmptyState message="No finalized matches are recorded for this player." />
              ) : (
                <div className="space-y-3">
                  {history.map((fixture) => {
                    const tournament = fixture.tournament_id
                      ? tournamentsById.get(fixture.tournament_id)
                      : undefined;
                    const home = (teams.data ?? []).find(
                      (item) => item.id === fixture.home_team_id,
                    );
                    const away = (teams.data ?? []).find(
                      (item) => item.id === fixture.away_team_id,
                    );
                    return (
                      <Link
                        key={fixture.id}
                        to="/match/$fixtureId"
                        params={{ fixtureId: fixture.id }}
                      >
                        <Card className="transition-shadow hover:shadow-elevated">
                          <CardContent className="flex items-center gap-3 p-4">
                            <div className="min-w-0 flex-1">
                              <p className="truncate font-semibold">
                                {home?.name ?? "Home"} vs {away?.name ?? "Away"}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {tournament?.tournament_name ?? "League match"} ·{" "}
                                {formatDate(fixture.kickoff)}
                              </p>
                            </div>
                            <span className="font-display text-lg font-bold tabular-nums">
                              {fixture.home_score}–{fixture.away_score}
                            </span>
                          </CardContent>
                        </Card>
                      </Link>
                    );
                  })}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </SiteLayout>
  );
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase();
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(new Date(value));
}
