import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import type { ReactNode } from "react";
import { Award, Flame, Goal, Search, Trophy, Users } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { EmptyState, PageHeader, TeamBadge, ListSkeleton } from "@/components/football-ui";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
    description:
      "Scored in five consecutive finalized fixtures for their team within one tournament.",
    icon: Flame,
  },
} as const;

function AchievementsPage() {
  const [search, setSearch] = useState("");
  const [sortOrder, setSortOrder] = useState("newest");
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
  const query = search.trim().toLocaleLowerCase();
  const filteredEarned = earned
    .filter((item) => {
      if (!query) return true;
      const player = playerById.get(item.player_id);
      const team = player?.team_id ? teamById.get(player.team_id) : undefined;
      const fixture = item.evidence_fixture_id
        ? fixtureById.get(item.evidence_fixture_id)
        : undefined;
      const tournament = fixture?.tournament_id
        ? tournamentById.get(fixture.tournament_id)
        : undefined;
      return [player?.name, team?.name, tournament?.tournament_name]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => {
      const difference = +new Date(a.unlocked_at) - +new Date(b.unlocked_at);
      return sortOrder === "oldest" ? difference : -difference;
    });
  const sameTournamentPairs = new Map<
    string,
    {
      playerId: string;
      tournamentId: string;
      hatTricks: number;
      onFire: number;
      latestUnlockedAt: string;
    }
  >();
  for (const item of earned) {
    const fixture = item.evidence_fixture_id
      ? fixtureById.get(item.evidence_fixture_id)
      : undefined;
    const tournamentId = fixture?.tournament_id;
    if (!tournamentId) continue;

    const key = `${item.player_id}:${tournamentId}`;
    const pair = sameTournamentPairs.get(key) ?? {
      playerId: item.player_id,
      tournamentId,
      hatTricks: 0,
      onFire: 0,
      latestUnlockedAt: item.unlocked_at,
    };
    if (item.achievement_key === "hat_trick_hero") pair.hatTricks += 1;
    if (item.achievement_key === "on_fire") pair.onFire += 1;
    if (+new Date(item.unlocked_at) > +new Date(pair.latestUnlockedAt)) {
      pair.latestUnlockedAt = item.unlocked_at;
    }
    sameTournamentPairs.set(key, pair);
  }
  const sharedTournamentHolders = [...sameTournamentPairs.values()]
    .filter((pair) => pair.hatTricks > 0 && pair.onFire > 0)
    .filter((pair) => {
      if (!query) return true;
      const player = playerById.get(pair.playerId);
      const team = player?.team_id ? teamById.get(player.team_id) : undefined;
      const tournament = tournamentById.get(pair.tournamentId);
      return [player?.name, team?.name, tournament?.tournament_name]
        .filter(Boolean)
        .some((value) => value?.toLocaleLowerCase().includes(query));
    })
    .sort((a, b) => {
      const difference = +new Date(a.latestUnlockedAt) - +new Date(b.latestUnlockedAt);
      return sortOrder === "oldest" ? difference : -difference;
    });
  const honoreeCount = new Set(earned.map((item) => item.player_id)).size;
  const renderAchievementSection = (achievementKey: keyof typeof ACHIEVEMENTS) => {
    const achievement = ACHIEVEMENTS[achievementKey];
    const Icon = achievement.icon;
    const sectionEarned = filteredEarned.filter((item) => item.achievement_key === achievementKey);

    return (
      <section key={achievementKey}>
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Icon className="size-5 text-primary" />
            <h3 className="font-display text-xl font-bold">{achievement.name} players</h3>
          </div>
          <span className="text-sm text-muted-foreground">
            {sectionEarned.length} player{sectionEarned.length === 1 ? "" : "s"}
          </span>
        </div>
        {sectionEarned.length === 0 ? (
          <EmptyState
            message={
              query
                ? `No ${achievement.name} players match your search.`
                : `No players have earned the ${achievement.name} badge yet.`
            }
          />
        ) : (
          <div className="overflow-hidden rounded-xl border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Player</TableHead>
                  <TableHead>Team</TableHead>
                  <TableHead>Tournament</TableHead>
                  <TableHead>Match</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sectionEarned.map((item) => {
                  const player = playerById.get(item.player_id);
                  const team = player?.team_id ? teamById.get(player.team_id) : undefined;
                  const fixture = item.evidence_fixture_id
                    ? fixtureById.get(item.evidence_fixture_id)
                    : undefined;
                  const tournament = fixture?.tournament_id
                    ? tournamentById.get(fixture.tournament_id)
                    : undefined;
                  const homeTeam = fixture ? teamById.get(fixture.home_team_id) : undefined;
                  const awayTeam = fixture ? teamById.get(fixture.away_team_id) : undefined;
                  if (!player) return null;

                  return (
                    <TableRow
                      key={`${item.player_id}-${item.achievement_key}-${item.evidence_fixture_id ?? "none"}`}
                    >
                      <TableCell className="font-medium">
                        <Link
                          to="/players/$playerId"
                          params={{ playerId: player.id }}
                          className="hover:text-primary hover:underline"
                        >
                          {player.name}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <span className="flex items-center gap-2">
                          {team && <TeamBadge team={team} size={18} />}
                          {team?.name ?? player.position}
                        </span>
                      </TableCell>
                      <TableCell>
                        {tournament?.tournament_name ?? "Tournament not recorded"}
                      </TableCell>
                      <TableCell>
                        {fixture && homeTeam && awayTeam
                          ? `${homeTeam.name} ${fixture.home_score ?? "–"}–${fixture.away_score ?? "–"} ${awayTeam.name}`
                          : "No match evidence recorded"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </section>
    );
  };

  return (
    <SiteLayout>
      <PageHeader
        title="Player Achievements"
        subtitle="Badges earned from recorded goals and confirmed match appearances."
      />
      <div className="mx-auto max-w-5xl space-y-8 px-4 py-10">
        <div className="grid gap-3 sm:grid-cols-3">
          <AchievementSummary icon={<Trophy />} label="Badges earned" value={earned.length} />
          <AchievementSummary icon={<Users />} label="Players honored" value={honoreeCount} />
          <AchievementSummary
            icon={<Award />}
            label="Badge types earned"
            value={new Set(earned.map((item) => item.achievement_key)).size}
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          {Object.entries(ACHIEVEMENTS).map(([key, achievement]) => {
            const Icon = achievement.icon;
            return (
              <Card key={key} className="h-full overflow-hidden">
                <CardContent className="flex items-start gap-4 p-5">
                  <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
                    <Icon className="size-6" />
                  </span>
                  <div className="flex-1">
                    <h2 className="font-display text-lg font-bold">{achievement.name}</h2>
                    <p className="mt-1 text-sm text-muted-foreground">{achievement.description}</p>
                    <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-primary">
                      {earned.filter((item) => item.achievement_key === key).length} earned
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <section className="space-y-8">
          <div className="mb-4 flex items-center gap-2">
            <Trophy className="size-5 text-primary" />
            <h2 className="font-display text-2xl font-bold">Players by badge</h2>
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
            <>
              <Card className="mb-4">
                <CardContent className="grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <label className="relative block">
                    <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search players, teams, or tournaments"
                      aria-label="Search earned achievements"
                      className="pl-9"
                    />
                  </label>
                  <label className="sr-only" htmlFor="achievement-sort">
                    Sort achievements
                  </label>
                  <select
                    id="achievement-sort"
                    value={sortOrder}
                    onChange={(event) => setSortOrder(event.target.value)}
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="newest">Most recent</option>
                    <option value="oldest">Oldest first</option>
                  </select>
                </CardContent>
              </Card>
              {renderAchievementSection("on_fire")}
              {renderAchievementSection("hat_trick_hero")}
              <section>
                <div className="mb-4 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Award className="size-5 text-primary" />
                    <h3 className="font-display text-xl font-bold">
                      Both badges in the same tournament
                    </h3>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {sharedTournamentHolders.length} player-tournament pair
                    {sharedTournamentHolders.length === 1 ? "" : "s"}
                  </span>
                </div>
                {sharedTournamentHolders.length === 0 ? (
                  <EmptyState message="No players have earned both Hat-Trick Hero and On Fire in the same tournament yet." />
                ) : (
                  <div className="overflow-hidden rounded-xl border bg-card">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Player</TableHead>
                          <TableHead>Team</TableHead>
                          <TableHead>Tournament</TableHead>
                          <TableHead>Hat-tricks</TableHead>
                          <TableHead>On Fire streaks</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {sharedTournamentHolders.map((pair) => {
                          const player = playerById.get(pair.playerId);
                          const team = player?.team_id ? teamById.get(player.team_id) : undefined;
                          const tournament = tournamentById.get(pair.tournamentId);
                          if (!player) return null;

                          return (
                            <TableRow key={`${pair.playerId}-${pair.tournamentId}`}>
                              <TableCell className="font-medium">
                                <Link
                                  to="/players/$playerId"
                                  params={{ playerId: player.id }}
                                  className="hover:text-primary hover:underline"
                                >
                                  {player.name}
                                </Link>
                              </TableCell>
                              <TableCell>
                                <span className="flex items-center gap-2">
                                  {team && <TeamBadge team={team} size={18} />}
                                  {team?.name ?? player.position}
                                </span>
                              </TableCell>
                              <TableCell>
                                {tournament?.tournament_name ?? "Tournament not recorded"}
                              </TableCell>
                              <TableCell>{pair.hatTricks}</TableCell>
                              <TableCell>{pair.onFire}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </section>
            </>
          )}
        </section>
      </div>
    </SiteLayout>
  );
}

function AchievementSummary({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: number;
}) {
  return (
    <Card>
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4">
        <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
          {icon}
        </span>
        <div>
          <p className="font-display text-2xl font-bold tabular-nums">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardHeader>
    </Card>
  );
}
