import { supabase } from "@/integrations/supabase/client";
import {
  fetchAllFixtureAppearances,
  fetchAllFixturePlayerRatings,
  fetchAllMatchEvents,
  fetchBestXIs,
  fetchFixtures,
  fetchPlayers,
  fetchTournaments,
  type BestXI,
  type Fixture,
  type FixtureAppearance,
  type FixturePlayerRating,
  type MatchEvent,
  type Player,
  type Tournament,
} from "@/lib/football";
import type { Json } from "@/integrations/supabase/types";

export const HOUSE_ICON_POSITIONS = [
  { key: "forward", label: "ICONIC FORWARD", bestXiSlots: ["forward_1", "forward_2", "forward_3"] },
  {
    key: "midfielder",
    label: "ICONIC MIDFIELDER",
    bestXiSlots: ["midfielder_1", "midfielder_2", "midfielder_3"],
  },
  {
    key: "defender",
    label: "ICONIC DEFENDER",
    bestXiSlots: ["defender_1", "defender_2", "defender_3", "defender_4"],
  },
  { key: "goalkeeper", label: "ICONIC GOALKEEPER", bestXiSlots: ["goalkeeper"] },
] as const satisfies ReadonlyArray<{
  key: HouseIconPosition;
  label: string;
  bestXiSlots: readonly (keyof BestXI)[];
}>;

export type HouseIconPosition = "forward" | "midfielder" | "defender" | "goalkeeper";

export type HouseIconTournamentAppearance = {
  tournamentId: string;
  tournamentNumber: number;
  tournamentName: string;
  selected: boolean;
};

export type HouseIconSupportingStats = {
  awards: number | null;
  goals: number | null;
  assists: number | null;
  saves: number | null;
  ratingPoints: number | null;
  averageRating: number | null;
  matchesPlayed: number | null;
  tournamentsPlayed: number | null;
};

export type HouseIconPlayer = {
  playerId: string;
  playerName: string;
  teamName: string | null;
  position: string;
  bestXiAppearances: number;
  tournamentHistory: HouseIconTournamentAppearance[];
  supportingStats: HouseIconSupportingStats;
  rationale: string;
  groupId: string;
};

export type HouseIconSelections = Record<HouseIconPosition, HouseIconPlayer | null>;

export type HouseOfIconsGroup = {
  group_id: string;
  group_start: number;
  group_end: number;
  tournament_ids: string[];
  status: "complete" | "insufficient_data";
  selections: HouseIconSelections;
  review_reasons: string[];
  source_fingerprint: string;
  selection_history: Json[];
  updated_at: string;
};

type PlayerMetrics = {
  goals: number;
  hasGoalData: boolean;
  assists: number;
  hasAssistData: boolean;
  saves: number;
  hasSaveData: boolean;
  ratingPoints: number;
  ratingCount: number;
  fixtures: Set<string>;
  tournaments: Set<string>;
  awards: Record<HouseIconPosition, number>;
};

type CandidateHistory = {
  tournamentId: string;
  tournamentNumber: number;
  tournamentName: string;
  selected: boolean;
};

type Candidate = {
  player: Player;
  history: CandidateHistory[];
  metrics: PlayerMetrics;
  bestXiAppearances: number;
};

const EMPTY_SELECTIONS = (): HouseIconSelections => ({
  forward: null,
  midfielder: null,
  defender: null,
  goalkeeper: null,
});

function isObject(value: Json): value is { [key: string]: Json | undefined } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function serializeJson(value: unknown): Json {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(serializeJson);
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, serializeJson(item)]),
    );
  }
  throw new Error("House of the Icons data contains a value that cannot be stored.");
}

function parseSelections(value: Json): HouseIconSelections {
  if (!isObject(value)) throw new Error("Saved House of the Icons selections are invalid.");
  const parsed = EMPTY_SELECTIONS();
  for (const { key } of HOUSE_ICON_POSITIONS) {
    const selection = value[key];
    if (selection === null) {
      parsed[key] = null;
      continue;
    }
    if (!selection || !isObject(selection)) {
      throw new Error("Saved House of the Icons selections are invalid.");
    }
    const historyValue = selection["tournamentHistory"];
    const statsValue = selection["supportingStats"];
    if (!Array.isArray(historyValue) || !statsValue || !isObject(statsValue)) {
      throw new Error("Saved House of the Icons player data is invalid.");
    }
    const history = historyValue.map((entry) => {
      if (!isObject(entry)) throw new Error("Saved icon tournament history is invalid.");
      const tournamentId = entry["tournamentId"];
      const tournamentNumber = entry["tournamentNumber"];
      const tournamentName = entry["tournamentName"];
      const selected = entry["selected"];
      if (
        typeof tournamentId !== "string" ||
        typeof tournamentNumber !== "number" ||
        typeof tournamentName !== "string" ||
        typeof selected !== "boolean"
      ) {
        throw new Error("Saved icon tournament history is invalid.");
      }
      return { tournamentId, tournamentNumber, tournamentName, selected };
    });
    const numberOrNull = (field: string) => {
      const item = statsValue[field];
      return typeof item === "number" ? item : item === null ? null : undefined;
    };
    const stats: HouseIconSupportingStats = {
      awards: numberOrNull("awards") ?? null,
      goals: numberOrNull("goals") ?? null,
      assists: numberOrNull("assists") ?? null,
      saves: numberOrNull("saves") ?? null,
      ratingPoints: numberOrNull("ratingPoints") ?? null,
      averageRating: numberOrNull("averageRating") ?? null,
      matchesPlayed: numberOrNull("matchesPlayed") ?? null,
      tournamentsPlayed: numberOrNull("tournamentsPlayed") ?? null,
    };
    const playerId = selection["playerId"];
    const playerName = selection["playerName"];
    const teamName = selection["teamName"];
    const position = selection["position"];
    const bestXiAppearances = selection["bestXiAppearances"];
    const rationale = selection["rationale"];
    const groupId = selection["groupId"];
    if (
      typeof playerId !== "string" ||
      typeof playerName !== "string" ||
      !(typeof teamName === "string" || teamName === null) ||
      typeof position !== "string" ||
      typeof bestXiAppearances !== "number" ||
      typeof rationale !== "string" ||
      typeof groupId !== "string"
    ) {
      throw new Error("Saved House of the Icons player data is invalid.");
    }
    parsed[key] = {
      playerId,
      playerName,
      teamName,
      position,
      bestXiAppearances,
      tournamentHistory: history,
      supportingStats: stats,
      rationale,
      groupId,
    };
  }
  return parsed;
}

function parseGroup(row: {
  group_id: string;
  group_start: number;
  group_end: number;
  tournament_ids: string[];
  status: string;
  selections: Json;
  review_reasons: Json;
  source_fingerprint: string;
  selection_history: Json;
  updated_at: string;
}): HouseOfIconsGroup {
  if (row.status !== "complete" && row.status !== "insufficient_data") {
    throw new Error("Saved House of the Icons group has an unsupported status.");
  }
  if (
    !Array.isArray(row.review_reasons) ||
    !row.review_reasons.every((reason) => typeof reason === "string")
  ) {
    throw new Error("Saved House of the Icons review notes are invalid.");
  }
  if (!Array.isArray(row.selection_history)) {
    throw new Error("Saved House of the Icons history is invalid.");
  }
  return {
    ...row,
    status: row.status,
    selections: parseSelections(row.selections),
    review_reasons: row.review_reasons,
    selection_history: row.selection_history,
  };
}

async function fetchStoredGroups(): Promise<HouseOfIconsGroup[]> {
  const { data, error } = await supabase
    .from("house_of_icons")
    .select("*")
    .order("group_start", { ascending: true });
  if (error) {
    if (error.code === "42P01" || error.code === "PGRST205") {
      throw new Error(
        "HOUSE OF THE ICONS storage is not set up. Apply the latest Supabase migration.",
      );
    }
    throw error;
  }
  return (data ?? []).map(parseGroup);
}

function hashSource(source: unknown): string {
  const input = JSON.stringify(source);
  let first = 0x811c9dc5;
  let second = 0x9e3779b9;
  for (let index = 0; index < input.length; index += 1) {
    const code = input.charCodeAt(index);
    first = Math.imul(first ^ code, 0x01000193);
    second = Math.imul(second ^ code, 0x85ebca6b);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizedName(name: string): string {
  return name.trim().toLowerCase();
}

function metricsFor(playerId: string, metrics: Map<string, PlayerMetrics>): PlayerMetrics {
  const existing = metrics.get(playerId);
  if (existing) return existing;
  const created: PlayerMetrics = {
    goals: 0,
    hasGoalData: false,
    assists: 0,
    hasAssistData: false,
    saves: 0,
    hasSaveData: false,
    ratingPoints: 0,
    ratingCount: 0,
    fixtures: new Set(),
    tournaments: new Set(),
    awards: { forward: 0, midfielder: 0, defender: 0, goalkeeper: 0 },
  };
  metrics.set(playerId, created);
  return created;
}

function performanceMetrics(
  position: HouseIconPosition,
  candidate: Candidate,
  metricsAvailable: { awards: boolean; ratings: boolean; appearances: boolean },
): Array<number | null> {
  const performanceValues: Array<number | null> = [];
  if (metricsAvailable.awards) {
    performanceValues.push(candidate.metrics.awards[position]);
  }
  if (position === "forward") {
    performanceValues.push(candidate.metrics.hasGoalData ? candidate.metrics.goals : null);
  }
  if (position === "midfielder") {
    performanceValues.push(
      candidate.metrics.hasAssistData ? candidate.metrics.assists : null,
      candidate.metrics.hasGoalData ? candidate.metrics.goals : null,
    );
  }
  if (position === "goalkeeper") {
    performanceValues.push(candidate.metrics.hasSaveData ? candidate.metrics.saves : null);
  }
  if (metricsAvailable.ratings && (position === "defender" || position === "goalkeeper")) {
    performanceValues.push(
      candidate.metrics.ratingCount > 0
        ? candidate.metrics.ratingPoints / candidate.metrics.ratingCount
        : null,
      candidate.metrics.ratingCount > 0 ? candidate.metrics.ratingPoints : null,
    );
  }
  if (metricsAvailable.appearances) {
    performanceValues.push(
      candidate.metrics.fixtures.size > 0 ? candidate.metrics.tournaments.size : null,
      candidate.metrics.fixtures.size > 0 ? candidate.metrics.fixtures.size : null,
    );
  }
  return performanceValues;
}

function supportingStats(
  position: HouseIconPosition,
  candidate: Candidate,
  metricsAvailable: { awards: boolean; ratings: boolean; appearances: boolean },
): HouseIconSupportingStats {
  return {
    awards: metricsAvailable.awards ? candidate.metrics.awards[position] : null,
    goals: candidate.metrics.hasGoalData ? candidate.metrics.goals : null,
    assists: candidate.metrics.hasAssistData ? candidate.metrics.assists : null,
    saves: candidate.metrics.hasSaveData ? candidate.metrics.saves : null,
    ratingPoints:
      metricsAvailable.ratings && candidate.metrics.ratingCount > 0
        ? candidate.metrics.ratingPoints
        : null,
    averageRating:
      metricsAvailable.ratings && candidate.metrics.ratingCount > 0
        ? candidate.metrics.ratingPoints / candidate.metrics.ratingCount
        : null,
    matchesPlayed:
      metricsAvailable.appearances && candidate.metrics.fixtures.size > 0
        ? candidate.metrics.fixtures.size
        : null,
    tournamentsPlayed:
      metricsAvailable.appearances && candidate.metrics.fixtures.size > 0
        ? candidate.metrics.tournaments.size
        : null,
  };
}

function describeStats(stats: HouseIconSupportingStats, position: HouseIconPosition): string[] {
  const details: string[] = [];
  if (stats.awards !== null && stats.awards > 0) {
    details.push(`${stats.awards} relevant tournament award${stats.awards === 1 ? "" : "s"}`);
  }
  if (position === "forward" && stats.goals !== null) details.push(`${stats.goals} goals`);
  if (position === "midfielder") {
    if (stats.assists !== null) details.push(`${stats.assists} assists`);
    if (stats.goals !== null) details.push(`${stats.goals} goals`);
  }
  if (position === "goalkeeper" && stats.saves !== null) details.push(`${stats.saves} saves`);
  if ((position === "defender" || position === "goalkeeper") && stats.averageRating !== null) {
    details.push(`${stats.averageRating.toFixed(1)} average match rating`);
  }
  if (stats.tournamentsPlayed !== null) {
    details.push(
      `played in ${stats.tournamentsPlayed} tournament${stats.tournamentsPlayed === 1 ? "" : "s"}`,
    );
  }
  return details;
}

function generateGroup(
  groupStart: number,
  tournaments: Tournament[],
  bestXIs: BestXI[],
  fixtures: Fixture[],
  events: MatchEvent[],
  appearances: FixtureAppearance[],
  ratings: FixturePlayerRating[],
  players: Player[],
  teamNames: Map<string, string>,
  oldGroup: HouseOfIconsGroup | undefined,
): HouseOfIconsGroup {
  const groupEnd = groupStart + 2;
  const groupId = `tournaments-${groupStart}-${groupEnd}`;
  const tournamentIds = tournaments.map((tournament) => tournament.id);
  const tournamentName = (tournament: Tournament) =>
    tournament.tournament_name?.trim() || tournament.type;
  const tournamentById = new Map(tournaments.map((tournament) => [tournament.id, tournament]));
  const groupBestXIs = bestXIs.filter((selection) => tournamentById.has(selection.tournament_id));
  const bestXIByTournament = new Map(
    groupBestXIs.map((selection) => [selection.tournament_id, selection]),
  );
  const groupFixtures = fixtures.filter(
    (fixture) => fixture.tournament_id && tournamentById.has(fixture.tournament_id),
  );
  const fixtureById = new Map(groupFixtures.map((fixture) => [fixture.id, fixture]));
  const completedFixtureIds = new Set(
    groupFixtures
      .filter(
        (fixture) =>
          fixture.status === "Full Time" &&
          fixture.home_score !== null &&
          fixture.away_score !== null,
      )
      .map((fixture) => fixture.id),
  );
  const groupEvents = events.filter((event) => completedFixtureIds.has(event.fixture_id));
  const groupAppearances = appearances.filter((appearance) =>
    completedFixtureIds.has(appearance.fixture_id),
  );
  const groupRatings = ratings.filter((rating) => completedFixtureIds.has(rating.fixture_id));
  const playerById = new Map(players.map((player) => [player.id, player]));
  const metrics = new Map<string, PlayerMetrics>();

  for (const event of groupEvents) {
    if (event.player_id && event.event_type === "goal") {
      const goalMetrics = metricsFor(event.player_id, metrics);
      goalMetrics.hasGoalData = true;
      if (event.goal_type?.toLowerCase().replace(/[\s_-]/g, "") !== "owngoal") {
        goalMetrics.goals += 1;
      }
    }
    if (event.assist_player_id) {
      const assistMetrics = metricsFor(event.assist_player_id, metrics);
      assistMetrics.hasAssistData = true;
      assistMetrics.assists += 1;
    }
    if (event.player_id && event.event_type === "save") {
      const saveMetrics = metricsFor(event.player_id, metrics);
      saveMetrics.hasSaveData = true;
      saveMetrics.saves += 1;
    }
  }
  for (const appearance of groupAppearances) {
    const fixture = fixtureById.get(appearance.fixture_id);
    if (!fixture?.tournament_id) continue;
    const playerMetrics = metricsFor(appearance.player_id, metrics);
    playerMetrics.fixtures.add(appearance.fixture_id);
    playerMetrics.tournaments.add(fixture.tournament_id);
  }
  for (const rating of groupRatings) {
    const fixture = fixtureById.get(rating.fixture_id);
    if (!fixture?.tournament_id) continue;
    const playerMetrics = metricsFor(rating.player_id, metrics);
    playerMetrics.ratingPoints += rating.rating;
    playerMetrics.ratingCount += 1;
  }

  const playersByName = new Map<string, Player[]>();
  for (const player of players) {
    const key = normalizedName(player.name);
    playersByName.set(key, [...(playersByName.get(key) ?? []), player]);
  }
  const awardColumns = {
    forward: ["top_scorer_name", "top_scorer_goals"],
    midfielder: ["top_assister_name", "top_assister_assists"],
    defender: [null, null],
    goalkeeper: ["top_saver_name", "top_saver_saves"],
  } as const;
  let awardsAvailable = false;
  for (const tournament of tournaments) {
    for (const { key } of HOUSE_ICON_POSITIONS) {
      const [nameField, countField] = awardColumns[key];
      if (!nameField || !countField) continue;
      const awardName = tournament[nameField];
      const awardCount = tournament[countField];
      if (!awardName || !awardCount || awardCount < 1) continue;
      awardsAvailable = true;
      const matchingPlayers = playersByName.get(normalizedName(awardName)) ?? [];
      const matchingPlayer = matchingPlayers.length === 1 ? matchingPlayers[0] : undefined;
      if (matchingPlayer) metricsFor(matchingPlayer.id, metrics).awards[key] += 1;
    }
  }

  const metricsAvailable = {
    awards: awardsAvailable,
    ratings: groupRatings.length > 0,
    appearances: groupAppearances.length > 0,
  };
  const reviewReasons: string[] = [];
  const missingBestXi = tournaments.filter((tournament) => !bestXIByTournament.has(tournament.id));
  if (tournaments.some((tournament) => tournament.status !== "completed")) {
    reviewReasons.push("This group includes a tournament that is not completed yet.");
  }
  if (missingBestXi.length > 0) {
    reviewReasons.push(`Best XI is missing for: ${missingBestXi.map(tournamentName).join(", ")}.`);
  }
  for (const tournament of tournaments) {
    const bestXI = bestXIByTournament.get(tournament.id);
    if (!bestXI) continue;
    const missingSlots = HOUSE_ICON_POSITIONS.flatMap(({ bestXiSlots }) =>
      bestXiSlots.filter((slot) => !bestXI[slot]),
    );
    if (missingSlots.length > 0) {
      reviewReasons.push(`Best XI is incomplete for ${tournamentName(tournament)}.`);
    }
  }

  const selections = EMPTY_SELECTIONS();
  if (reviewReasons.length === 0) {
    for (const { key, bestXiSlots } of HOUSE_ICON_POSITIONS) {
      const candidates = new Map<string, Candidate>();
      let missingPlayerRecord = false;
      for (const tournament of tournaments) {
        const bestXI = bestXIByTournament.get(tournament.id);
        if (!bestXI) continue;
        const selectedIds = new Set(bestXiSlots.map((slot) => bestXI[slot]).filter(Boolean));
        for (const playerId of selectedIds) {
          const player = playerById.get(playerId);
          if (!player) {
            missingPlayerRecord = true;
            continue;
          }
          let candidate = candidates.get(playerId);
          if (!candidate) {
            candidate = {
              player,
              history: tournaments.map((entry, index) => ({
                tournamentId: entry.id,
                tournamentNumber: groupStart + index,
                tournamentName: tournamentName(entry),
                selected: false,
              })),
              metrics: metricsFor(playerId, metrics),
              bestXiAppearances: 0,
            };
            candidates.set(playerId, candidate);
          }
          const historyEntry = candidate.history.find(
            (entry) => entry.tournamentId === tournament.id,
          );
          if (historyEntry && !historyEntry.selected) {
            historyEntry.selected = true;
            candidate.bestXiAppearances += 1;
          }
        }
      }
      if (missingPlayerRecord) {
        reviewReasons.push(
          `A selected ${key} is missing from the player records; review required.`,
        );
        continue;
      }
      const ranked = [...candidates.values()];
      if (ranked.length === 0) {
        reviewReasons.push(`No ${key} candidates are available in the saved Best XI records.`);
        continue;
      }
      const mostAppearances = Math.max(...ranked.map((candidate) => candidate.bestXiAppearances));
      let topCandidates = ranked.filter(
        (candidate) => candidate.bestXiAppearances === mostAppearances,
      );
      const leadingCandidate = topCandidates[0];
      if (!leadingCandidate) {
        reviewReasons.push(`No ${key} candidates are available in the saved Best XI records.`);
        continue;
      }
      const metricCount = performanceMetrics(key, leadingCandidate, metricsAvailable).length;
      for (
        let metricIndex = 0;
        metricIndex < metricCount && topCandidates.length > 1;
        metricIndex += 1
      ) {
        const values = topCandidates.map(
          (candidate) => performanceMetrics(key, candidate, metricsAvailable)[metricIndex],
        );
        if (values.some((value) => value === null || value === undefined)) continue;
        const availableValues = values.filter((value): value is number => value !== null);
        const bestValue = Math.max(...availableValues);
        topCandidates = topCandidates.filter(
          (candidate) =>
            performanceMetrics(key, candidate, metricsAvailable)[metricIndex] === bestValue,
        );
      }
      const first = topCandidates[0];
      if (!first || topCandidates.length !== 1) {
        reviewReasons.push(
          `${HOUSE_ICON_POSITIONS.find((item) => item.key === key)?.label ?? key} is tied after available performance, awards, and consistency data; review required.`,
        );
        continue;
      }
      const stats = supportingStats(key, first, metricsAvailable);
      const details = describeStats(stats, key);
      selections[key] = {
        playerId: first.player.id,
        playerName: first.player.name,
        teamName: first.player.team_id ? (teamNames.get(first.player.team_id) ?? null) : null,
        position: first.player.position,
        bestXiAppearances: first.bestXiAppearances,
        tournamentHistory: first.history,
        supportingStats: stats,
        rationale: `Selected with ${first.bestXiAppearances} Best XI appearance${first.bestXiAppearances === 1 ? "" : "s"}${details.length ? `; supporting data: ${details.join(", ")}` : "; no additional tie-break statistics were recorded"}.`,
        groupId,
      };
    }
  }

  const sortedEvents = groupEvents
    .map((event) => [
      event.id,
      event.fixture_id,
      event.player_id,
      event.assist_player_id,
      event.event_type,
      event.goal_type,
    ])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const sortedAppearances = groupAppearances
    .map((item) => [item.fixture_id, item.player_id, item.team_id])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const sortedRatings = groupRatings
    .map((item) => [item.fixture_id, item.player_id, item.rating])
    .sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));
  const fingerprint = hashSource({
    tournaments,
    bestXIs: groupBestXIs,
    fixtures: groupFixtures,
    events: sortedEvents,
    appearances: sortedAppearances,
    ratings: sortedRatings,
    players: [...playerById.values()]
      .filter((player) =>
        groupBestXIs.some((selection) => Object.values(selection).includes(player.id)),
      )
      .map((player) => [player.id, player.name, player.position, player.team_id])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
  });

  return {
    group_id: groupId,
    group_start: groupStart,
    group_end: groupEnd,
    tournament_ids: tournamentIds,
    status: reviewReasons.length === 0 ? "complete" : "insufficient_data",
    selections,
    review_reasons: reviewReasons,
    source_fingerprint: fingerprint,
    selection_history: oldGroup?.selection_history ?? [],
    updated_at: new Date().toISOString(),
  };
}

function hasSelection(group: HouseOfIconsGroup): boolean {
  return HOUSE_ICON_POSITIONS.some(({ key }) => group.selections[key] !== null);
}

export async function syncHouseOfIcons(): Promise<HouseOfIconsGroup[]> {
  const [tournaments, bestXIs, fixtures, events, appearances, ratings, players] = await Promise.all(
    [
      fetchTournaments(),
      fetchBestXIs(),
      fetchFixtures(),
      fetchAllMatchEvents(),
      fetchAllFixtureAppearances(),
      fetchAllFixturePlayerRatings(),
      fetchPlayers(),
    ],
  );
  const teams = new Map<string, string>();
  const { data: teamRows, error: teamError } = await supabase.from("teams").select("id,name");
  if (teamError) throw teamError;
  for (const team of teamRows ?? []) teams.set(team.id, team.name);

  const orderedTournaments = [...tournaments].sort(
    (a, b) =>
      a.created_at.localeCompare(b.created_at) ||
      a.date.localeCompare(b.date) ||
      a.id.localeCompare(b.id),
  );
  const existingGroups = await fetchStoredGroups();
  const existingById = new Map(existingGroups.map((group) => [group.group_id, group]));
  const generatedGroups: HouseOfIconsGroup[] = [];

  for (let offset = 3; offset + 2 < orderedTournaments.length; offset += 3) {
    generatedGroups.push(
      generateGroup(
        offset + 1,
        orderedTournaments.slice(offset, offset + 3),
        bestXIs,
        fixtures,
        events,
        appearances,
        ratings,
        players,
        teams,
        existingById.get(`tournaments-${offset + 1}-${offset + 3}`),
      ),
    );
  }

  const updates = generatedGroups.filter(
    (group) => existingById.get(group.group_id)?.source_fingerprint !== group.source_fingerprint,
  );
  await Promise.all(
    updates.map(async (group) => {
      const oldGroup = existingById.get(group.group_id);
      const history = [...(oldGroup?.selection_history ?? [])];
      if (oldGroup && hasSelection(oldGroup)) {
        history.push(
          serializeJson({
            sourceFingerprint: oldGroup.source_fingerprint,
            status: oldGroup.status,
            selections: oldGroup.selections,
            preservedAt: new Date().toISOString(),
          }),
        );
      }
      const { error } = await supabase.from("house_of_icons").upsert(
        {
          group_id: group.group_id,
          group_start: group.group_start,
          group_end: group.group_end,
          tournament_ids: group.tournament_ids,
          status: group.status,
          selections: serializeJson(group.selections),
          review_reasons: group.review_reasons,
          source_fingerprint: group.source_fingerprint,
          selection_history: history,
          updated_at: group.updated_at,
        },
        { onConflict: "group_id" },
      );
      if (error) throw error;
    }),
  );

  return fetchStoredGroups();
}
