import { useState, useEffect, useMemo, useRef } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import {
  Plus,
  X,
  Trash2,
  RotateCcw,
  Trophy,
  BarChart3,
  Save,
  Zap,
  Crown,
  Users,
  ChevronDown,
  ChevronUp,
  Pencil,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCompetitions,
  fetchTeams,
  fetchPlayers,
  fetchFixtures,
  fetchEvents,
  replaceFixtureEvents,
  sortStandings,
  insertFixtures,
  updateFixture,
  deleteFixture,
  saveTournament as saveTournamentToDB,
  updateTournament,
  fetchTournaments,
  deleteTournament as deleteTournamentFromDB,
  type Fixture,
  type Team,
  type StandingRow,
  type Player as FootballPlayer,
} from "@/lib/football";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

interface Player {
  id: string;
  name: string;
  isGK?: boolean;
}

interface Goal {
  id: string;
  playerId: string;
  playerName: string;
  minute?: number;
}

interface Save {
  id: string;
  playerId: string;
  playerName: string;
  minute?: number;
}

interface Assist {
  id: string;
  playerId: string;
  playerName: string;
}

interface TeamData {
  name: string;
  players: Player[];
  goals: Goal[];
  assists: Assist[];
  saves: Save[];
}

interface Tournament {
  id: string;
  tournamentName: string;
  status: "draft" | "completed";
  type: string;
  date: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  winner: string;
  manager: string;
  participants: number;
  stats: TournamentStats;
}

interface TournamentStats {
  topScorer: { name: string; goals: number };
  topAssister: { name: string; assists: number };
  topSaver: { name: string; saves: number };
}

function calculateFinalStandings(
  teams: Team[],
  fixtures: Fixture[],
  pointsWin: number,
  pointsDraw: number,
): StandingRow[] {
  const rows = new Map<string, StandingRow>();

  for (const team of teams) {
    rows.set(team.id, {
      competition_id: team.competition_id,
      team_id: team.id,
      team_name: team.name,
      short_name: team.short_name,
      crest_color: team.crest_color,
      logo_url: team.logo_url,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goals_for: 0,
      goals_against: 0,
      goal_difference: 0,
      points: 0,
      home_won: 0,
      away_won: 0,
      clean_sheets: 0,
    });
  }

  for (const fixture of fixtures) {
    if (fixture.tournament_id || fixture.home_score == null || fixture.away_score == null) continue;
    const home = rows.get(fixture.home_team_id);
    const away = rows.get(fixture.away_team_id);
    if (!home || !away) continue;

    home.played += 1;
    away.played += 1;
    home.goals_for += fixture.home_score;
    home.goals_against += fixture.away_score;
    away.goals_for += fixture.away_score;
    away.goals_against += fixture.home_score;
    if (fixture.home_score > fixture.away_score) {
      home.won += 1;
      home.points += pointsWin;
      home.home_won += 1;
      away.lost += 1;
    } else if (fixture.home_score < fixture.away_score) {
      away.won += 1;
      away.points += pointsWin;
      away.away_won += 1;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += pointsDraw;
      away.points += pointsDraw;
    }
    if (fixture.away_score === 0) home.clean_sheets += 1;
    if (fixture.home_score === 0) away.clean_sheets += 1;
  }

  for (const row of rows.values()) row.goal_difference = row.goals_for - row.goals_against;
  return sortStandings([...rows.values()]);
}

function createLocalTournamentId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const INITIAL_HOME_PLAYERS: Player[] = [
  { id: "h1", name: "Player 1" },
  { id: "h2", name: "Player 2" },
  { id: "h3", name: "GK Player", isGK: true },
];

const INITIAL_AWAY_PLAYERS: Player[] = [
  { id: "a1", name: "Player 1" },
  { id: "a2", name: "Player 2" },
  { id: "a3", name: "GK Player", isGK: true },
];

function TournamentSetup({
  name,
  onNameChange,
  status,
  onStatusChange,
  teams,
  competitionId,
  tournamentId,
  fixtures,
  onFixturesSaved,
  tournaments,
  onCreateTournament,
  onSelectTournament,
  onEditTournament,
  onDeleteTournament,
  creating,
  isCreated,
}: {
  name: string;
  onNameChange: (name: string) => void;
  status: "draft" | "completed";
  onStatusChange: (status: "draft" | "completed") => void;
  teams: Team[];
  competitionId: string | null;
  tournamentId: string;
  fixtures: Fixture[];
  onFixturesSaved: () => void;
  tournaments: Tournament[];
  onCreateTournament: () => void;
  onSelectTournament: (tournament: Tournament) => void;
  onEditTournament: (tournament: Tournament) => void;
  onDeleteTournament: (tournamentId: string) => void;
  creating: boolean;
  isCreated: boolean;
}) {
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [matchCount, setMatchCount] = useState("1");
  const [saving, setSaving] = useState(false);

  async function scheduleFixtures() {
    if (!isCreated) return toast.error("Create the tournament before adding fixtures");
    if (!homeId || !awayId || homeId === awayId) return toast.error("Pick two different teams");

    const fixtureCompetitionId =
      competitionId ??
      teams.find((team) => team.id === homeId)?.competition_id ??
      teams.find((team) => team.id === awayId)?.competition_id;
    if (!fixtureCompetitionId)
      return toast.error("The selected teams are not linked to a competition");

    const count = Math.max(1, Math.min(50, Number(matchCount) || 1));
    const firstMatchday = Math.max(0, ...fixtures.map((fixture) => fixture.matchday)) + 1;
    setSaving(true);
    try {
      await insertFixtures(
        Array.from({ length: count }, (_, index) => ({
          competition_id: fixtureCompetitionId,
          tournament_id: tournamentId,
          home_team_id: homeId,
          away_team_id: awayId,
          matchday: firstMatchday + index,
          kickoff: new Date(Date.now() + index * 7 * 24 * 3600 * 1000).toISOString(),
        })),
      );
      toast.success(
        `${count} fixture${count === 1 ? "" : "s"} added to ${name.trim() || "your tournament"}`,
      );
      onFixturesSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not add fixtures");
    } finally {
      setSaving(false);
    }
  }

  async function saveFinalTeams() {
    if (!isCreated) return toast.error("Create the tournament before saving final teams");
    if (!homeId || !awayId || homeId === awayId)
      return toast.error("Pick two different final teams");

    const fixtureCompetitionId =
      competitionId ??
      teams.find((team) => team.id === homeId)?.competition_id ??
      teams.find((team) => team.id === awayId)?.competition_id;
    if (!fixtureCompetitionId)
      return toast.error("The selected teams are not linked to a competition");

    const existingFinal = fixtures.find((fixture) =>
      fixture.notes?.includes("completed league standings"),
    );
    if (existingFinal) {
      toast.success("Final teams are already saved in the bracket");
      return;
    }

    setSaving(true);
    try {
      await insertFixtures([
        {
          competition_id: fixtureCompetitionId,
          tournament_id: tournamentId,
          home_team_id: homeId,
          away_team_id: awayId,
          matchday: Math.max(0, ...fixtures.map((fixture) => fixture.matchday)) + 1,
          kickoff: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
          status: "Scheduled",
          notes: "Automatically created from the completed league standings.",
        },
      ]);
      toast.success(`${teamNames.get(homeId)} vs ${teamNames.get(awayId)} saved as the final`);
      onFixturesSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save final teams");
    } finally {
      setSaving(false);
    }
  }

  async function removeFixture(fixtureId: string) {
    if (!window.confirm("Delete this fixture from the tournament?")) return;
    try {
      await deleteFixture(fixtureId);
      toast.success("Fixture deleted");
      onFixturesSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete fixture");
    }
  }

  const teamNames = new Map(teams.map((team) => [team.id, team.name]));

  return (
    <Card className="mb-8 border-2 border-[#f28c5b]/40 bg-linear-to-br from-[#fff8f1] via-card to-[#e9f5f1] text-foreground shadow-lg dark:from-[#18212d] dark:via-card dark:to-[#1b2a2c]">
      <CardHeader className="border-b border-[#f28c5b]/25 bg-linear-to-r from-[#f28c5b]/20 to-[#2f8f83]/10 dark:from-[#3b2932] dark:to-[#173d3d]">
        <CardTitle className="flex items-center gap-2">🏆 Create your tournament</CardTitle>
        <p className="text-sm text-muted-foreground">
          Name it, schedule fixtures, then create the final below.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 p-6">
        <div>
          <Label htmlFor="tournament-name">Tournament name</Label>
          <Input
            id="tournament-name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="e.g. Summer Cup 2026"
            className="text-foreground"
          />
        </div>
        <div className="max-w-xs">
          <Label htmlFor="tournament-status">Tournament progress</Label>
          <select
            id="tournament-status"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
            value={status}
            onChange={(event) => onStatusChange(event.target.value as "draft" | "completed")}
          >
            <option value="draft">In progress - still adding fixtures</option>
            <option value="completed">Completed - final results are ready</option>
          </select>
          <p className="mt-1 text-xs text-muted-foreground">
            Choose Completed only after the tournament final and results are saved.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="tournament-fixture-home">Team 1</Label>
            <select
              id="tournament-fixture-home"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
              value={homeId}
              onChange={(event) => setHomeId(event.target.value)}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tournament-fixture-away">Team 2</Label>
            <select
              id="tournament-fixture-away"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-foreground [color-scheme:light] dark:[color-scheme:dark]"
              value={awayId}
              onChange={(event) => setAwayId(event.target.value)}
            >
              <option value="">Select team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <Label htmlFor="tournament-fixture-count">Number of fixtures</Label>
            <Input
              id="tournament-fixture-count"
              type="number"
              min="1"
              max="50"
              value={matchCount}
              onChange={(event) => setMatchCount(event.target.value)}
              className="text-foreground"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="button" onClick={onCreateTournament} disabled={creating || !name.trim()}>
            {creating ? "Creating tournament..." : "Create tournament"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={scheduleFixtures}
            disabled={saving || !isCreated}
          >
            {saving ? "Adding fixtures..." : "Add fixtures"}
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={() => void saveFinalTeams()}
            disabled={saving || !isCreated || !homeId || !awayId}
          >
            {saving ? "Saving final teams..." : "Save final teams"}
          </Button>
          <span className="text-sm text-muted-foreground">
            {isCreated
              ? `${fixtures.length} fixture${fixtures.length === 1 ? "" : "s"} currently scheduled. Select two teams to add more.`
              : "Create or select a tournament to enable fixtures"}
          </span>
        </div>
        <div className="space-y-2 border-t pt-5">
          <h3 className="font-semibold">Current tournament fixtures</h3>
          {fixtures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No fixtures yet. Add the first fixture above.
            </p>
          ) : (
            <div className="divide-y rounded-md border">
              {fixtures.map((fixture) => (
                <div key={fixture.id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="w-20 text-xs text-muted-foreground">
                    Matchday {fixture.matchday}
                  </span>
                  <span className="min-w-45 flex-1 font-medium">
                    {teamNames.get(fixture.home_team_id) ?? "Home team"}{" "}
                    <span className="text-muted-foreground">vs</span>{" "}
                    {teamNames.get(fixture.away_team_id) ?? "Away team"}
                  </span>
                  <span className="rounded bg-muted px-2 py-1 text-sm font-semibold tabular-nums">
                    {fixture.home_score ?? "-"} - {fixture.away_score ?? "-"}
                  </span>
                  <span className="text-xs text-muted-foreground">{fixture.status}</span>
                  <Button asChild variant="outline" size="sm">
                    <Link to="/match/$fixtureId" params={{ fixtureId: fixture.id }}>
                      Edit
                    </Link>
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Delete fixture"
                    onClick={() => void removeFixture(fixture.id)}
                  >
                    <X className="size-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-2 border-t pt-5">
          <h3 className="font-semibold">Saved tournaments</h3>
          {tournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Your completed tournaments will appear here after you save the final.
            </p>
          ) : (
            <div className="space-y-2">
              {tournaments.slice(0, 5).map((tournament) => (
                <div key={tournament.id} className="rounded-md border bg-muted/20 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{tournament.tournamentName}</span>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant={tournament.id === tournamentId ? "secondary" : "outline"}
                        size="sm"
                        onClick={() => onSelectTournament(tournament)}
                      >
                        <Plus className="size-4" />
                        {tournament.id === tournamentId ? "Selected" : "Create fixtures"}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => onEditTournament(tournament)}
                      >
                        <Pencil className="size-3.5" />
                        Edit final
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${tournament.tournamentName}`}
                        onClick={() => onDeleteTournament(tournament.id)}
                      >
                        <Trash2 className="size-4 text-destructive" />
                      </Button>
                    </div>
                  </div>
                  <p className="mt-1 text-sm">
                    Final: {tournament.homeTeam} {tournament.homeScore} - {tournament.awayScore}{" "}
                    {tournament.awayTeam}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Top scorer: {tournament.stats.topScorer.name} (
                    {tournament.stats.topScorer.goals}) | Top saves:{" "}
                    {tournament.stats.topSaver.name} ({tournament.stats.topSaver.saves})
                  </p>
                </div>
              ))}
              {tournaments.length > 5 && (
                <p className="text-xs text-muted-foreground">
                  Showing the 5 most recent tournaments. Open the Tournaments tab for the full
                  history.
                </p>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function FinalMatchScorecard() {
  const navigate = useNavigate();
  // Fetch teams and players
  const teamsQuery = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const playersQuery = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const competitionsQuery = useQuery({ queryKey: ["competitions"], queryFn: fetchCompetitions });
  const competitionId =
    competitionsQuery.data?.[0]?.id ??
    teamsQuery.data?.find((team) => team.competition_id)?.competition_id;
  const competitionFixturesQuery = useQuery({
    queryKey: ["competition-fixtures", competitionId],
    queryFn: () => fetchFixtures(competitionId),
    enabled: Boolean(competitionId),
    refetchOnWindowFocus: true,
  });
  const [tournamentId, setTournamentId] = useState("");
  const [activeTab, setActiveTab] = useState("tournament");
  const [expandedTournamentId, setExpandedTournamentId] = useState<string | null>(null);
  const fixturesQuery = useQuery({
    queryKey: ["fixtures", tournamentId],
    queryFn: () => fetchFixtures(undefined, tournamentId),
    enabled: Boolean(tournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const tournamentFixturesQuery = useQuery({
    queryKey: ["fixtures", expandedTournamentId],
    queryFn: () => fetchFixtures(undefined, expandedTournamentId ?? undefined),
    enabled: Boolean(expandedTournamentId),
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
  });
  const tournamentEventStatsQuery = useQuery({
    queryKey: [
      "tournament-event-stats",
      tournamentId,
      fixturesQuery.data?.map((fixture) => fixture.id).join(","),
    ],
    queryFn: async () => {
      const fixtures = fixturesQuery.data ?? [];
      const events = await Promise.all(fixtures.map((fixture) => fetchEvents(fixture.id)));
      return events.flat();
    },
    enabled: Boolean(tournamentId && fixturesQuery.data),
    refetchOnWindowFocus: true,
  });
  const tournamentsQuery = useQuery({
    queryKey: ["tournaments"],
    queryFn: () => fetchTournaments(),
  });
  const queryClient = useQueryClient();

  const saveTournamentMutation = useMutation({
    mutationFn: ({
      id,
      changes,
    }: {
      id: string;
      changes: Parameters<typeof updateTournament>[1];
    }) => updateTournament(id, changes),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament saved successfully!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to save tournament");
    },
  });

  const createTournamentMutation = useMutation({
    mutationFn: saveTournamentToDB,
    onSuccess: (createdTournament) => {
      const createdId = createdTournament?.id ?? tournamentId;
      if (createdId) {
        setTournamentId(createdId);
        localStorage.setItem("current-tournament-id", createdId);
      }

      const nextTournament: Tournament = {
        id: createdId,
        tournamentName:
          createdTournament?.tournament_name ||
          tournamentForm.name.trim() ||
          `${home.name} vs ${away.name}`,
        status: createdTournament?.status || "draft",
        type: createdTournament?.type || tournamentForm.type,
        date: createdTournament?.date || new Date().toISOString().split("T")[0],
        homeTeam: createdTournament?.home_team || "TBD",
        awayTeam: createdTournament?.away_team || "TBD",
        homeScore: createdTournament?.home_score ?? 0,
        awayScore: createdTournament?.away_score ?? 0,
        winner: createdTournament?.winner || "TBD",
        manager: createdTournament?.manager || tournamentForm.manager || "",
        participants: createdTournament?.participants ?? tournamentForm.participants,
        stats: {
          topScorer: {
            name: createdTournament?.top_scorer_name || "None",
            goals: createdTournament?.top_scorer_goals ?? 0,
          },
          topAssister: {
            name: createdTournament?.top_assister_name || "None",
            assists: createdTournament?.top_assister_assists ?? 0,
          },
          topSaver: {
            name: createdTournament?.top_saver_name || "None",
            saves: createdTournament?.top_saver_saves ?? 0,
          },
        },
      };

      setTournaments((prevTournaments) => [
        nextTournament,
        ...prevTournaments.filter((t) => t.id !== createdId),
      ]);
      queryClient.setQueryData(["tournaments"], (existingTournaments: Tournament[] | undefined) => [
        nextTournament,
        ...(existingTournaments ?? []).filter((t) => t.id !== createdId),
      ]);
      void queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      toast.success("Tournament created. You can now add fixtures.");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to create tournament");
    },
  });

  const deleteTournamentMutation = useMutation({
    mutationFn: deleteTournamentFromDB,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tournaments"] });
      queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      toast.success("Tournament deleted successfully!");
    },
    onError: (error) => {
      toast.error(error instanceof Error ? error.message : "Failed to delete tournament");
    },
  });

  const [home, setHome] = useState<TeamData>({
    name: "Team 1",
    players: INITIAL_HOME_PLAYERS,
    goals: [],
    assists: [],
    saves: [],
  });

  const [away, setAway] = useState<TeamData>({
    name: "Team 2",
    players: INITIAL_AWAY_PLAYERS,
    goals: [],
    assists: [],
    saves: [],
  });

  const [selectedHomeTeam, setSelectedHomeTeam] = useState<string>("");
  const [selectedAwayTeam, setSelectedAwayTeam] = useState<string>("");
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const currentTournament = tournaments.find((tournament) => tournament.id === tournamentId);
  const [editingPlayerTeam, setEditingPlayerTeam] = useState<"home" | "away" | null>(null);
  const [editingPlayerIndex, setEditingPlayerIndex] = useState<number | null>(null);
  const [editingPlayerName, setEditingPlayerName] = useState<string>("");
  const [saveTournamentOpen, setSaveTournamentOpen] = useState(false);
  const [savingFinalTeams, setSavingFinalTeams] = useState(false);
  const finalFixtureCreationKey = useRef<string | null>(null);
  const manuallySelectedFinalKey = useRef<string | null>(null);
  const [tournamentForm, setTournamentForm] = useState({
    name: "",
    type: "League",
    status: "draft" as "draft" | "completed",
    manager: "",
    participants: 12,
    topScorerName: "",
    topScorerGoals: "",
    topSaverName: "",
    topSaverSaves: "",
  });

  useEffect(() => {
    const stored = localStorage.getItem("current-tournament-id");
    const id = stored || createLocalTournamentId();
    localStorage.setItem("current-tournament-id", id);
    setTournamentId(id);
  }, []);

  // Load players for selected team
  const loadTeamPlayers = (teamId: string, side: "home" | "away") => {
    const team = teamsQuery.data?.find((t) => t.id === teamId);
    const teamPlayers = playersQuery.data?.filter((p) => p.team_id === teamId) ?? [];

    if (team) {
      const players: Player[] = teamPlayers.map((p) => ({
        id: p.id,
        name: p.name,
        isGK: p.position?.toLowerCase().includes("goalkeeper") ?? false,
      }));

      if (side === "home") {
        setHome({
          ...home,
          name: team.name,
          players: players.length > 0 ? players : home.players,
        });
        setSelectedHomeTeam(teamId);
      } else {
        setAway({
          ...away,
          name: team.name,
          players: players.length > 0 ? players : away.players,
        });
        setSelectedAwayTeam(teamId);
      }
    }
  };

  const leagueFixtures = useMemo(
    () => (competitionFixturesQuery.data ?? []).filter((fixture) => !fixture.tournament_id),
    [competitionFixturesQuery.data],
  );
  const competition = competitionsQuery.data?.find((item) => item.id === competitionId);
  const finalStandings = useMemo(
    () =>
      calculateFinalStandings(
        teamsQuery.data ?? [],
        leagueFixtures,
        competition?.points_win ?? 3,
        competition?.points_draw ?? 1,
      ),
    [teamsQuery.data, leagueFixtures, competition?.points_win, competition?.points_draw],
  );
  const homeFinalist = finalStandings[0];
  const awayFinalist = finalStandings[1];
  const leagueComplete =
    leagueFixtures.length > 0 &&
    leagueFixtures.every((fixture) => fixture.home_score != null && fixture.away_score != null);
  const finalHasBeenPosted = Boolean(
    currentTournament?.status === "completed" ||
    (fixturesQuery.data ?? []).some(
      (fixture) =>
        (fixture.notes?.includes("completed league standings") ||
          fixture.notes?.includes("Final teams selected manually")) &&
        fixture.home_score != null &&
        fixture.away_score != null &&
        fixture.status === "Full Time",
    ),
  );

  useEffect(() => {
    if (!homeFinalist || !awayFinalist) return;
    if (!leagueComplete) return;

    if (selectedHomeTeam !== homeFinalist.team_id) loadTeamPlayers(homeFinalist.team_id, "home");
    if (selectedAwayTeam !== awayFinalist.team_id) loadTeamPlayers(awayFinalist.team_id, "away");
    setTournamentForm((current) => ({
      ...current,
      name: current.name || `${homeFinalist.team_name} vs ${awayFinalist.team_name} Final`,
    }));
  }, [
    leagueComplete,
    homeFinalist,
    awayFinalist,
    selectedHomeTeam,
    selectedAwayTeam,
    teamsQuery.data,
    playersQuery.data,
  ]);

  // Delete tournament from both database and localStorage
  const handleDeleteTournament = async (id: string) => {
    if (!window.confirm("Delete this tournament and its saved final?")) return;

    // Remove from local state immediately
    setTournaments((prevTournaments) => prevTournaments.filter((t) => t.id !== id));

    if (id === tournamentId) {
      setTournamentId("");
      localStorage.removeItem("current-tournament-id");
    }

    // Try to delete from database if it's a UUID (database ID)
    if (id.includes("-") && id.length === 36) {
      deleteTournamentMutation.mutate(id);
    } else {
      // If it's a localStorage ID, just remove from localStorage
      const saved = localStorage.getItem("tournaments");
      if (saved) {
        try {
          const localTournaments: Tournament[] = JSON.parse(saved);
          const filtered = localTournaments.filter((t) => t.id !== id);
          localStorage.setItem("tournaments", JSON.stringify(filtered));
          toast.success("Tournament deleted successfully!");
        } catch (e) {
          console.error("Failed to delete from localStorage", e);
          toast.error("Failed to delete tournament");
        }
      }
    }
  };

  // Load tournaments from database and localStorage
  useEffect(() => {
    // Start with database tournaments
    if (tournamentsQuery.data && tournamentsQuery.data.length > 0) {
      const dbTournaments: Tournament[] = tournamentsQuery.data.map((t) => ({
        id: t.id,
        tournamentName: t.tournament_name || t.type,
        status: t.status,
        type: t.type,
        date: t.date,
        homeTeam: t.home_team,
        awayTeam: t.away_team,
        homeScore: t.home_score,
        awayScore: t.away_score,
        winner: t.winner,
        manager: t.manager || "",
        participants: t.participants || 12,
        stats: {
          topScorer: { name: t.top_scorer_name || "None", goals: t.top_scorer_goals || 0 },
          topAssister: {
            name: t.top_assister_name || "None",
            assists: t.top_assister_assists || 0,
          },
          topSaver: { name: t.top_saver_name || "None", saves: t.top_saver_saves || 0 },
        },
      }));
      setTournaments(dbTournaments);
      return;
    }

    // Fallback to localStorage if no database tournaments
    const saved = localStorage.getItem("tournaments");
    if (saved) {
      try {
        setTournaments(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to load tournaments", e);
      }
    }
  }, [tournamentsQuery.data]);

  const createTournament = () => {
    const nextTournamentName = tournamentForm.name.trim() || `${home.name} vs ${away.name}`;
    setTournamentForm((current) => ({ ...current, name: nextTournamentName }));

    createTournamentMutation.mutate({
      tournament_name: nextTournamentName,
      type: tournamentForm.type,
      date: new Date().toISOString().split("T")[0],
      home_team: "TBD",
      away_team: "TBD",
      home_score: 0,
      away_score: 0,
      winner: "TBD",
      manager: tournamentForm.manager || null,
      participants: tournamentForm.participants,
      top_scorer_name: null,
      top_scorer_goals: 0,
      top_assister_name: null,
      top_assister_assists: 0,
      top_saver_name: null,
      top_saver_saves: 0,
      status: tournamentForm.status,
    });
  };

  const isCurrentTournamentCreated = tournaments.some(
    (tournament) => tournament.id === tournamentId,
  );

  const saveSelectedFinalTeams = async () => {
    if (!isCurrentTournamentCreated) return toast.error("Create or select a tournament first");
    if (!selectedHomeTeam || !selectedAwayTeam || selectedHomeTeam === selectedAwayTeam) {
      return toast.error("Select two different teams for the final");
    }
    if (!competitionId) return toast.error("Select a competition before saving the final");

    const existingFinal = (tournamentFixturesQuery.data ?? []).find(
      (fixture) =>
        fixture.notes?.includes("completed league standings") ||
        fixture.notes?.includes("Final teams selected manually"),
    );

    setSavingFinalTeams(true);
    try {
      if (existingFinal) {
        await updateFixture(existingFinal.id, {
          home_team_id: selectedHomeTeam,
          away_team_id: selectedAwayTeam,
          home_score: null,
          away_score: null,
          status: "Scheduled",
          notes: "Final teams selected manually from the bracket.",
        });
      } else {
        await insertFixtures([
          {
            competition_id: competitionId,
            tournament_id: tournamentId,
            matchday:
              Math.max(
                0,
                ...(tournamentFixturesQuery.data ?? []).map((fixture) => fixture.matchday),
              ) + 1,
            home_team_id: selectedHomeTeam,
            away_team_id: selectedAwayTeam,
            kickoff: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            status: "Scheduled",
            notes: "Final teams selected manually from the bracket.",
          },
        ]);
      }
      manuallySelectedFinalKey.current = `${tournamentId}:${selectedHomeTeam}:${selectedAwayTeam}`;
      await queryClient.invalidateQueries({ queryKey: ["fixtures", tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      toast.success("Final teams saved. They will now appear on the home page.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save the final teams");
    } finally {
      setSavingFinalTeams(false);
    }
  };

  useEffect(() => {
    if (tournamentId || tournaments.length === 0) return;
    const firstTournament = tournaments[0];
    setTournamentId(firstTournament.id);
    localStorage.setItem("current-tournament-id", firstTournament.id);
  }, [tournamentId, tournaments]);

  useEffect(() => {
    if (
      !leagueComplete ||
      !homeFinalist ||
      !awayFinalist ||
      !competitionId ||
      !isCurrentTournamentCreated
    )
      return;
    if (tournamentFixturesQuery.isLoading) return;
    if (manuallySelectedFinalKey.current?.startsWith(`${tournamentId}:`)) return;
    if (
      (tournamentFixturesQuery.data ?? []).some(
        (fixture) =>
          fixture.notes?.includes("completed league standings") ||
          fixture.notes?.includes("Final teams selected manually"),
      )
    )
      return;

    const creationKey = `${tournamentId}:${homeFinalist.team_id}:${awayFinalist.team_id}`;
    if (finalFixtureCreationKey.current === creationKey) return;
    finalFixtureCreationKey.current = creationKey;

    const nextMatchday =
      Math.max(0, ...(tournamentFixturesQuery.data ?? []).map((fixture) => fixture.matchday)) + 1;
    void insertFixtures([
      {
        competition_id: competitionId,
        tournament_id: tournamentId,
        matchday: nextMatchday,
        home_team_id: homeFinalist.team_id,
        away_team_id: awayFinalist.team_id,
        kickoff: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        status: "Scheduled",
        notes: "Automatically created from the completed league standings.",
      },
    ])
      .then(() => {
        void queryClient.invalidateQueries({ queryKey: ["fixtures", tournamentId] });
        toast.success(
          `${homeFinalist.team_name} vs ${awayFinalist.team_name} added to the final bracket.`,
        );
      })
      .catch((error) => {
        finalFixtureCreationKey.current = null;
        toast.error(error instanceof Error ? error.message : "Could not create the final fixture");
      });
  }, [
    leagueComplete,
    homeFinalist,
    awayFinalist,
    competitionId,
    isCurrentTournamentCreated,
    tournamentId,
    tournamentFixturesQuery.data,
    tournamentFixturesQuery.isLoading,
    queryClient,
  ]);

  const selectTournamentForFixtures = (tournament: Tournament) => {
    setTournamentId(tournament.id);
    localStorage.setItem("current-tournament-id", tournament.id);
    setTournamentForm((current) => ({
      ...current,
      name: tournament.tournamentName,
      type: tournament.type,
      status: tournament.status,
    }));
    toast.success(`Now creating fixtures for ${tournament.tournamentName}`);
  };

  const loadTournamentFinalForEditing = async (tournament: Tournament) => {
    try {
      const fixtures = await fetchFixtures(undefined, tournament.id);
      const notedFinal = fixtures.find(
        (fixture) =>
          fixture.notes?.includes("completed league standings") ||
          fixture.notes?.includes("Final teams selected manually"),
      );
      const homeTeam = teamsQuery.data?.find((team) => team.name === tournament.homeTeam);
      const awayTeam = teamsQuery.data?.find((team) => team.name === tournament.awayTeam);
      const finalFixture =
        notedFinal ??
        fixtures.find(
          (fixture) =>
            fixture.home_team_id === homeTeam?.id &&
            fixture.away_team_id === awayTeam?.id &&
            fixture.home_score != null &&
            fixture.away_score != null,
        );
      if (!finalFixture) {
        toast.error("No final fixture was found for this tournament.");
        return;
      }

      const [finalEvents, allPlayers] = await Promise.all([
        fetchEvents(finalFixture.id),
        fetchPlayers(),
      ]);
      const homePlayers = allPlayers
        .filter((player) => player.team_id === finalFixture.home_team_id)
        .map((player) => ({
          id: player.id,
          name: player.name,
          isGK: player.position?.toLowerCase().includes("goalkeeper") ?? false,
        }));
      const awayPlayers = allPlayers
        .filter((player) => player.team_id === finalFixture.away_team_id)
        .map((player) => ({
          id: player.id,
          name: player.name,
          isGK: player.position?.toLowerCase().includes("goalkeeper") ?? false,
        }));
      const playerNames = new Map(allPlayers.map((player) => [player.id, player.name]));
      const goalsFor = (teamId: string) =>
        finalEvents
          .filter(
            (event) => event.event_type === "goal" && event.team_id === teamId && event.player_id,
          )
          .map((event, index) => ({
            id: event.id || `goal-${teamId}-${index}`,
            playerId: event.player_id ?? "",
            playerName: playerNames.get(event.player_id ?? "") ?? "",
            minute: event.minute,
          }));
      const savesFor = (teamId: string) =>
        finalEvents
          .filter(
            (event) => event.event_type === "save" && event.team_id === teamId && event.player_id,
          )
          .map((event, index) => ({
            id: event.id || `save-${teamId}-${index}`,
            playerId: event.player_id ?? "",
            playerName: playerNames.get(event.player_id ?? "") ?? "",
            minute: event.minute,
          }));

      setTournamentId(tournament.id);
      localStorage.setItem("current-tournament-id", tournament.id);
      setSelectedHomeTeam(finalFixture.home_team_id);
      setSelectedAwayTeam(finalFixture.away_team_id);
      setHome({
        name: tournament.homeTeam,
        players: homePlayers,
        goals: goalsFor(finalFixture.home_team_id),
        assists: [],
        saves: savesFor(finalFixture.home_team_id),
      });
      setAway({
        name: tournament.awayTeam,
        players: awayPlayers,
        goals: goalsFor(finalFixture.away_team_id),
        assists: [],
        saves: savesFor(finalFixture.away_team_id),
      });
      setTournamentForm((current) => ({
        ...current,
        name: tournament.tournamentName,
        type: tournament.type,
        manager: tournament.manager,
        participants: tournament.participants,
        topScorerName:
          tournament.stats.topScorer.name === "None" ? "" : tournament.stats.topScorer.name,
        topScorerGoals: String(tournament.stats.topScorer.goals),
        topSaverName:
          tournament.stats.topSaver.name === "None" ? "" : tournament.stats.topSaver.name,
        topSaverSaves: String(tournament.stats.topSaver.saves),
      }));
      setActiveTab("tournament");
      toast.success("Final loaded for editing.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not load the final for editing");
    }
  };

  const editTournamentFinal = (tournament: Tournament) => {
    localStorage.setItem("edit-final-tournament-id", tournament.id);
    localStorage.setItem("current-tournament-id", tournament.id);
    void navigate({ to: "/scorecard" });
  };

  useEffect(() => {
    const editTournamentId = localStorage.getItem("edit-final-tournament-id");
    if (!editTournamentId) return;
    const tournament = tournaments.find((item) => item.id === editTournamentId);
    if (!tournament) return;

    localStorage.removeItem("edit-final-tournament-id");
    void loadTournamentFinalForEditing(tournament);
  }, [tournaments]);

  useEffect(() => {
    const selectedTournament = tournaments.find((tournament) => tournament.id === tournamentId);
    if (!selectedTournament) return;
    setTournamentForm((current) => ({
      ...current,
      name: selectedTournament.tournamentName,
      type: selectedTournament.type,
    }));
  }, [tournamentId, tournaments]);

  // Save tournaments to localStorage
  useEffect(() => {
    localStorage.setItem("tournaments", JSON.stringify(tournaments));
  }, [tournaments]);

  // Update team name
  const updateTeamName = (team: "home" | "away", name: string) => {
    if (team === "home") {
      setHome({ ...home, name });
    } else {
      setAway({ ...away, name });
    }
  };

  // Add player
  const addPlayer = (team: "home" | "away") => {
    const newPlayer: Player = {
      id: `${team}-${Date.now()}`,
      name: "New Player",
      isGK: false,
    };
    if (team === "home") {
      setHome({ ...home, players: [...home.players, newPlayer] });
    } else {
      setAway({ ...away, players: [...away.players, newPlayer] });
    }
  };

  // Toggle player as GK
  const toggleGK = (team: "home" | "away", index: number) => {
    if (team === "home") {
      const updatedPlayers = [...home.players];
      updatedPlayers[index].isGK = !updatedPlayers[index].isGK;
      setHome({ ...home, players: updatedPlayers });
    } else {
      const updatedPlayers = [...away.players];
      updatedPlayers[index].isGK = !updatedPlayers[index].isGK;
      setAway({ ...away, players: updatedPlayers });
    }
  };

  // Start editing player
  const startEditPlayer = (team: "home" | "away", index: number) => {
    setEditingPlayerTeam(team);
    setEditingPlayerIndex(index);
    const players = team === "home" ? home.players : away.players;
    setEditingPlayerName(players[index].name);
  };

  // Save edited player
  const saveEditPlayer = () => {
    if (editingPlayerTeam === null || editingPlayerIndex === null) return;

    if (editingPlayerTeam === "home") {
      const updatedPlayers = [...home.players];
      updatedPlayers[editingPlayerIndex].name = editingPlayerName;
      setHome({ ...home, players: updatedPlayers });
    } else {
      const updatedPlayers = [...away.players];
      updatedPlayers[editingPlayerIndex].name = editingPlayerName;
      setAway({ ...away, players: updatedPlayers });
    }

    setEditingPlayerTeam(null);
    setEditingPlayerIndex(null);
    setEditingPlayerName("");
  };

  // Remove player
  const removePlayer = (team: "home" | "away", index: number) => {
    if (team === "home") {
      const playerId = home.players[index].id;
      setHome({
        ...home,
        players: home.players.filter((_, i) => i !== index),
        goals: home.goals.filter((g) => g.playerId !== playerId),
        assists: home.assists.filter((a) => a.playerId !== playerId),
        saves: home.saves.filter((s) => s.playerId !== playerId),
      });
    } else {
      const playerId = away.players[index].id;
      setAway({
        ...away,
        players: away.players.filter((_, i) => i !== index),
        goals: away.goals.filter((g) => g.playerId !== playerId),
        assists: away.assists.filter((a) => a.playerId !== playerId),
        saves: away.saves.filter((s) => s.playerId !== playerId),
      });
    }
  };

  // Add goal
  const addGoal = (team: "home" | "away") => {
    const players = team === "home" ? home.players : away.players;
    if (players.length === 0) return;

    const newGoal: Goal = {
      id: `goal-${Date.now()}`,
      playerId: players[0].id,
      playerName: players[0].name,
    };

    if (team === "home") {
      setHome({ ...home, goals: [...home.goals, newGoal] });
    } else {
      setAway({ ...away, goals: [...away.goals, newGoal] });
    }
  };

  // Update goal
  const updateGoal = (team: "home" | "away", goalIndex: number, updates: Partial<Goal>) => {
    if (team === "home") {
      const updatedGoals = [...home.goals];
      updatedGoals[goalIndex] = { ...updatedGoals[goalIndex], ...updates };
      setHome({ ...home, goals: updatedGoals });
    } else {
      const updatedGoals = [...away.goals];
      updatedGoals[goalIndex] = { ...updatedGoals[goalIndex], ...updates };
      setAway({ ...away, goals: updatedGoals });
    }
  };

  // Remove goal
  const removeGoal = (team: "home" | "away", goalIndex: number) => {
    if (team === "home") {
      setHome({ ...home, goals: home.goals.filter((_, i) => i !== goalIndex) });
    } else {
      setAway({ ...away, goals: away.goals.filter((_, i) => i !== goalIndex) });
    }
  };

  // Add assist
  const addAssist = (team: "home" | "away") => {
    const players = team === "home" ? home.players : away.players;
    if (players.length === 0) return;

    const newAssist: Assist = {
      id: `assist-${Date.now()}`,
      playerId: players[0].id,
      playerName: players[0].name,
    };

    if (team === "home") {
      setHome({ ...home, assists: [...home.assists, newAssist] });
    } else {
      setAway({ ...away, assists: [...away.assists, newAssist] });
    }
  };

  // Update assist
  const updateAssist = (team: "home" | "away", assistIndex: number, playerId: string) => {
    const players = team === "home" ? home.players : away.players;
    const player = players.find((p) => p.id === playerId);

    if (team === "home") {
      const updatedAssists = [...home.assists];
      updatedAssists[assistIndex] = {
        ...updatedAssists[assistIndex],
        playerId,
        playerName: player?.name || "",
      };
      setHome({ ...home, assists: updatedAssists });
    } else {
      const updatedAssists = [...away.assists];
      updatedAssists[assistIndex] = {
        ...updatedAssists[assistIndex],
        playerId,
        playerName: player?.name || "",
      };
      setAway({ ...away, assists: updatedAssists });
    }
  };

  // Remove assist
  const removeAssist = (team: "home" | "away", assistIndex: number) => {
    if (team === "home") {
      setHome({ ...home, assists: home.assists.filter((_, i) => i !== assistIndex) });
    } else {
      setAway({ ...away, assists: away.assists.filter((_, i) => i !== assistIndex) });
    }
  };

  // Add save
  const addSave = (team: "home" | "away") => {
    const gkPlayers = (team === "home" ? home.players : away.players).filter((p) => p.isGK);
    if (gkPlayers.length === 0) return;

    const newSave: Save = {
      id: `save-${Date.now()}`,
      playerId: gkPlayers[0].id,
      playerName: gkPlayers[0].name,
    };

    if (team === "home") {
      setHome({ ...home, saves: [...home.saves, newSave] });
    } else {
      setAway({ ...away, saves: [...away.saves, newSave] });
    }
  };

  // Update save
  const updateSave = (team: "home" | "away", saveIndex: number, updates: Partial<Save>) => {
    if (team === "home") {
      const updatedSaves = [...home.saves];
      updatedSaves[saveIndex] = { ...updatedSaves[saveIndex], ...updates };
      setHome({ ...home, saves: updatedSaves });
    } else {
      const updatedSaves = [...away.saves];
      updatedSaves[saveIndex] = { ...updatedSaves[saveIndex], ...updates };
      setAway({ ...away, saves: updatedSaves });
    }
  };

  // Remove save
  const removeSave = (team: "home" | "away", saveIndex: number) => {
    if (team === "home") {
      setHome({ ...home, saves: home.saves.filter((_, i) => i !== saveIndex) });
    } else {
      setAway({ ...away, saves: away.saves.filter((_, i) => i !== saveIndex) });
    }
  };

  // Calculate tournament stats
  const calculateStats = (): TournamentStats => {
    const allGoals = [...home.goals, ...away.goals];
    const allSaves = [...home.saves, ...away.saves];
    const finalFixture = (fixturesQuery.data ?? []).find(
      (fixture) =>
        fixture.home_team_id === selectedHomeTeam && fixture.away_team_id === selectedAwayTeam,
    );
    const playerNames = new Map(
      (playersQuery.data ?? []).map((player) => [player.id, player.name]),
    );
    const historicalEvents = (tournamentEventStatsQuery.data ?? []).filter(
      (event) => event.fixture_id !== finalFixture?.id,
    );

    const goalCounts = new Map<string, number>();
    historicalEvents
      .filter((event) => event.event_type === "goal" && event.player_id)
      .forEach((event) => {
        const playerName = playerNames.get(event.player_id ?? "");
        if (playerName) goalCounts.set(playerName, (goalCounts.get(playerName) || 0) + 1);
      });
    allGoals.forEach((g) => {
      goalCounts.set(g.playerName, (goalCounts.get(g.playerName) || 0) + 1);
    });

    const saveCounts = new Map<string, number>();
    historicalEvents
      .filter((event) => event.event_type === "save" && event.player_id)
      .forEach((event) => {
        const playerName = playerNames.get(event.player_id ?? "");
        if (playerName) saveCounts.set(playerName, (saveCounts.get(playerName) || 0) + 1);
      });
    allSaves.forEach((s) => {
      saveCounts.set(s.playerName, (saveCounts.get(s.playerName) || 0) + 1);
    });

    const topScorer = [...goalCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["None", 0];
    const topSaver = [...saveCounts.entries()].sort((a, b) => b[1] - a[1])[0] || ["None", 0];

    return {
      topScorer: { name: topScorer[0], goals: topScorer[1] },
      topAssister: { name: "None", assists: 0 },
      topSaver: { name: topSaver[0], saves: topSaver[1] },
    };
  };

  // Save tournament
  const saveTournament = async () => {
    const homeScore = home.goals.length;
    const awayScore = away.goals.length;
    const winner = homeScore > awayScore ? home.name : awayScore > homeScore ? away.name : "Draw";
    const stats = calculateStats();
    const topScorerName = tournamentForm.topScorerName.trim() || stats.topScorer.name;
    const topSaverName = tournamentForm.topSaverName.trim() || stats.topSaver.name;
    const topScorerGoals =
      tournamentForm.topScorerGoals === ""
        ? stats.topScorer.goals
        : Number(tournamentForm.topScorerGoals);
    const topSaverSaves =
      tournamentForm.topSaverSaves === ""
        ? stats.topSaver.saves
        : Number(tournamentForm.topSaverSaves);

    const newTournament = {
      id: tournamentId,
      tournament_name: tournamentForm.name.trim() || `${home.name} vs ${away.name}`,
      type: tournamentForm.type,
      date: new Date().toISOString().split("T")[0],
      home_team: home.name,
      away_team: away.name,
      home_score: homeScore,
      away_score: awayScore,
      winner,
      manager: tournamentForm.manager || null,
      participants: tournamentForm.participants,
      top_scorer_name: topScorerName,
      top_scorer_goals: topScorerGoals,
      top_assister_name: stats.topAssister.name,
      top_assister_assists: stats.topAssister.assists,
      top_saver_name: topSaverName,
      top_saver_saves: topSaverSaves,
      status: "completed" as const,
    };

    const finalFixture = (fixturesQuery.data ?? []).find(
      (fixture) =>
        (fixture.home_team_id === selectedHomeTeam && fixture.away_team_id === selectedAwayTeam) ||
        fixture.notes?.includes("completed league standings") ||
        fixture.notes?.includes("Final teams selected manually"),
    );
    if (!finalFixture) {
      toast.error("Save the final teams before recording the final result.");
      return;
    }

    try {
      await updateFixture(finalFixture.id, {
        home_score: homeScore,
        away_score: awayScore,
        status: "Full Time",
      });
      await replaceFixtureEvents(finalFixture.id, [
        ...home.goals.map((goal) => ({
          team_id: selectedHomeTeam,
          player_id: goal.playerId,
          minute: goal.minute ?? 0,
          event_type: "goal",
        })),
        ...away.goals.map((goal) => ({
          team_id: selectedAwayTeam,
          player_id: goal.playerId,
          minute: goal.minute ?? 0,
          event_type: "goal",
        })),
        ...home.saves.map((save) => ({
          team_id: selectedHomeTeam,
          player_id: save.playerId,
          minute: save.minute ?? 0,
          event_type: "save",
        })),
        ...away.saves.map((save) => ({
          team_id: selectedAwayTeam,
          player_id: save.playerId,
          minute: save.minute ?? 0,
          event_type: "save",
        })),
      ]);
      await queryClient.invalidateQueries({ queryKey: ["fixtures", tournamentId] });
      await queryClient.invalidateQueries({ queryKey: ["fixtures"] });
      await queryClient.invalidateQueries({ queryKey: ["scorers"] });
      await queryClient.invalidateQueries({ queryKey: ["saves"] });
      await queryClient.invalidateQueries({ queryKey: ["tournaments"] });
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not save the final goals and saves",
      );
      return;
    }

    let savedTournamentId = tournamentId;
    try {
      if (isCurrentTournamentCreated) {
        const { id: _id, ...changes } = newTournament;
        await saveTournamentMutation.mutateAsync({ id: tournamentId, changes });
      } else {
        const { id: _id, ...newTournamentWithoutLocalId } = newTournament;
        const createdTournament = await createTournamentMutation.mutateAsync(
          newTournamentWithoutLocalId,
        );
        savedTournamentId = createdTournament?.id ?? tournamentId;
      }
    } catch {
      return;
    }

    // Also save to localStorage for backwards compatibility
    const localTournament: Tournament = {
      id: savedTournamentId,
      tournamentName: newTournament.tournament_name,
      type: newTournament.type,
      date: newTournament.date,
      homeTeam: newTournament.home_team,
      awayTeam: newTournament.away_team,
      homeScore: newTournament.home_score,
      awayScore: newTournament.away_score,
      winner: newTournament.winner,
      status: "completed",
      manager: newTournament.manager || "",
      participants: newTournament.participants,
      stats: {
        topScorer: { name: topScorerName, goals: topScorerGoals },
        topAssister: { name: "None", assists: 0 },
        topSaver: { name: topSaverName, saves: topSaverSaves },
      },
    };

    setTournaments((prevTournaments) => [
      localTournament,
      ...prevTournaments.filter((t) => t.id !== savedTournamentId),
    ]);
    setSaveTournamentOpen(false);
    const nextTournamentId = createLocalTournamentId();
    setTournamentId(nextTournamentId);
    localStorage.setItem("current-tournament-id", nextTournamentId);
    setSelectedHomeTeam("");
    setSelectedAwayTeam("");
    setTournamentForm({
      name: "",
      type: "League",
      status: "draft",
      manager: "",
      participants: 12,
      topScorerName: "",
      topScorerGoals: "",
      topSaverName: "",
      topSaverSaves: "",
    });
    resetMatch();
  };

  // Reset match
  const resetMatch = () => {
    setHome({
      name: "Team 1",
      players: INITIAL_HOME_PLAYERS,
      goals: [],
      assists: [],
      saves: [],
    });
    setAway({
      name: "Team 2",
      players: INITIAL_AWAY_PLAYERS,
      goals: [],
      assists: [],
      saves: [],
    });
  };

  const gkFilteredPlayers = (players: Player[]) => players.filter((p) => p.isGK);
  const outfieldPlayers = (players: Player[]) => players.filter((p) => !p.isGK);

  return (
    <Tabs
      value={activeTab}
      onValueChange={setActiveTab}
      className="min-h-screen bg-linear-to-br from-[#102a3a] via-[#145b62] to-[#287f72]"
    >
      <TabsList className="sticky top-0 z-10 w-full justify-start rounded-none border-b-2 border-pitch-foreground/20 bg-card/95 backdrop-blur-xl p-0 shadow-lg">
        <TabsTrigger
          value="tournament"
          className="rounded-none px-4 sm:px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary"
        >
          <Trophy className="h-4 w-4 mr-2" />
          <span className="text-base sm:text-lg">Create Tournament</span>
        </TabsTrigger>
        <TabsTrigger
          value="match"
          className="rounded-none px-4 sm:px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary"
        >
          <Zap className="h-4 w-4 mr-2" />
          <span className="text-base sm:text-lg">Create Final</span>
        </TabsTrigger>
        <TabsTrigger
          value="tournaments"
          className="rounded-none px-4 sm:px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary"
        >
          <Trophy className="h-4 w-4 mr-2" />
          <span className="text-base sm:text-lg">Tournaments</span>
        </TabsTrigger>
        <TabsTrigger
          value="stats"
          className="rounded-none px-4 sm:px-6 py-3 data-[state=active]:border-b-2 data-[state=active]:border-primary"
        >
          <BarChart3 className="h-4 w-4 mr-2" />
          <span className="text-base sm:text-lg">Statistics</span>
        </TabsTrigger>
      </TabsList>

      {/* TOURNAMENT SETUP TAB */}
      <TabsContent value="tournament" className="py-8 px-4 sm:py-12">
        <div className="mx-auto max-w-6xl">
          <TournamentSetup
            name={tournamentForm.name}
            onNameChange={(name) => setTournamentForm({ ...tournamentForm, name })}
            status={tournamentForm.status}
            onStatusChange={(status) => setTournamentForm((current) => ({ ...current, status }))}
            teams={teamsQuery.data ?? []}
            competitionId={competitionId ?? null}
            tournamentId={tournamentId}
            fixtures={fixturesQuery.data ?? []}
            onFixturesSaved={() =>
              void queryClient.invalidateQueries({ queryKey: ["fixtures", tournamentId] })
            }
            tournaments={tournaments}
            onCreateTournament={createTournament}
            onSelectTournament={selectTournamentForFixtures}
            onEditTournament={editTournamentFinal}
            onDeleteTournament={(id) => void handleDeleteTournament(id)}
            creating={createTournamentMutation.isPending}
            isCreated={isCurrentTournamentCreated}
          />
        </div>
      </TabsContent>

      {/* FINAL MATCH TAB */}
      <TabsContent value="match" className="py-8 px-4 sm:py-12">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-8 sm:mb-12 text-center">
            <div className="flex items-center justify-center gap-3 mb-3">
              <Zap className="h-8 w-8 text-pitch-foreground" />
              <h1 className="font-display text-3xl sm:text-5xl font-bold tracking-tight text-pitch-foreground">
                FINAL MATCH SCORECARD
              </h1>
              <Zap className="h-8 w-8 text-pitch-foreground" />
            </div>
            <p className="text-pitch-foreground/70 text-sm sm:text-base">
              Create, manage, and save championship matches
            </p>
          </div>

          <Card className="mb-8 border-2 border-primary/30 bg-card/95">
            <CardContent className="grid gap-3 p-5 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <Label htmlFor="final-tournament">Tournament this final belongs to</Label>
                <Select
                  value={isCurrentTournamentCreated ? tournamentId : ""}
                  onValueChange={(value) => {
                    setTournamentId(value);
                    const selected = tournaments.find((tournament) => tournament.id === value);
                    if (selected) {
                      setTournamentForm((current) => ({
                        ...current,
                        name: selected.tournamentName,
                        type: selected.type,
                        status: selected.status,
                      }));
                    }
                  }}
                >
                  <SelectTrigger id="final-tournament">
                    <SelectValue placeholder="Select a created tournament" />
                  </SelectTrigger>
                  <SelectContent>
                    {tournaments.map((tournament) => (
                      <SelectItem key={tournament.id} value={tournament.id}>
                        {tournament.tournamentName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <p className="text-sm text-muted-foreground">
                {isCurrentTournamentCreated
                  ? `Saving for ${tournamentForm.name || "selected tournament"}`
                  : "Create a tournament in the first tab before recording a final."}
              </p>
            </CardContent>
          </Card>

          {homeFinalist && awayFinalist && !finalHasBeenPosted && (
            <Card className="mb-8 border-2 border-[#f28c5b]/40 bg-white text-slate-900 shadow-lg dark:bg-[#18212d] dark:text-foreground">
              <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-bold uppercase tracking-wider text-[#16756b]">
                    {leagueComplete ? "Finalists confirmed" : "Current final places"}
                  </p>
                  <p className="mt-1 font-semibold text-slate-800 dark:text-foreground">
                    {leagueComplete
                      ? "The final has been prepared from the top two teams."
                      : "The top two teams currently lead the standings."}
                  </p>
                  <p className="mt-1 text-sm text-slate-600 dark:text-muted-foreground">
                    1st {homeFinalist.team_name} <span className="px-1">vs</span> 2nd{" "}
                    {awayFinalist.team_name}
                  </p>
                </div>
                <div className="shrink-0 rounded-lg bg-slate-50 px-4 py-3 text-center shadow-sm dark:bg-muted/40">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-muted-foreground">
                    {leagueComplete ? "Final status" : "Qualification"}
                  </p>
                  <p className="mt-1 text-sm font-bold text-primary">
                    {leagueComplete ? "TO BE PLAYED" : "Top two currently qualify"}
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Current Teams Selection */}
          <Card className="mb-8 border-2 border-[#f28c5b]/40 bg-linear-to-br from-[#fff8f1] via-card to-[#e9f5f1] backdrop-blur-sm shadow-lg dark:from-[#18212d] dark:via-card dark:to-[#1b2a2c]">
            <CardHeader className="bg-linear-to-r from-[#f28c5b]/20 to-[#2f8f83]/10 border-b border-[#f28c5b]/25 dark:from-[#3b2932] dark:to-[#173d3d]">
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                📋 Select Current Teams
              </CardTitle>
            </CardHeader>
            <CardContent className="p-6">
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Team 1 Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Team 1</Label>
                  <Select
                    value={selectedHomeTeam}
                    onValueChange={(teamId) => loadTeamPlayers(teamId, "home")}
                  >
                    <SelectTrigger className="bg-background border-2 hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="Select team 1..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(teamsQuery.data ?? []).map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedHomeTeam && (
                    <p className="text-sm text-muted-foreground">
                      ✓ {home.players.length} player{home.players.length !== 1 ? "s" : ""} loaded
                    </p>
                  )}
                </div>

                {/* Team 2 Selection */}
                <div className="space-y-3">
                  <Label className="text-base font-semibold text-foreground">Team 2</Label>
                  <Select
                    value={selectedAwayTeam}
                    onValueChange={(teamId) => loadTeamPlayers(teamId, "away")}
                  >
                    <SelectTrigger className="bg-background border-2 hover:border-primary/50 transition-colors">
                      <SelectValue placeholder="Select team 2..." />
                    </SelectTrigger>
                    <SelectContent>
                      {(teamsQuery.data ?? []).map((team) => (
                        <SelectItem key={team.id} value={team.id}>
                          {team.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedAwayTeam && (
                    <p className="text-sm text-muted-foreground">
                      ✓ {away.players.length} player{away.players.length !== 1 ? "s" : ""} loaded
                    </p>
                  )}
                </div>
              </div>
              <div className="flex flex-col gap-3 border-t border-[#f28c5b]/20 pt-5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-muted-foreground">
                  Choose both finalists, then save them to the tournament bracket and home page.
                </p>
                <Button
                  type="button"
                  variant="secondary"
                  className="shrink-0 bg-[#16756b] text-white hover:bg-[#105d55]"
                  onClick={() => void saveSelectedFinalTeams()}
                  disabled={
                    savingFinalTeams ||
                    !isCurrentTournamentCreated ||
                    !selectedHomeTeam ||
                    !selectedAwayTeam
                  }
                >
                  {savingFinalTeams ? "Saving final teams..." : "Save final teams"}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Main Match Display */}
          <Card className="mb-8 overflow-hidden border-3 border-[#f28c5b]/35 bg-linear-to-b from-[#fffaf5] to-[#e9f5f1] text-foreground shadow-2xl backdrop-blur-sm dark:from-[#18212d] dark:to-[#1b2a2c]">
            <CardContent className="p-6 sm:p-8">
              {/* Match Header with Editable Team Names */}
              <div className="mb-8">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-6">
                  {/* Team 1 */}
                  <div className="flex-1 text-center min-w-0">
                    <input
                      type="text"
                      value={home.name}
                      onChange={(e) => updateTeamName("home", e.target.value)}
                      className="w-full bg-transparent text-center text-2xl sm:text-3xl font-bold text-card-foreground outline-none ring-2 ring-transparent transition-all hover:ring-primary/30 focus:ring-primary/50 px-2 py-1 rounded hover:bg-primary/5 truncate"
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Team 1</p>
                  </div>

                  {/* VS and Score - More Prominent */}
                  <div className="flex flex-col items-center gap-3 px-4 sm:px-8 flex-shrink-0">
                    <div className="text-sm sm:text-lg font-bold text-muted-foreground tracking-wider">
                      VS
                    </div>
                    <div className="font-display text-5xl sm:text-7xl font-black text-foreground tabular-nums drop-shadow-[0_0_18px_color-mix(in_oklab,var(--accent)_35%,transparent)] dark:text-[#fff7e6] dark:drop-shadow-[0_0_18px_rgba(255,214,102,0.6)]">
                      {home.goals.length} — {away.goals.length}
                    </div>
                    <div className="text-xs sm:text-sm text-muted-foreground font-medium">
                      Final Score
                    </div>
                  </div>

                  {/* Team 2 */}
                  <div className="flex-1 text-center min-w-0">
                    <input
                      type="text"
                      value={away.name}
                      onChange={(e) => updateTeamName("away", e.target.value)}
                      className="w-full bg-transparent text-center text-2xl sm:text-3xl font-bold text-card-foreground outline-none ring-2 ring-transparent transition-all hover:ring-primary/30 focus:ring-primary/50 px-2 py-1 rounded hover:bg-primary/5 truncate"
                    />
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Team 2</p>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="mt-8 flex flex-col sm:flex-row justify-center gap-3">
                  <Dialog open={saveTournamentOpen} onOpenChange={setSaveTournamentOpen}>
                    <DialogTrigger asChild>
                      <Button className="gap-2 bg-linear-to-r from-[#e66f51] to-[#2f8f83] text-white hover:from-[#d95f43] hover:to-[#26776d] shadow-lg">
                        <Crown className="h-4 w-4" />
                        {isCurrentTournamentCreated
                          ? "Save Final"
                          : "Create Tournament & Save Final"}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {isCurrentTournamentCreated ? "Save Final" : "Create Tournament"}
                        </DialogTitle>
                        <DialogDescription>
                          {isCurrentTournamentCreated
                            ? `Save this final to ${tournamentForm.name || "the selected tournament"}.`
                            : "Name your tournament, record the final, and save its tournament-wide leaders."}
                        </DialogDescription>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div>
                          <Label>Tournament Name</Label>
                          <Input
                            value={tournamentForm.name}
                            onChange={(e) =>
                              setTournamentForm({ ...tournamentForm, name: e.target.value })
                            }
                            placeholder="e.g. Summer Cup 2026"
                          />
                        </div>
                        <div>
                          <Label>Tournament Type</Label>
                          <Select
                            value={tournamentForm.type}
                            onValueChange={(value) =>
                              setTournamentForm({ ...tournamentForm, type: value })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="League">League</SelectItem>
                              <SelectItem value="Cup">Cup</SelectItem>
                              <SelectItem value="Friendly">Friendly</SelectItem>
                              <SelectItem value="Championship">Championship</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div>
                          <Label>Winning Manager</Label>
                          <Input
                            value={tournamentForm.manager}
                            onChange={(e) =>
                              setTournamentForm({ ...tournamentForm, manager: e.target.value })
                            }
                            placeholder="Enter manager name"
                          />
                        </div>
                        <div>
                          <Label>Number of Participants</Label>
                          <Input
                            type="number"
                            value={tournamentForm.participants}
                            onChange={(e) =>
                              setTournamentForm({
                                ...tournamentForm,
                                participants: parseInt(e.target.value),
                              })
                            }
                            min="2"
                            className="text-foreground"
                          />
                        </div>
                        <div className="border-t pt-4">
                          <p className="mb-3 text-sm font-semibold">Whole-tournament leaders</p>
                          <p className="mb-3 text-xs text-muted-foreground">
                            The final teams and score above are saved as the final. Add the leaders
                            from all tournament matches here.
                          </p>
                          <div className="grid gap-3 sm:grid-cols-2">
                            <div>
                              <Label>Top goal scorer</Label>
                              <Input
                                value={tournamentForm.topScorerName}
                                onChange={(e) =>
                                  setTournamentForm({
                                    ...tournamentForm,
                                    topScorerName: e.target.value,
                                  })
                                }
                                placeholder="Player name"
                              />
                            </div>
                            <div>
                              <Label>Total goals</Label>
                              <Input
                                type="number"
                                min="0"
                                value={tournamentForm.topScorerGoals}
                                onChange={(e) =>
                                  setTournamentForm({
                                    ...tournamentForm,
                                    topScorerGoals: e.target.value,
                                  })
                                }
                                placeholder={`${calculateStats().topScorer.goals}`}
                                className="text-foreground"
                              />
                            </div>
                            <div>
                              <Label>Top saves</Label>
                              <Input
                                value={tournamentForm.topSaverName}
                                onChange={(e) =>
                                  setTournamentForm({
                                    ...tournamentForm,
                                    topSaverName: e.target.value,
                                  })
                                }
                                placeholder="Goalkeeper name"
                              />
                            </div>
                            <div>
                              <Label>Total saves</Label>
                              <Input
                                type="number"
                                min="0"
                                value={tournamentForm.topSaverSaves}
                                onChange={(e) =>
                                  setTournamentForm({
                                    ...tournamentForm,
                                    topSaverSaves: e.target.value,
                                  })
                                }
                                placeholder={`${calculateStats().topSaver.saves}`}
                                className="text-foreground"
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button variant="outline" onClick={() => setSaveTournamentOpen(false)}>
                          Cancel
                        </Button>
                        <Button onClick={saveTournament}>Save Tournament</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>

                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="outline" className="gap-2 border-2 hover:bg-destructive/5">
                        <RotateCcw className="h-4 w-4" />
                        Reset Match
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>🔄 Reset Match?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will clear all teams, players, goals, and match data. This action
                          cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogAction
                        onClick={resetMatch}
                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      >
                        Reset Everything
                      </AlertDialogAction>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Goals Section */}
          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            {/* Home Team Goals */}
            <Card className="border-3 border-primary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 border-b-2 border-primary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">⚽</span>
                  {home.name} — Goals ({home.goals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {home.goals.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6 italic">
                      No goals recorded yet
                    </p>
                  ) : (
                    home.goals.map((goal, idx) => (
                      <div
                        key={goal.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 transition-all border border-primary/20 group"
                      >
                        <span className="text-lg font-bold text-primary w-8 text-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <Select
                          value={goal.playerId}
                          onValueChange={(playerId) => {
                            const player = home.players.find((p) => p.id === playerId);
                            updateGoal("home", idx, {
                              playerId,
                              playerName: player?.name || "",
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background/80 border-primary/30 hover:border-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {outfieldPlayers(home.players).map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={goal.minute ?? ""}
                          onChange={(e) =>
                            updateGoal("home", idx, {
                              minute: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          placeholder="Min"
                          className="w-20 bg-background/80 border-primary/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGoal("home", idx)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  onClick={() => addGoal("home")}
                  disabled={outfieldPlayers(home.players).length === 0}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Goal
                </Button>
              </CardContent>
            </Card>

            {/* Away Team Goals */}
            <Card className="border-3 border-secondary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-secondary/20 to-secondary/5 border-b-2 border-secondary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">⚽</span>
                  {away.name} — Goals ({away.goals.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {away.goals.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6 italic">
                      No goals recorded yet
                    </p>
                  ) : (
                    away.goals.map((goal, idx) => (
                      <div
                        key={goal.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 transition-all border border-secondary/20 group"
                      >
                        <span className="text-lg font-bold text-secondary w-8 text-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <Select
                          value={goal.playerId}
                          onValueChange={(playerId) => {
                            const player = away.players.find((p) => p.id === playerId);
                            updateGoal("away", idx, {
                              playerId,
                              playerName: player?.name || "",
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background/80 border-secondary/30 hover:border-secondary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {outfieldPlayers(away.players).map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={goal.minute ?? ""}
                          onChange={(e) =>
                            updateGoal("away", idx, {
                              minute: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          placeholder="Min"
                          className="w-20 bg-background/80 border-secondary/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeGoal("away", idx)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  onClick={() => addGoal("away")}
                  disabled={outfieldPlayers(away.players).length === 0}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Goal
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* GK Saves Section */}
          <div className="grid gap-8 lg:grid-cols-2 mb-8">
            {/* Home Team Saves */}
            <Card className="border-3 border-primary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 border-b-2 border-primary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">🥅</span>
                  {home.name} — Goalkeeper Saves ({home.saves.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {home.saves.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6 italic">
                      No saves recorded yet
                    </p>
                  ) : (
                    home.saves.map((save, idx) => (
                      <div
                        key={save.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 transition-all border border-primary/20 group"
                      >
                        <span className="text-lg font-bold text-primary w-8 text-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <Select
                          value={save.playerId}
                          onValueChange={(playerId) => {
                            const player = home.players.find((p) => p.id === playerId);
                            updateSave("home", idx, {
                              playerId,
                              playerName: player?.name || "",
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background/80 border-primary/30 hover:border-primary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {gkFilteredPlayers(home.players).map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={save.minute ?? ""}
                          onChange={(e) =>
                            updateSave("home", idx, {
                              minute: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          placeholder="Min"
                          className="w-20 bg-background/80 border-primary/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSave("home", idx)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  onClick={() => addSave("home")}
                  disabled={gkFilteredPlayers(home.players).length === 0}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Save
                </Button>
              </CardContent>
            </Card>

            {/* Away Team Saves */}
            <Card className="border-3 border-secondary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-secondary/20 to-secondary/5 border-b-2 border-secondary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <span className="text-2xl">🥅</span>
                  {away.name} — Goalkeeper Saves ({away.saves.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-3">
                  {away.saves.length === 0 ? (
                    <p className="text-center text-sm text-muted-foreground py-6 italic">
                      No saves recorded yet
                    </p>
                  ) : (
                    away.saves.map((save, idx) => (
                      <div
                        key={save.id}
                        className="flex items-center gap-3 p-4 rounded-lg bg-gradient-to-r from-muted/40 to-muted/20 hover:from-muted/60 hover:to-muted/40 transition-all border border-secondary/20 group"
                      >
                        <span className="text-lg font-bold text-secondary w-8 text-center flex-shrink-0">
                          {idx + 1}
                        </span>
                        <Select
                          value={save.playerId}
                          onValueChange={(playerId) => {
                            const player = away.players.find((p) => p.id === playerId);
                            updateSave("away", idx, {
                              playerId,
                              playerName: player?.name || "",
                            });
                          }}
                        >
                          <SelectTrigger className="flex-1 bg-background/80 border-secondary/30 hover:border-secondary/50">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {gkFilteredPlayers(away.players).map((player) => (
                              <SelectItem key={player.id} value={player.id}>
                                {player.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          type="number"
                          min="0"
                          max="120"
                          value={save.minute ?? ""}
                          onChange={(e) =>
                            updateSave("away", idx, {
                              minute: e.target.value ? parseInt(e.target.value) : undefined,
                            })
                          }
                          placeholder="Min"
                          className="w-20 bg-background/80 border-secondary/30"
                        />
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSave("away", idx)}
                          className="text-destructive hover:bg-destructive/10 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>
                <Button
                  onClick={() => addSave("away")}
                  disabled={gkFilteredPlayers(away.players).length === 0}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Save
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Player Management Section */}
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Home Team Players */}
            <Card className="border-3 border-primary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 border-b-2 border-primary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team 1 squad ({home.players.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  {home.players.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/40 transition-all border border-primary/10 group"
                    >
                      {editingPlayerTeam === "home" && editingPlayerIndex === idx ? (
                        <>
                          <Input
                            value={editingPlayerName}
                            onChange={(e) => setEditingPlayerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditPlayer();
                              if (e.key === "Escape") {
                                setEditingPlayerTeam(null);
                                setEditingPlayerIndex(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-background/80"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={saveEditPlayer}
                            className="text-primary hover:bg-primary/10"
                          >
                            ✓
                          </Button>
                        </>
                      ) : (
                        <>
                          <span
                            onClick={() => startEditPlayer("home", idx)}
                            className="flex-1 cursor-text p-2 rounded hover:bg-primary/5 transition-colors"
                            title={player.isGK ? "Goalkeeper" : "Outfield"}
                          >
                            <span className="font-medium">{player.name}</span>
                            {player.isGK && (
                              <span className="text-xs text-muted-foreground ml-2">(GK)</span>
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleGK("home", idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-lg"
                            title={player.isGK ? "Remove GK" : "Set as GK"}
                          >
                            {player.isGK ? "🥅" : "👤"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePlayer("home", idx)}
                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => addPlayer("home")}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Player
                </Button>
              </CardContent>
            </Card>

            {/* Away Team Players */}
            <Card className="border-3 border-secondary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
              <CardHeader className="bg-gradient-to-r from-secondary/20 to-secondary/5 border-b-2 border-secondary/20">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Team 2 squad ({away.players.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="p-6">
                <div className="space-y-2">
                  {away.players.map((player, idx) => (
                    <div
                      key={player.id}
                      className="flex items-center gap-2 p-3 rounded-lg hover:bg-muted/40 transition-all border border-secondary/10 group"
                    >
                      {editingPlayerTeam === "away" && editingPlayerIndex === idx ? (
                        <>
                          <Input
                            value={editingPlayerName}
                            onChange={(e) => setEditingPlayerName(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEditPlayer();
                              if (e.key === "Escape") {
                                setEditingPlayerTeam(null);
                                setEditingPlayerIndex(null);
                              }
                            }}
                            autoFocus
                            className="flex-1 bg-background/80"
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={saveEditPlayer}
                            className="text-secondary hover:bg-secondary/10"
                          >
                            ✓
                          </Button>
                        </>
                      ) : (
                        <>
                          <span
                            onClick={() => startEditPlayer("away", idx)}
                            className="flex-1 cursor-text p-2 rounded hover:bg-secondary/5 transition-colors"
                            title={player.isGK ? "Goalkeeper" : "Outfield"}
                          >
                            <span className="font-medium">{player.name}</span>
                            {player.isGK && (
                              <span className="text-xs text-muted-foreground ml-2">(GK)</span>
                            )}
                          </span>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => toggleGK("away", idx)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-lg"
                            title={player.isGK ? "Remove GK" : "Set as GK"}
                          >
                            {player.isGK ? "🥅" : "👤"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => removePlayer("away", idx)}
                            className="text-destructive opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/10"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                <Button
                  onClick={() => addPlayer("away")}
                  className="w-full mt-4 gap-2"
                  variant="outline"
                >
                  <Plus className="h-4 w-4" />
                  Add Player
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </TabsContent>

      {/* TOURNAMENTS TAB */}
      <TabsContent value="tournaments" className="py-8 sm:py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center gap-3 mb-2">
              <Trophy className="h-8 w-8 text-pitch-foreground" />
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-pitch-foreground">
                Tournament History
              </h1>
            </div>
            <p className="text-pitch-foreground/70">
              {tournaments.length} tournament{tournaments.length !== 1 ? "s" : ""} recorded
            </p>
          </div>

          {tournaments.length === 0 ? (
            <Card className="border-3 border-pitch-foreground/20 bg-gradient-to-br from-card/98 via-card/96 to-card/94">
              <CardContent className="py-12 text-center">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground text-lg">
                  No tournaments saved yet. Play a match and save it!
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {tournaments.map((tournament) => (
                <Card
                  key={tournament.id}
                  className="border-2 border-primary/30 bg-gradient-to-br from-card/98 via-card/96 to-card/94 hover:shadow-lg transition-shadow"
                  role="button"
                  tabIndex={0}
                  onClick={() =>
                    setExpandedTournamentId((current) =>
                      current === tournament.id ? null : tournament.id,
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      setExpandedTournamentId((current) =>
                        current === tournament.id ? null : tournament.id,
                      );
                    }
                  }}
                >
                  <CardContent className="p-6">
                    <div className="mb-5 flex flex-wrap items-baseline justify-between gap-2 border-b pb-4">
                      <h2 className="font-display text-2xl font-bold">
                        {tournament.tournamentName}
                      </h2>
                    </div>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 font-semibold">Match</p>
                        <p className="font-bold text-lg">
                          {tournament.homeTeam} <span className="text-muted-foreground">vs</span>{" "}
                          {tournament.awayTeam}
                        </p>
                        <p className="text-3xl font-display font-bold mt-2 text-primary">
                          {tournament.homeScore} — {tournament.awayScore}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 font-semibold">
                          Tournament Info
                        </p>
                        <p className="font-semibold">{tournament.type}</p>
                        <p className="text-sm text-muted-foreground">
                          Participants: {tournament.participants}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Manager: {tournament.manager || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 font-semibold">Winner</p>
                        <p className="font-semibold text-primary text-lg flex items-center gap-2">
                          <Crown className="h-4 w-4" />
                          {tournament.winner}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground mb-1 font-semibold">
                          Top Stats
                        </p>
                        <div className="space-y-1 text-sm">
                          <p>
                            ⚽ Scorer:{" "}
                            <span className="font-semibold">{tournament.stats.topScorer.name}</span>{" "}
                            ({tournament.stats.topScorer.goals})
                          </p>
                          <p>
                            🥅 Saver:{" "}
                            <span className="font-semibold">{tournament.stats.topSaver.name}</span>{" "}
                            ({tournament.stats.topSaver.saves})
                          </p>
                        </div>
                      </div>
                    </div>
                    <div className="mt-5 border-t pt-4">
                      <div className="flex flex-wrap gap-2">
                        <Button
                          type="button"
                          variant="default"
                          size="sm"
                          className="gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            void editTournamentFinal(tournament);
                          }}
                        >
                          <Pencil className="size-4" />
                          Edit final
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="gap-2"
                          onClick={(event) => {
                            event.stopPropagation();
                            setExpandedTournamentId((current) =>
                              current === tournament.id ? null : tournament.id,
                            );
                          }}
                        >
                          {expandedTournamentId === tournament.id ? (
                            <ChevronUp className="size-4" />
                          ) : (
                            <ChevronDown className="size-4" />
                          )}
                          {expandedTournamentId === tournament.id
                            ? "Hide fixtures"
                            : "View fixtures"}
                        </Button>
                      </div>
                      {expandedTournamentId === tournament.id && (
                        <div className="mt-4 space-y-2">
                          {tournamentFixturesQuery.isLoading ? (
                            <p className="text-sm text-muted-foreground">Loading fixtures...</p>
                          ) : tournamentFixturesQuery.isError ? (
                            <p className="text-sm text-destructive">
                              Could not load this tournament&apos;s fixtures. Apply the tournament
                              fixture migration in Supabase, then refresh.
                            </p>
                          ) : (tournamentFixturesQuery.data ?? []).length === 0 ? (
                            <p className="text-sm text-muted-foreground">
                              No fixtures created for this tournament yet.
                            </p>
                          ) : (
                            <div className="divide-y rounded-md border">
                              {(tournamentFixturesQuery.data ?? []).map((fixture) => {
                                const homeTeam = teamsQuery.data?.find(
                                  (team) => team.id === fixture.home_team_id,
                                );
                                const awayTeam = teamsQuery.data?.find(
                                  (team) => team.id === fixture.away_team_id,
                                );
                                return (
                                  <div
                                    key={fixture.id}
                                    className="flex flex-wrap items-center gap-3 p-3 text-sm"
                                  >
                                    <span className="w-20 text-xs text-muted-foreground">
                                      Matchday {fixture.matchday}
                                    </span>
                                    <span className="min-w-50 flex-1 font-medium">
                                      {homeTeam?.name ?? "Home team"}{" "}
                                      <span className="text-muted-foreground">vs</span>{" "}
                                      {awayTeam?.name ?? "Away team"}
                                    </span>
                                    <span className="rounded bg-muted px-2 py-1 font-semibold tabular-nums">
                                      {fixture.home_score ?? "-"} - {fixture.away_score ?? "-"}
                                    </span>
                                    <span className="text-xs text-muted-foreground">
                                      {fixture.status}
                                    </span>
                                    <Button asChild variant="ghost" size="sm">
                                      <Link
                                        to="/match/$fixtureId"
                                        params={{ fixtureId: fixture.id }}
                                      >
                                        Edit
                                      </Link>
                                    </Button>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="mt-4 flex justify-end">
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" size="sm" className="gap-2">
                            <X className="h-4 w-4" />
                            Delete
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Tournament?</AlertDialogTitle>
                            <AlertDialogDescription>
                              Are you sure you want to delete this tournament record for{" "}
                              {tournament.homeTeam} vs {tournament.awayTeam}? This action cannot be
                              undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogAction
                            onClick={() => {
                              if (tournament.id) {
                                handleDeleteTournament(tournament.id);
                              }
                            }}
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                          >
                            Delete
                          </AlertDialogAction>
                          <AlertDialogCancel>Cancel</AlertDialogCancel>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </TabsContent>

      {/* STATISTICS TAB */}
      <TabsContent value="stats" className="py-8 sm:py-12 px-4">
        <div className="mx-auto max-w-6xl">
          <div className="mb-8 sm:mb-12">
            <div className="flex items-center gap-3 mb-2">
              <BarChart3 className="h-8 w-8 text-pitch-foreground" />
              <h1 className="font-display text-3xl sm:text-4xl font-bold tracking-tight text-pitch-foreground">
                Tournament Statistics
              </h1>
            </div>
            <p className="text-pitch-foreground/70">Overall tournament performance metrics</p>
          </div>

          {tournaments.length === 0 ? (
            <Card className="border-3 border-pitch-foreground/20 bg-gradient-to-br from-card/98 via-card/96 to-card/94">
              <CardContent className="py-12 text-center">
                <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground mb-4 opacity-50" />
                <p className="text-muted-foreground text-lg">No tournament data available yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-8 lg:grid-cols-3">
              {/* Most Goals */}
              <Card className="border-3 border-primary/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-primary/20 to-primary/5 border-b-2 border-primary/20">
                  <CardTitle className="text-lg">⚽ Most Goals</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {tournaments.map((tournament) => (
                      <div key={tournament.id} className="border-b pb-4 last:border-0">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          {tournament.homeTeam} vs {tournament.awayTeam}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{tournament.stats.topScorer.name}</span>
                          <span className="bg-primary/20 text-primary font-bold px-3 py-1 rounded-full text-sm">
                            {tournament.stats.topScorer.goals}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Most Saves */}
              <Card className="border-3 border-accent/40 bg-gradient-to-br from-card/98 via-card/96 to-card/94 shadow-lg">
                <CardHeader className="bg-gradient-to-r from-accent/20 to-accent/5 border-b-2 border-accent/20">
                  <CardTitle className="text-lg">🥅 Most Saves</CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                  <div className="space-y-4">
                    {tournaments.map((tournament) => (
                      <div key={tournament.id} className="border-b pb-4 last:border-0">
                        <p className="text-xs text-muted-foreground mb-2 font-medium">
                          {tournament.homeTeam} vs {tournament.awayTeam}
                        </p>
                        <div className="flex items-center justify-between">
                          <span className="font-semibold">{tournament.stats.topSaver.name}</span>
                          <span className="bg-accent/20 text-accent font-bold px-3 py-1 rounded-full text-sm">
                            {tournament.stats.topSaver.saves}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </TabsContent>
    </Tabs>
  );
}
