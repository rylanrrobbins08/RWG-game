import type { ReactNode } from "react";

/** Shared dark arena page wrapper with blue accents. */
export default function ArenaPage({
  children,
  wide = false,
}: {
  children: ReactNode;
  wide?: boolean;
}) {
  return (
    <div className="rwg-page">
      <div className="rwg-page-bg" aria-hidden />
      <main className={`rwg-main ${wide ? "rwg-main-wide" : ""}`}>{children}</main>
    </div>
  );
}
