import { teamInitials } from "@/lib/football";
import { Skeleton } from "@/components/ui/skeleton";

export function TeamBadge({
  team,
  size = 32,
}: {
  team: {
    name: string;
    short_name?: string | null;
    crest_color?: string | null;
    logo_url?: string | null;
  };
  size?: number;
}) {
  if (team.logo_url) {
    return (
      <img
        src={team.logo_url}
        alt={`${team.name} crest`}
        width={size}
        height={size}
        loading="lazy"
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{
        width: size,
        height: size,
        backgroundColor: team.crest_color ?? "#166534",
        fontSize: Math.round(size * 0.34),
      }}
    >
      {teamInitials(team)}
    </span>
  );
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <div className="page-header">
      <div className="mx-auto max-w-6xl px-4 py-8 sm:py-10">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.24em] text-primary">
          Friends League / Matchday
        </p>
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  );
}

export function ListSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-16 w-full rounded-xl" />
      ))}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">
      {message}
    </div>
  );
}
