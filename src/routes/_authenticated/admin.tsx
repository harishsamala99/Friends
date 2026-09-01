import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import {
  POSITIONS,
  deleteFixture,
  deletePlayer,
  deleteTeam,
  fetchCompetitions,
  fetchFixtures,
  fetchPlayers,
  fetchTeams,
  insertTeams,
  insertFixtures,
  upsertPlayer,
} from "@/lib/football";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "League Editor — FRIENDS LEAGUE" },
      { name: "description", content: "Update FRIENDS LEAGUE teams, players, fixtures and results." },
      { property: "og:title", content: "League Editor — FRIENDS LEAGUE" },
      { property: "og:description", content: "Update teams, players, fixtures and results for FRIENDS LEAGUE." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AdminPage,
});

function AdminPage() {
  const qc = useQueryClient();
  const competitions = useQuery({ queryKey: ["competitions"], queryFn: fetchCompetitions });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const fixtures = useQuery({ queryKey: ["fixtures"], queryFn: () => fetchFixtures() });

  const competition = competitions.data?.[0];
  const invalidate = () => {
    void qc.invalidateQueries();
  };

  return (
    <SiteLayout>
      <PageHeader
        title="League Editor"
        subtitle="Add your team names and players, then manage fixtures and results for everyone in FRIENDS LEAGUE."
      />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/">View public site</Link>
          </Button>
        </div>

        <Tabs defaultValue="teams">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
            <TabsTrigger value="fixtures">Fixtures</TabsTrigger>
          </TabsList>

          <TabsContent value="teams" className="mt-6 space-y-6">
            <TeamForm competitionId={competition?.id ?? null} onSaved={invalidate} />
            {teams.isLoading ? (
              <ListSkeleton rows={4} />
            ) : (teams.data ?? []).length === 0 ? (
              <EmptyState message="No teams yet — add your first team above." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(teams.data ?? []).map((t) => (
                    <div key={t.id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
                      <TeamBadge team={t} size={32} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{t.city ?? "—"}</p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete ${t.name}`}
                        onClick={async () => {
                          try {
                            await deleteTeam(t.id);
                            toast.success("Team deleted");
                            invalidate();
                          } catch (e) {
                            toast.error(e instanceof Error ? e.message : "Delete failed");
                          }
                        }}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-6 space-y-6">
            <PlayerForm teams={teams.data ?? []} onSaved={invalidate} />
            {(players.data ?? []).length === 0 ? (
              <EmptyState message="Add players here, then record their goals under Fixtures. Their names will appear in Top Scorers." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Accordion type="multiple" defaultValue={[(teams.data ?? [])[0]?.id ?? ""].filter(Boolean)}>
                    {(teams.data ?? []).map((team) => {
                      const teamPlayers = (players.data ?? []).filter((p) => p.team_id === team.id);
                      if (teamPlayers.length === 0) return null;
                      
                      return (
                        <AccordionItem key={team.id} value={team.id} className="border-b-0">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <TeamBadge team={team} size={24} />
                              <span className="font-medium">{team.name}</span>
                              <span className="text-xs text-muted-foreground">({teamPlayers.length})</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-0 py-0">
                            {teamPlayers.map((p) => (
                              <div key={p.id} className="flex items-center gap-3 border-t border-border/50 p-3">
                                <span className="w-8 text-center text-sm text-muted-foreground tabular-nums">
                                  {p.jersey_number ?? "-"}
                                </span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate font-medium">{p.name}</p>
                                  <p className="truncate text-xs text-muted-foreground">
                                    {p.position}
                                  </p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  aria-label={`Delete ${p.name}`}
                                  onClick={async () => {
                                    try {
                                      await deletePlayer(p.id);
                                      toast.success("Player deleted");
                                      invalidate();
                                    } catch (e) {
                                      toast.error(e instanceof Error ? e.message : "Delete failed");
                                    }
                                  }}
                                >
                                  <Trash2 className="size-4" />
                                </Button>
                              </div>
                            ))}
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="fixtures" className="mt-6 space-y-6">
            <FixtureTools
              competitionId={competition?.id ?? null}
              teams={teams.data ?? []}
              onSaved={invalidate}
            />
            {(fixtures.data ?? []).length === 0 ? (
              <EmptyState message="No fixtures yet." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(fixtures.data ?? []).map((f) => {
                    const home = (teams.data ?? []).find((t) => t.id === f.home_team_id);
                    const away = (teams.data ?? []).find((t) => t.id === f.away_team_id);
                    return (
                      <FixtureRow
                        key={f.id}
                        fixture={f}
                        homeName={home?.name}
                        awayName={away?.name}
                        onSaved={invalidate}
                      />
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </SiteLayout>
  );
}

function FixtureRow({
  fixture,
  homeName,
  awayName,
  onSaved,
}: {
  fixture: { id: string; matchday: number; home_score: number | null; away_score: number | null; status: string };
  homeName?: string;
  awayName?: string;
  onSaved: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/50 p-3 last:border-0">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">MD {fixture.matchday}</span>
        <span className="min-w-0 truncate text-sm font-medium">
          {homeName} vs {awayName}
        </span>
      </div>
      <span className="rounded-md bg-secondary px-3 py-1 text-sm font-semibold tabular-nums">
        {fixture.home_score ?? "-"} - {fixture.away_score ?? "-"}
      </span>
      <span className="text-xs text-muted-foreground">Open the match to edit its score</span>
      <Button
        className="justify-self-end sm:ml-auto"
        variant="ghost"
        size="icon"
        title="Delete fixture"
        aria-label="Delete fixture"
        onClick={async () => {
          try {
            await deleteFixture(fixture.id);
            toast.success("Fixture deleted");
            onSaved();
          } catch (e) {
            toast.error(e instanceof Error ? e.message : "Delete failed");
          }
        }}
      >
        <Trash2 className="size-4" />
      </Button>
    </div>
  );
}

function Field({ id, label, children }: { id: string; label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      {children}
    </div>
  );
}

function TeamForm({ competitionId, onSaved }: { competitionId: string | null; onSaved: () => void }) {
  const [teams, setTeams] = useState([{ name: "", color: "#e4573d", manager: "" }]);

  const save = useMutation({
    mutationFn: async () => {
      const rows = teams
        .map((team) => ({ ...team, name: team.name.trim() }))
        .filter((team) => team.name.length > 0)
        .map((team) => ({
          competition_id: competitionId,
          name: team.name,
          crest_color: team.color,
          manager: team.manager.trim() || null,
        }));
      if (!rows.length) throw new Error("Enter at least one team name.");
      return insertTeams(rows);
    },
    onSuccess: () => {
      toast.success("Teams saved");
      setTeams([{ name: "", color: "#e4573d", manager: "" }]);
      onSaved();
    },
    onError: (e: Error) => toast.error(`Could not save teams: ${e.message}`),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add your teams</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          <span>Team name</span>
          <span>Manager</span>
          <span>Color</span>
          <span className="sr-only">Remove</span>
        </div>
        {teams.map((team, index) => (
          <div key={index} className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-3">
            <Input
              aria-label={`Team ${index + 1} name`}
              placeholder={`Team ${index + 1}`}
              value={team.name}
              onChange={(e) =>
                setTeams((current) => current.map((item, i) => (i === index ? { ...item, name: e.target.value } : item)))
              }
            />
            <Input
              aria-label={`Team ${index + 1} manager`}
              placeholder="Manager name"
              value={team.manager}
              onChange={(e) =>
                setTeams((current) => current.map((item, i) => (i === index ? { ...item, manager: e.target.value } : item)))
              }
            />
            <Input
              aria-label={`Team ${index + 1} color`}
              className="h-9 w-14 cursor-pointer p-1"
              type="color"
              value={team.color}
              onChange={(e) =>
                setTeams((current) => current.map((item, i) => (i === index ? { ...item, color: e.target.value } : item)))
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove team ${index + 1}`}
              disabled={teams.length === 1}
              onClick={() => setTeams((current) => current.filter((_, i) => i !== index))}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="outline" onClick={() => setTeams((current) => [...current, { name: "", color: "#e4573d", manager: "" }])}>
            Add another team
          </Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Saving teams…" : "Save all teams"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PlayerForm({
  teams,
  onSaved,
}: {
  teams: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [name, setName] = useState("");
  const [teamId, setTeamId] = useState("");
  const [position, setPosition] = useState<string>("Midfielder");
  const [jersey, setJersey] = useState("");

  const save = useMutation({
    mutationFn: async () =>
      upsertPlayer({
        name,
        team_id: teamId || null,
        position,
        jersey_number: jersey ? Number(jersey) : null,
      }),
    onSuccess: () => {
      toast.success("Player saved");
      setName("");
      setJersey("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add a player for Top Scorers</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-4">
        <Field id="p-name" label="Name">
          <Input id="p-name" value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field id="p-team" label="Team">
          <select
            id="p-team"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={teamId}
            onChange={(e) => setTeamId(e.target.value)}
          >
            <option value="">Select team</option>
            {teams.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="p-pos" label="Position">
          <select
            id="p-pos"
            className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
          >
            {POSITIONS.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </Field>
        <Field id="p-jersey" label="Jersey #">
          <Input id="p-jersey" type="number" value={jersey} onChange={(e) => setJersey(e.target.value)} />
        </Field>
        <div className="sm:col-span-4">
          <Button onClick={() => save.mutate()} disabled={!name || !teamId || save.isPending}>
            {save.isPending ? "Saving…" : "Add player"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function FixtureTools({
  competitionId,
  teams,
  onSaved,
}: {
  competitionId: string | null;
  teams: { id: string; name: string }[];
  onSaved: () => void;
}) {
  const [homeId, setHomeId] = useState("");
  const [awayId, setAwayId] = useState("");
  const [matchCount, setMatchCount] = useState("1");

  async function scheduleMatches() {
    if (!competitionId) return toast.error("No competition is configured yet");
    if (homeId === awayId) return toast.error("Pick two different teams");
    const count = Math.max(1, Math.min(50, Number(matchCount) || 1));
    const start = Date.now();
    try {
      await insertFixtures(
        Array.from({ length: count }, (_, index) => ({
          competition_id: competitionId,
          home_team_id: homeId,
          away_team_id: awayId,
          matchday: index + 1,
          kickoff: new Date(start + index * 7 * 24 * 3600 * 1000).toISOString(),
        })),
      );
      toast.success(`${count} match${count === 1 ? "" : "es"} scheduled`);
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not add fixture");
    }
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Schedule matches</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <Field id="f-home" label="Home team">
            <select
              id="f-home"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={homeId}
              onChange={(e) => setHomeId(e.target.value)}
            >
              <option value="">Select</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-away" label="Away team">
            <select
              id="f-away"
              className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
              value={awayId}
              onChange={(e) => setAwayId(e.target.value)}
            >
              <option value="">Select</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </Field>
          <Field id="f-count" label="Number of matches">
            <Input id="f-count" type="number" min="1" max="50" value={matchCount} onChange={(e) => setMatchCount(e.target.value)} />
          </Field>
          <div className="sm:col-span-3">
            <Button onClick={scheduleMatches} disabled={!homeId || !awayId}>
              Schedule matches
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
