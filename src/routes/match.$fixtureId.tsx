import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { SiteLayout } from "@/components/SiteLayout";
import { TeamBadge, ListSkeleton, EmptyState, formatKickoff } from "@/components/football-ui";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EVENT_TYPES, fetchEvents, fetchFixture, fetchPlayers, fetchTeams } from "@/lib/football";

export const Route = createFileRoute("/match/$fixtureId")({
  head: () => ({
    meta: [
      { title: "Match Centre — FRIENDS LEAGUE" },
      { name: "description", content: "Live match centre with score, timeline of goals and cards." },
      { property: "og:title", content: "Match Centre — FRIENDS LEAGUE" },
      { property: "og:description", content: "Score, goals, assists and cards for this fixture." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: MatchPage,
  errorComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState message="This match could not be loaded." />
      </div>
    </SiteLayout>
  ),
  notFoundComponent: () => (
    <SiteLayout>
      <div className="mx-auto max-w-3xl px-4 py-16">
        <EmptyState message="Match not found." />
      </div>
    </SiteLayout>
  ),
});

function MatchPage() {
  const { fixtureId } = Route.useParams();
  const fixture = useQuery({ queryKey: ["fixture", fixtureId], queryFn: () => fetchFixture(fixtureId) });
  const teams = useQuery({ queryKey: ["teams"], queryFn: () => fetchTeams() });
  const players = useQuery({ queryKey: ["players"], queryFn: () => fetchPlayers() });
  const events = useQuery({ queryKey: ["events", fixtureId], queryFn: () => fetchEvents(fixtureId) });

  const f = fixture.data;
  const byId = new Map((teams.data ?? []).map((t) => [t.id, t]));
  const playerById = new Map((players.data ?? []).map((p) => [p.id, p]));
  const home = f ? byId.get(f.home_team_id) : undefined;
  const away = f ? byId.get(f.away_team_id) : undefined;

  return (
    <SiteLayout>
      {fixture.isLoading ? (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <ListSkeleton rows={4} />
        </div>
      ) : !f ? (
        <div className="mx-auto max-w-3xl px-4 py-16">
          <EmptyState message="Match not found." />
        </div>
      ) : (
        <>
          <section className="pitch-gradient text-pitch-foreground">
            <div className="mx-auto max-w-4xl px-4 py-12 text-center">
              <Badge className="mb-4">{f.status}</Badge>
              <div className="flex items-center justify-center gap-4 sm:gap-10">
                <div className="flex flex-1 flex-col items-center gap-2">
                  {home && <TeamBadge team={home} size={56} />}
                  <span className="text-sm font-semibold sm:text-lg">{home?.name}</span>
                </div>
                <div className="font-display text-4xl font-bold tabular-nums sm:text-6xl">
                  {f.home_score ?? 0} : {f.away_score ?? 0}
                </div>
                <div className="flex flex-1 flex-col items-center gap-2">
                  {away && <TeamBadge team={away} size={56} />}
                  <span className="text-sm font-semibold sm:text-lg">{away?.name}</span>
                </div>
              </div>
              <p className="mt-6 text-sm opacity-80">
                Matchday {f.matchday} · {formatKickoff(f.kickoff)}
                {f.venue ? ` · ${f.venue}` : ""}
              </p>
            </div>
          </section>

          <div className="mx-auto max-w-3xl px-4 py-10">
            <h2 className="mb-4 font-display text-2xl font-bold">Timeline</h2>
            {(events.data ?? []).length === 0 ? (
              <EmptyState message="No match events recorded." />
            ) : (
              <Card>
                <CardContent className="p-0">
                  {(events.data ?? []).map((e) => {
                    const meta = EVENT_TYPES.find((t) => t.value === e.event_type);
                    const player = e.player_id ? playerById.get(e.player_id) : undefined;
                    const team = e.team_id ? byId.get(e.team_id) : undefined;
                    return (
                      <div key={e.id} className="flex items-center gap-3 border-b border-border/50 p-3 last:border-0">
                        <span className="w-10 text-sm font-semibold tabular-nums text-muted-foreground">
                          {e.minute}'
                        </span>
                        <span aria-hidden>{meta?.icon ?? "•"}</span>
                        <span className="flex-1 truncate">
                          <span className="font-medium">{player?.name ?? meta?.label}</span>
                          {player && <span className="text-muted-foreground"> — {meta?.label}</span>}
                        </span>
                        <span className="truncate text-sm text-muted-foreground">{team?.name}</span>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </SiteLayout>
  );
}
