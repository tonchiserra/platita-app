import { Skeleton } from "./index";

/** Shown the instant a link is tapped, while the next page's data streams in. */
export function PageSkeleton() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }} aria-busy="true" aria-label="Cargando">
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <Skeleton height={18} width={180} />
        <Skeleton height={64} width="65%" />
        <Skeleton height={32} width={180} radius={999} />
      </div>
      <Skeleton height={300} />
      <Skeleton height={220} />
    </div>
  );
}
