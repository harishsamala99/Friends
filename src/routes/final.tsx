import { createFileRoute } from "@tanstack/react-router";
import { FinalMatchScorecard } from "@/components/final-match-scorecard";

export const Route = createFileRoute("/final")({
  head: () => ({
    meta: [
      { title: "Create Tournament — FRIENDS LEAGUE" },
      { name: "description", content: "Create and manage final match matchups" },
      { property: "og:title", content: "Create Tournament — FRIENDS LEAGUE" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: FinalPage,
});

function FinalPage() {
  return <FinalMatchScorecard />;
}
