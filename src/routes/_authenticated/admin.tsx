import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { SiteLayout } from "@/components/SiteLayout";
import { PageHeader, TeamBadge, ListSkeleton, EmptyState } from "@/components/football-ui";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent,
} from "@/components/ui/accordion";
import {
  POSITIONS,
  deletePlayer,
  deleteTeam,
  fetchCompetitions,
  fetchPlayers,
  fetchTeams,
  insertTeams,
  savePlayer,
  upsertTeam,
  updateTeam,
  type Team,
} from "@/lib/football";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "League Editor — FRIENDS LEAGUE" },
      {
        name: "description",
        content: "Update FRIENDS LEAGUE teams and players.",
      },
      { property: "og:title", content: "League Editor — FRIENDS LEAGUE" },
      {
        property: "og:description",
        content: "Update teams and players for FRIENDS LEAGUE.",
      },
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

  const competition = competitions.data?.[0];
  const invalidate = () => {
    void qc.invalidateQueries();
  };

  return (
    <SiteLayout>
      <PageHeader
        title="League Editor"
        subtitle="Add your team names and players for everyone in FRIENDS LEAGUE."
      />
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Button variant="outline" asChild>
            <Link to="/">View public site</Link>
          </Button>
        </div>

        <Tabs defaultValue="teams">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="teams">Teams</TabsTrigger>
            <TabsTrigger value="players">Players</TabsTrigger>
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
                    <TeamRow key={t.id} team={t} onSaved={invalidate} />
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="players" className="mt-6 space-y-6">
            <PlayerForm teams={teams.data ?? []} onSaved={invalidate} />
            {(players.data ?? []).length === 0 ? (
              <EmptyState message="Add players here. Their names will appear in Top Scorers." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Accordion
                    type="multiple"
                    defaultValue={[(teams.data ?? [])[0]?.id ?? ""].filter(Boolean)}
                  >
                    {(teams.data ?? []).map((team) => {
                      const teamPlayers = (players.data ?? []).filter(
                        (p) => p.team_id === team.id && p.status === "Active",
                      );
                      if (teamPlayers.length === 0) return null;

                      return (
                        <AccordionItem key={team.id} value={team.id} className="border-b-0">
                          <AccordionTrigger className="px-3 py-2 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <TeamBadge team={team} size={24} />
                              <span className="font-medium">{team.name}</span>
                              <span className="text-xs text-muted-foreground">
                                ({teamPlayers.length})
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-0 py-0">
                            {teamPlayers.map((p) => (
                              <div
                                key={p.id}
                                className="flex items-center gap-3 border-t border-border/50 p-3"
                              >
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
        </Tabs>
      </div>
    </SiteLayout>
  );
}

function TeamRow({ team, onSaved }: { team: Team; onSaved: () => void }) {
  const [editing, setEditing] = useState(false);
  const [manager, setManager] = useState(team.manager ?? "");
  const [formation, setFormation] = useState(team.formation ?? "");
  const save = useMutation({
    mutationFn: () =>
      updateTeam(team.id, {
        manager: manager.trim() || null,
        formation: formation.trim() || null,
      }),
    onSuccess: () => {
      toast.success("Team details updated");
      setEditing(false);
      onSaved();
    },
    onError: (e: Error) => toast.error(`Could not update team details: ${e.message}`),
  });

  function cancelEditing() {
    setManager(team.manager ?? "");
    setFormation(team.formation ?? "");
    setEditing(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-border/50 p-3 last:border-0">
      <TeamBadge team={team} size={32} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{team.name}</p>
        {editing ? (
          <form
            className="mt-2 flex max-w-lg flex-wrap items-center gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              save.mutate();
            }}
          >
            <Input
              autoFocus
              aria-label={`${team.name} manager`}
              placeholder="Manager name"
              value={manager}
              onChange={(event) => setManager(event.target.value)}
            />
            <Input
              aria-label={`${team.name} formation`}
              placeholder="Formation (e.g. 4-3-3)"
              value={formation}
              onChange={(event) => setFormation(event.target.value)}
            />
            <Button
              type="submit"
              size="icon"
              aria-label={`Save details for ${team.name}`}
              disabled={save.isPending}
            >
              <Check className="size-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Cancel editing ${team.name}`}
              onClick={cancelEditing}
            >
              <X className="size-4" />
            </Button>
          </form>
        ) : (
          <div className="space-y-0.5 text-xs text-muted-foreground">
            <p className="truncate">Manager: {team.manager ?? "Not assigned"}</p>
            <p className="truncate">Formation: {team.formation ?? "Not set"}</p>
          </div>
        )}
      </div>
      {!editing && (
        <Button
          variant="ghost"
          size="icon"
          aria-label={`Edit details for ${team.name}`}
          onClick={() => setEditing(true)}
        >
          <Pencil className="size-4" />
        </Button>
      )}
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Delete ${team.name}`}
        onClick={async () => {
          try {
            await deleteTeam(team.id);
            toast.success("Team deleted");
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

function TeamForm({
  competitionId,
  onSaved,
}: {
  competitionId: string | null;
  onSaved: () => void;
}) {
  const [teams, setTeams] = useState([{ name: "", color: "#e4573d", manager: "", formation: "" }]);

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
          formation: team.formation.trim() || null,
        }));
      if (!rows.length) throw new Error("Enter at least one team name.");
      return insertTeams(rows);
    },
    onSuccess: () => {
      toast.success("Teams saved");
      setTeams([{ name: "", color: "#e4573d", manager: "", formation: "" }]);
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
        <div className="hidden grid-cols-[1fr_1fr_1fr_auto_auto] gap-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground sm:grid">
          <span>Team name</span>
          <span>Manager</span>
          <span>Formation</span>
          <span>Color</span>
          <span className="sr-only">Remove</span>
        </div>
        {teams.map((team, index) => (
          <div
            key={index}
            className="grid grid-cols-1 items-center gap-3 sm:grid-cols-[1fr_1fr_1fr_auto_auto]"
          >
            <Input
              aria-label={`Team ${index + 1} name`}
              placeholder={`Team ${index + 1}`}
              value={team.name}
              onChange={(e) =>
                setTeams((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, name: e.target.value } : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`Team ${index + 1} manager`}
              placeholder="Manager name"
              value={team.manager}
              onChange={(e) =>
                setTeams((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, manager: e.target.value } : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`Team ${index + 1} formation`}
              placeholder="Formation (e.g. 4-3-3)"
              value={team.formation}
              onChange={(e) =>
                setTeams((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, formation: e.target.value } : item,
                  ),
                )
              }
            />
            <Input
              aria-label={`Team ${index + 1} color`}
              className="h-9 w-14 cursor-pointer p-1"
              type="color"
              value={team.color}
              onChange={(e) =>
                setTeams((current) =>
                  current.map((item, i) =>
                    i === index ? { ...item, color: e.target.value } : item,
                  ),
                )
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
          <Button
            type="button"
            variant="outline"
            onClick={() =>
              setTeams((current) => [
                ...current,
                { name: "", color: "#e4573d", manager: "", formation: "" },
              ])
            }
          >
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

  const save = useMutation({
    mutationFn: async () =>
      savePlayer({
        name,
        team_id: teamId || null,
        position,
      }),
    onSuccess: () => {
      toast.success("Player saved");
      setName("");
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Your Player</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4 sm:grid-cols-3">
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
        <div className="sm:col-span-3">
          <Button onClick={() => save.mutate()} disabled={!name || !teamId || save.isPending}>
            {save.isPending ? "Saving…" : "Add player"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
