import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Flame, Goal, Trophy } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, PageHeader, TeamBadge, ListSkeleton } from "@/components/football-ui";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Card, CardContent } from "@/components/ui/card";
import {
  fetchFixtures,
  fetchPlayerAchievements,
  fetchPlayers,
  fetchTeams,
  fetchTournaments,
} from "@/lib/football";

export const Route = createFileRoute("/achievements")({
  head: () => ({
    meta: [
      { title: "Achievements — FRIENDS LEAGUE" },
      { name: "description", content: "Player badges earned in FRIENDS LEAGUE matches." },
    ],
  }),
  component: AchievementsPage,
});

const ACHIEVEMENTS = {
  hat_trick_hero: {
    name: "Hat-Trick Hero",
    description: "Scored three or more goals in a finalized match.",
    icon: Goal,
  },
  on_fire: {
    name: "On Fire",
    description: "Scored in five consecutive finalized matches played.",
    icon: Flame,
  },
} as const;

function AchievementsPage() {
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });
  const tournaments = useQuery({ queryKey: ["tournaments"], queryFn: () => fetchTournaments() });
  const achievements = useQuery({
    queryKey: ["achievements"],
    queryFn: () => fetchPlayerAchievements(),
  });
  const playerById = new Map((players.data ?? []).map((player) => [player.id, player]));
  const teamById = new Map((teams.data ?? []).map((team) => [team.id, team]));
  const fixtureById = new Map((fixtures.data ?? []).map((fixture) => [fixture.id, fixture]));
  const tournamentById = new Map(
    (tournaments.data ?? []).map((tournament) => [tournament.id, tournament]),
  );
  const earned = achievements.data ?? [];

  return (
    <SiteLayout>
      <PageHeader
        title="Player Achievements"
        subtitle="Badges earned from recorded goals and confirmed match appearances."
      />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(ACHIEVEMENTS).map(([key, achievement]) => {
            const Icon = achievement.icon;
            return (
              <Card key={key} className="overflow-hidden">
                <CardContent className="flex items-start gap-4 p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold">{achievement.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section>
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Earned badges</h2>
          </div>
          {players.isLoading ||
          teams.isLoading ||
          fixtures.isLoading ||
          tournaments.isLoading ||
          achievements.isLoading ? (
            <ListSkeleton rows={4} />
          ) : players.isError ||
            teams.isError ||
            fixtures.isError ||
            tournaments.isError ||
            achievements.isError ? (
            <EmptyState message="Achievements could not be loaded. Refresh the page to try again." />
          ) : earned.length === 0 ? (
            <EmptyState message="No badges have been earned yet. Finalize a match and record its goals and appearances to get started." />
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {earned.map((item) => {
                const player = playerById.get(item.player_id);
                const team = player?.team_id ? teamById.get(player.team_id) : undefined;
                const achievement = ACHIEVEMENTS[item.achievement_key];
                const fixture = item.evidence_fixture_id
                  ? fixtureById.get(item.evidence_fixture_id)
                  : undefined;
                const tournament = fixture?.tournament_id
                  ? tournamentById.get(fixture.tournament_id)
                  : undefined;
                const homeTeam = fixture ? teamById.get(fixture.home_team_id) : undefined;
                const awayTeam = fixture ? teamById.get(fixture.away_team_id) : undefined;
                if (!player || !achievement) return null;
                const Icon = achievement.icon;
                return (
                  <Link
                    key={`${item.player_id}-${item.achievement_key}`}
                    to="/players/$playerId"
                    params={{ playerId: player.id }}
                    className="block"
                  >
                    <Card className="h-full transition-shadow hover:shadow-elevated">
                      <CardContent className="flex items-center gap-3 p-4">
                        <Avatar className="size-12">
                          <AvatarImage src={player.photo_url ?? undefined} alt={player.name} />
                          <AvatarFallback>{player.name.slice(0, 2).toUpperCase()}</AvatarFallback>
                        </Avatar>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-semibold">{player.name}</p>
                          <p className="flex items-center gap-2 text-sm text-muted-foreground">
                            {team && <TeamBadge team={team} size={18} />}
                            {team?.name ?? player.position}
                          </p>
                          {tournament && (
                            <p className="truncate text-xs text-primary">
                              {tournament.tournament_name}
                            </p>
                          )}
                          {item.achievement_key === "hat_trick_hero" &&
                            fixture &&
                            homeTeam &&
                            awayTeam && (
                              <p className="truncate text-xs text-muted-foreground">
                                Hat-trick match: {homeTeam.name} {fixture.home_score ?? "–"}–
                                {fixture.away_score ?? "–"} {awayTeam.name}
                              </p>
                            )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
                          <Icon className="size-4" />
                          <span className="hidden sm:inline">{achievement.name}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}
