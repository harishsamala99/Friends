import { createFileRoute } from "@tanstack/react-router";
import { SiteLayout } from "@/components/SiteLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/code-of-conduct")({
  head: () => ({
    meta: [
      { title: "Code of Conduct — FRIENDS LEAGUE" },
      { name: "description", content: "Official Code of Conduct and Rules for the FRIENDS LEAGUE tournament." },
      { property: "og:title", content: "Code of Conduct — FRIENDS LEAGUE" },
      { property: "og:description", content: "Tournament rules, regulations, and code of conduct." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CodeOfConduct,
});

function CodeOfConduct() {
  return (
    <SiteLayout>
      <div className="mx-auto max-w-4xl px-4 py-10">
        <div className="mb-8 text-center">
          <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl">Code of Conduct</h1>
          <p className="mt-2 text-lg text-muted-foreground">Official Rules and Regulations</p>
        </div>

        <div className="space-y-6">
          {/* Section 1 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">1. Team Registration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Each team must declare its Manager, Team Name/Brand/Logo, and final squad of 23 players before the
                tournament begins.
              </p>
              <p>
                Once the tournament starts, no changes to the registered squad will be permitted unless approved by the
                tournament organizers.
              </p>
            </CardContent>
          </Card>

          {/* Section 2 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">2. Tournament Theme Privilege</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                The tournament will have three designated players who will have the privilege of deciding the theme of
                the tournament.
              </p>
              <p>
                The privilege will rotate from one tournament to the next, ensuring that each designated player gets an
                opportunity to set the theme.
              </p>
            </CardContent>
          </Card>

          {/* Section 3 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">3. League Points System</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="font-medium">The following points system will apply during the league stage:</p>
              <ul className="space-y-2 pl-5">
                <li className="flex items-center gap-2">
                  <span className="font-semibold">Win:</span> 3 points
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">Draw:</span> 1 point
                </li>
                <li className="flex items-center gap-2">
                  <span className="font-semibold">Loss:</span> 0 points
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 4 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">4. Qualification & Tie-Breaker Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>If two teams finish the league stage with the same number of points:</p>
              <ul className="space-y-2 pl-5">
                <li>
                  • The team with the better Goal Difference (GD) will qualify.
                </li>
                <li>
                  • If both teams have the same Goal Difference, the Goal Difference of matches between those two teams will be considered to determine which team advances.
                </li>
              </ul>
            </CardContent>
          </Card>

          {/* Section 5 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">5. Match Duration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">League Matches</h4>
                <ul className="space-y-2 pl-5">
                  <li>• Each league match will be played for 8 minutes.</li>
                  <li>• There will be no extra time or penalty shootout during league matches.</li>
                  <li>
                    • If the match is level at the end of the allotted time, it will be recorded as a draw.
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Final Match</h4>
                <ul className="space-y-2 pl-5">
                  <li>• The final will be played for 10 minutes.</li>
                  <li>• If the match is level at the end of regular time, extra time will be played.</li>
                  <li>• If the match remains level after extra time, the winner will be decided by a penalty shootout.</li>
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Section 6 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">6. Disciplinary Rules</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <div>
                <h4 className="font-semibold mb-2">Yellow Card</h4>
                <p>A player receiving a yellow card during a match will be suspended for the next match.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Red Card</h4>
                <p>A player receiving a red card during a match will be suspended for the next two matches.</p>
              </div>
              <div>
                <h4 className="font-semibold mb-2">Reporting of Disciplinary Incidents</h4>
                <p>
                  The above suspension rules will apply only when a contestant reports the incident in the official
                  tournament group.
                </p>
                <p>
                  The report should be made clearly and promptly so that the organizers can record the suspension
                  accordingly.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Section 7 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">7. Quitting or Abandoning a Match</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                Intentional or unintentional quitting, disconnecting, or abandoning a match is not acceptable.
              </p>
              <p>
                If a player/team quits or leaves the game before the match is completed, the opposing team will be
                awarded the win.
              </p>
              <p>
                The organizers' decision regarding a match abandonment will be considered final.
              </p>
            </CardContent>
          </Card>

          {/* Section 8 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">8. Sportsmanship & Fair Play</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <p>
                Football is a game of strategy, power, intense focus, discipline, and timing. A team that combines these
                qualities with intelligent strategy earns the right to win.
              </p>
              <p>
                At the same time, football is a game of passion and love. Respect for opponents, teammates, and the spirit
                of competition is expected from everyone. Fighting spirit, determination, and competitive intensity are
                always applauded — disrespect and unsportsmanlike behaviour are not.
              </p>
              <p>
                Every match is an opportunity to compete, learn, and improve.
              </p>
              <p>
                Sometimes, the game will not go your way. Do not overthink the result. Stay calm, analyse what went wrong,
                develop better strategies, and come back stronger.
              </p>
              <div className="mt-4 rounded-lg bg-accent/10 p-4 font-semibold text-foreground">
                <p className="leading-relaxed">
                  Play with Passion. Compete with Respect. Think with Strategy. Come Back Stronger.
                </p>
              </div>
              <p>
                The objective is not only to win, but to become a better player and a better competitor with every
                tournament.
              </p>
            </CardContent>
          </Card>

          {/* Section 9 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-xl">9. Final Authority</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p>
                All participants are expected to understand and follow these rules before participating in the tournament.
              </p>
              <p>
                Any situation not specifically covered in this Code of Conduct will be handled by the tournament organizers.
              </p>
              <p>
                The organizers' decision on disputes, disciplinary matters, match results, and rule interpretations will be
                final and binding.
              </p>
            </CardContent>
          </Card>

          {/* Footer Message */}
          <div className="rounded-lg bg-pitch-gradient p-6 text-center text-pitch-foreground">
            <p className="font-display text-2xl font-bold">PLAY FAIR. PLAY SMART. PLAY WITH RESPECT.</p>
            <p className="mt-3 text-lg font-semibold">LET THE BEST TEAM WIN.</p>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
