import { supabase } from "@/integrations/supabase/client";

export type Competition = {
  id: string;
  name: string;
  logo_url: string | null;
  season: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  location: string | null;
  num_teams: number | null;
  format: string;
  points_win: number;
  points_draw: number;
  points_loss: number;
  published: boolean;
  archived: boolean;
};

export type Team = {
  id: string;
  competition_id: string | null;
  name: string;
  short_name: string | null;
  logo_url: string | null;
  crest_color: string | null;
  manager: string | null;
  stadium: string | null;
  city: string | null;
  founded_year: number | null;
  contact: string | null;
};

export type Player = {
  id: string;
  team_id: string | null;
  name: string;
  photo_url: string | null;
  jersey_number: number | null;
  position: string;
  date_of_birth: string | null;
  nationality: string | null;
  status: string;
};

export type Fixture = {
  id: string;
  competition_id: string;
  tournament_id: string | null;
  matchday: number;
  home_team_id: string;
  away_team_id: string;
  kickoff: string;
  venue: string | null;
  referee: string | null;
  status: string;
  home_score: number | null;
  away_score: number | null;
  notes: string | null;
};

export type MatchEvent = {
  id: string;
  fixture_id: string;
  team_id: string | null;
  player_id: string | null;
  assist_player_id: string | null;
  minute: number;
  event_type: string;
  goal_type: string | null;
  notes: string | null;
};

export type StandingRow = {
  competition_id: string | null;
  team_id: string;
  team_name: string;
  short_name: string | null;
  crest_color: string | null;
  logo_url: string | null;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
  home_won: number;
  away_won: number;
  clean_sheets: number;
};

export type ScorerRow = {
  player_id: string;
  player_name: string;
  position: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_id: string;
  team_name: string;
  short_name: string | null;
  crest_color: string | null;
  competition_id: string | null;
  tournament_id: string | null;
  goals: number;
  assists: number;
  matches: number;
};

export type PlayerStatRow = ScorerRow & {
  nationality: string | null;
  yellow_cards: number;
  red_cards: number;
};

export type SavesRow = {
  player_id: string;
  player_name: string;
  position: string;
  photo_url: string | null;
  jersey_number: number | null;
  team_id: string;
  team_name: string;
  short_name: string | null;
  crest_color: string | null;
  competition_id: string | null;
  tournament_id: string | null;
  saves: number;
  clean_sheets: number;
  matches: number;
};

export type Tournament = {
  id: string;
  tournament_name: string | null;
  status: "draft" | "completed";
  type: string;
  date: string;
  home_team: string;
  away_team: string;
  home_score: number;
  away_score: number;
  winner: string;
  manager: string | null;
  participants: number | null;
  top_scorer_name: string | null;
  top_scorer_goals: number | null;
  top_assister_name: string | null;
  top_assister_assists: number | null;
  top_saver_name: string | null;
  top_saver_saves: number | null;
  created_at: string;
};

export const MATCH_STATUSES = [
  "Scheduled",
  "Live",
  "Half Time",
  "Full Time",
  "Postponed",
  "Cancelled",
  "Abandoned",
] as const;

export const POSITIONS = ["Goalkeeper", "Defender", "Midfielder", "Forward"] as const;

export const COMPETITION_FORMATS = [
  "League",
  "Knockout",
  "Group Stage",
  "Group Stage + Knockout",
  "Round Robin",
  "Custom",
] as const;

export const EVENT_TYPES = [
  { value: "goal", label: "Goal", icon: "⚽" },
  { value: "own_goal", label: "Own Goal", icon: "🥅" },
  { value: "save", label: "Save", icon: "🧤" },
  { value: "missed_penalty", label: "Missed Penalty", icon: "❌" },
  { value: "yellow_card", label: "Yellow Card", icon: "🟨" },
  { value: "red_card", label: "Red Card", icon: "🟥" },
  { value: "substitution", label: "Substitution", icon: "🔄" },
  { value: "injury", label: "Injury", icon: "🚑" },
  { value: "var", label: "VAR Decision", icon: "📺" },
] as const;

export const GOAL_TYPES = ["Open Play", "Penalty", "Free Kick", "Header", "Own Goal"] as const;

const db = supabase as unknown as {
  from: (t: string) => any;
};

export async function fetchCompetitions(): Promise<Competition[]> {
  const { data, error } = await db.from("competitions").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Competition[];
}

export async function fetchTeams(competitionId?: string): Promise<Team[]> {
  let q = db.from("teams").select("*").order("name");
  if (competitionId) q = q.eq("competition_id", competitionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function fetchPlayers(teamId?: string): Promise<Player[]> {
  let q = db.from("players").select("*").order("jersey_number");
  if (teamId) q = q.eq("team_id", teamId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Player[];
}

export async function fetchFixtures(competitionId?: string, tournamentId?: string): Promise<Fixture[]> {
  let q = db.from("fixtures").select("*").order("kickoff");
  if (tournamentId) q = q.eq("tournament_id", tournamentId);
  else if (competitionId) q = q.eq("competition_id", competitionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as Fixture[];
}

export async function fetchFixture(id: string): Promise<Fixture | null> {
  const { data, error } = await db.from("fixtures").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data as Fixture | null;
}

export async function fetchEvents(fixtureId: string): Promise<MatchEvent[]> {
  const { data, error } = await db.from("match_events").select("*").eq("fixture_id", fixtureId).order("minute");
  if (error) throw error;
  return (data ?? []) as MatchEvent[];
}

export async function fetchStandings(competitionId?: string): Promise<StandingRow[]> {
  let q = db.from("standings").select("*");
  if (competitionId) q = q.eq("competition_id", competitionId);
  const { data, error } = await q;
  if (error) throw error;
  return sortStandings((data ?? []) as StandingRow[]);
}

export async function fetchTournamentStandings(tournamentId: string, competitionId?: string): Promise<StandingRow[]> {
  const [teams, fixtures, competitions] = await Promise.all([
    fetchTeams(competitionId),
    fetchFixtures(undefined, tournamentId),
    competitionId ? Promise.resolve([] as Competition[]) : fetchCompetitions(),
  ]);
  const competition = competitions.find((item) => item.id === competitionId) ?? competitions[0];
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
    if (fixture.status !== "Full Time" || fixture.home_score == null || fixture.away_score == null) continue;
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
      home.points += competition?.points_win ?? 3;
      home.home_won += 1;
      away.lost += 1;
    } else if (fixture.home_score < fixture.away_score) {
      away.won += 1;
      away.points += competition?.points_win ?? 3;
      away.away_won += 1;
      home.lost += 1;
    } else {
      home.drawn += 1;
      away.drawn += 1;
      home.points += competition?.points_draw ?? 1;
      away.points += competition?.points_draw ?? 1;
    }
    if (fixture.away_score === 0) home.clean_sheets += 1;
    if (fixture.home_score === 0) away.clean_sheets += 1;
  }

  for (const row of rows.values()) row.goal_difference = row.goals_for - row.goals_against;
  return sortStandings([...rows.values()]);
}

export function sortStandings(rows: StandingRow[]): StandingRow[] {
  return [...rows].sort(
    (a, b) =>
      b.points - a.points ||
      b.goal_difference - a.goal_difference ||
      b.goals_for - a.goals_for ||
      a.team_name.localeCompare(b.team_name),
  );
}

export async function fetchTopScorers(tournamentId?: string): Promise<ScorerRow[]> {
  let q = db.from("top_scorers").select("*");
  if (tournamentId) q = q.eq("tournament_id", tournamentId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as ScorerRow[])
    .filter((r) => r.goals > 0)
    .sort((a, b) => b.goals - a.goals || b.assists - a.assists || a.matches - b.matches);
}

export async function fetchTopSaves(tournamentId?: string): Promise<SavesRow[]> {
  let q = db.from("top_saves").select("*");
  if (tournamentId) q = q.eq("tournament_id", tournamentId);
  const { data, error } = await q;
  if (error) throw error;
  return ((data ?? []) as SavesRow[])
    .filter((r) => r.saves > 0)
    .sort((a, b) => b.saves - a.saves || b.clean_sheets - a.clean_sheets || a.matches - b.matches);
}

export async function fetchPlayerStats(competitionId?: string): Promise<PlayerStatRow[]> {
  let q = db.from("player_stats").select("*");
  if (competitionId) q = q.eq("competition_id", competitionId);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []) as PlayerStatRow[];
}

export function teamInitials(team: { short_name?: string | null; name: string }) {
  if (team.short_name) return team.short_name.slice(0, 3).toUpperCase();
  return team.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function formIndicator(teamId: string, fixtures: Fixture[]): ("W" | "D" | "L")[] {
  return fixtures
    .filter(
      (f) =>
        f.status === "Full Time" &&
        f.home_score != null &&
        (f.home_team_id === teamId || f.away_team_id === teamId),
    )
    .sort((a, b) => +new Date(b.kickoff) - +new Date(a.kickoff))
    .slice(0, 5)
    .reverse()
    .map((f) => {
      const home = f.home_team_id === teamId;
      const gf = (home ? f.home_score : f.away_score) ?? 0;
      const ga = (home ? f.away_score : f.home_score) ?? 0;
      return gf > ga ? "W" : gf === ga ? "D" : "L";
    });
}

/** Round-robin fixture generation (circle method). */
export function generateRoundRobin(teamIds: string[], doubleRound: boolean) {
  const ids = [...teamIds];
  if (ids.length % 2 === 1) ids.push("__bye__");
  const n = ids.length;
  const rounds: { home: string; away: string }[][] = [];
  let arr = [...ids];
  for (let r = 0; r < n - 1; r++) {
    const pairs: { home: string; away: string }[] = [];
    for (let i = 0; i < n / 2; i++) {
      const home = arr[i]!;
      const away = arr[n - 1 - i]!;
      if (home === "__bye__" || away === "__bye__") continue;
      pairs.push(r % 2 === 0 ? { home, away } : { home: away, away: home });
    }
    rounds.push(pairs);
    arr = [arr[0]!, arr[n - 1]!, ...arr.slice(1, n - 1)];
  }
  if (doubleRound) {
    const reverse = rounds.map((round) => round.map((m) => ({ home: m.away, away: m.home })));
    return [...rounds, ...reverse];
  }
  return rounds;
}

/* ---------------- mutations ---------------- */

export async function upsertCompetition(row: Partial<Competition>) {
  const { data, error } = await db.from("competitions").upsert(row).select().single();
  if (error) throw error;
  return data as Competition;
}

export async function upsertTeam(row: Partial<Team>) {
  const { data, error } = await db.from("teams").upsert(row).select().single();
  if (error) throw error;
  return data as Team;
}

export async function updateTeam(id: string, changes: Partial<Team>) {
  const { data, error } = await db.from("teams").update(changes).eq("id", id).select().single();
  if (error) throw error;
  return data as Team;
}

export async function insertTeams(rows: { competition_id: string | null; name: string; crest_color: string }[]) {
  const { data, error } = await db.from("teams").insert(rows).select();
  if (error) throw error;
  return (data ?? []) as Team[];
}

export async function deleteTeam(id: string) {
  const { error } = await db.from("teams").delete().eq("id", id);
  if (error) throw error;
}

export async function upsertPlayer(row: Partial<Player>) {
  const { data, error } = await db.from("players").upsert(row).select().single();
  if (error) throw error;
  return data as Player;
}

export async function savePlayer(row: Partial<Player>) {
  if (row.name?.trim() && row.team_id) {
    const { data, error } = await db
      .from("players")
      .select("*")
      .eq("team_id", row.team_id)
      .eq("name", row.name.trim())
      .maybeSingle();
    if (error) throw error;

    return upsertPlayer({
      ...row,
      ...(data ? { id: data.id } : {}),
      name: row.name.trim(),
      status: "Active",
    });
  }

  return upsertPlayer(row);
}

export async function deletePlayer(id: string) {
  const { error } = await db.from("players").update({ status: "Inactive" }).eq("id", id);
  if (error) throw error;
}

export async function deletePlayerGoals(playerId: string, tournamentId?: string) {
  let q = db.from("match_events").delete().eq("player_id", playerId).eq("event_type", "goal");
  if (tournamentId) {
    const fixtureIds = await fetchFixtureIds(tournamentId);
    if (fixtureIds.length === 0) return;
    q = q.in("fixture_id", fixtureIds);
  }
  const { error } = await q;
  if (error) throw error;
}

export async function deletePlayerSaves(playerId: string, tournamentId?: string) {
  let q = db.from("match_events").delete().eq("player_id", playerId).eq("event_type", "save");
  if (tournamentId) {
    const fixtureIds = await fetchFixtureIds(tournamentId);
    if (fixtureIds.length === 0) return;
    q = q.in("fixture_id", fixtureIds);
  }
  const { error } = await q;
  if (error) throw error;
}

async function fetchFixtureIds(tournamentId: string): Promise<string[]> {
  const { data, error } = await db.from("fixtures").select("id").eq("tournament_id", tournamentId);
  if (error) throw error;
  return (data ?? []).map((fixture: { id: string }) => fixture.id);
}

export async function insertFixtures(rows: Partial<Fixture>[]) {
  const { error } = await db.from("fixtures").insert(rows);
  if (error) {
    const message = String(error.message ?? "");
    if (/tournament_id.*column|permission denied|row-level security|policy/i.test(message)) {
      throw new Error("Fixtures are not enabled in Supabase yet. Apply the latest fixture migration, then try again.");
    }
    throw error;
  }
}

export async function updateFixture(id: string, patch: Partial<Fixture>) {
  const nextPatch =
    patch.home_score !== undefined || patch.away_score !== undefined
      ? {
          ...patch,
          status: patch.home_score != null && patch.away_score != null ? "Full Time" : "Scheduled",
        }
      : patch;
  const { error } = await db.from("fixtures").update(nextPatch).eq("id", id);
  if (error) throw error;
}

export async function deleteFixture(id: string) {
  const { error } = await db.from("fixtures").delete().eq("id", id);
  if (error) throw error;
}

export async function addEvent(row: Partial<MatchEvent>) {
  const { error } = await db.from("match_events").insert(row);
  if (error) throw error;
}

export async function deleteEvent(id: string) {
  const { error } = await db.from("match_events").delete().eq("id", id);
  if (error) throw error;
}

/* Tournament management */

export async function fetchTournaments(): Promise<Tournament[]> {
  const { data, error } = await db
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;

  return (data ?? []).map((row: Partial<Tournament> & Record<string, unknown>) => ({
    ...(row as Tournament),
    tournament_name: row["tournament_name"] ?? row["type"] ?? "Tournament",
    status: (row["status"] as Tournament["status"]) ?? "completed",
  }));
}

export async function fetchLatestTournament(): Promise<Tournament | null> {
  const { data, error } = await db
    .from("tournaments")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw error;
  const row = (data ?? [])[0] as (Partial<Tournament> & Record<string, unknown>) | undefined;
  if (!row) return null;
  return {
    ...(row as Tournament),
    tournament_name: row["tournament_name"] ?? row["type"] ?? "Tournament",
    status: (row["status"] as Tournament["status"]) ?? "completed",
  };
}

export async function saveTournament(
  tournament: Omit<Tournament, "id" | "created_at" | "status"> & { id?: string; status?: Tournament["status"] },
) {
  const payload: Record<string, unknown> = {
    ...(tournament.id ? { id: tournament.id } : {}),
    type: tournament.type,
    date: tournament.date,
    home_team: tournament.home_team,
    away_team: tournament.away_team,
    home_score: tournament.home_score,
    away_score: tournament.away_score,
    winner: tournament.winner,
    manager: tournament.manager,
    participants: tournament.participants,
    top_scorer_name: tournament.top_scorer_name,
    top_scorer_goals: tournament.top_scorer_goals,
    top_assister_name: tournament.top_assister_name,
    top_assister_assists: tournament.top_assister_assists,
    top_saver_name: tournament.top_saver_name,
    top_saver_saves: tournament.top_saver_saves,
  };

  if (tournament.tournament_name) {
    payload["tournament_name"] = tournament.tournament_name;
  }

  const withoutStatus = { ...payload };
  delete withoutStatus["status"];
  const withoutTournamentName = { ...payload };
  delete withoutTournamentName["tournament_name"];
  const withoutOptionalColumns = { ...withoutTournamentName };
  delete withoutOptionalColumns["status"];

  const insertPayloads = [
    ...(tournament.status ? [{ ...payload, status: tournament.status }] : [payload]),
    withoutStatus,
    withoutTournamentName,
    withoutOptionalColumns,
  ];

  let lastError: Error | null = null;

  for (const insertPayload of insertPayloads) {
    const { data, error } = await db
      .from("tournaments")
      .insert([insertPayload])
      .select()
      .single();

    if (!error) {
      return {
        ...(data as Tournament),
        tournament_name: (data as Partial<Tournament> & Record<string, unknown>)?.["tournament_name"] ?? tournament.tournament_name ?? tournament.type,
        status: ((data as Partial<Tournament> & Record<string, unknown>)?.["status"] as Tournament["status"]) ?? "completed",
      } as Tournament;
    }

    const message = String(error.message ?? "");
    const isMissingStatusColumn = /status.*column|schema cache|does not exist|missing.*status/i.test(message);
    if (!isMissingStatusColumn) {
      throw error;
    }

    lastError = error;
  }

  if (lastError) throw lastError;
  throw new Error("Unable to create tournament");
}

export async function updateTournament(id: string, changes: Partial<Omit<Tournament, "id" | "created_at">>) {
  const { data, error } = await db.from("tournaments").update(changes).eq("id", id).select().single();
  if (error) throw error;
  return data as Tournament;
}

export async function deleteTournament(id: string) {
  const { error: fixturesError } = await db.from("fixtures").delete().eq("tournament_id", id);
  if (fixturesError) throw fixturesError;

  const { error } = await db.from("tournaments").delete().eq("id", id);
  if (error) throw error;
}
