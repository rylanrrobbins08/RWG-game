"use client";

import type { MovePosition } from "@/lib/moves";
import { POSITION_LABELS } from "@/lib/moves";
import WrestlerAvatar from "./WrestlerAvatar";

type WrestlingClashProps = {
  youName: string;
  youWeight: number;
  opponentName: string;
  opponentWeight: number;
  position: MovePosition;
  active?: boolean;
};

/** Two avatars locked up — layout shifts with Neutral / Top / Bottom. */
export default function WrestlingClash({
  youName,
  youWeight,
  opponentName,
  opponentWeight,
  position,
  active = true,
}: WrestlingClashProps) {
  const pose =
    position === "top"
      ? "rwg-clash-pose-top"
      : position === "bottom"
        ? "rwg-clash-pose-bottom"
        : "rwg-clash-pose-neutral";

  return (
    <div
      className={`rwg-clash ${active ? "rwg-clash-active" : ""} ${pose}`}
      aria-label={`${youName} vs ${opponentName}, ${POSITION_LABELS[position]}`}
    >
      <div className="rwg-clash-mat" aria-hidden />
      <div className="rwg-clash-you">
        <div className="rwg-clash-sway-you">
          <WrestlerAvatar
            name={youName}
            weightClass={youWeight}
            size="md"
            className="!h-14 !w-14 !text-base sm:!h-16 sm:!w-16 sm:!text-lg"
          />
        </div>
      </div>
      <div className="rwg-clash-opp">
        <div className="rwg-clash-sway-opp">
          <WrestlerAvatar
            name={opponentName}
            weightClass={opponentWeight}
            size="md"
            className="!h-14 !w-14 !text-base sm:!h-16 sm:!w-16 sm:!text-lg !border-[#c45c4a]"
          />
        </div>
      </div>
      <div className="rwg-clash-badge">
        <span className="rwg-clash-badge-label">Position</span>
        <span className="rwg-clash-badge-value">{POSITION_LABELS[position]}</span>
      </div>
    </div>
  );
}
