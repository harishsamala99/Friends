import { createFileRoute } from "@tanstack/react-router";
import { FinalMatchScorecard } from "@/components/final-match-scorecard";

export const Route = createFileRoute("/scorecard")({
  head: () => ({
    meta: [
      { title: "Final Match Scorecard — FRIENDS LEAGUE" },
      { name: "description", content: "Interactive final match scorecard widget" },
      { property: "og:title", content: "Final Match Scorecard — FRIENDS LEAGUE" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ScorecardPage,
});

function ScorecardPage() {
  return <FinalMatchScorecard />;
}
