import { ATTRIBUTE_INFO, type Attribute } from "@/lib/game-store";

type AttributeLabelProps = {
  attr: Attribute;
  className?: string;
  showHint?: boolean;
};

/** Attribute name with native tooltip description. */
export default function AttributeLabel({
  attr,
  className = "text-sm font-medium text-foreground",
  showHint = false,
}: AttributeLabelProps) {
  const info = ATTRIBUTE_INFO[attr];

  return (
    <span className={`inline-flex flex-col gap-0.5 ${className}`} title={info}>
      <span className="inline-flex items-center gap-1">
        {attr}
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-full border border-panel-border text-[9px] font-semibold text-muted"
          aria-hidden
        >
          ?
        </span>
      </span>
      {showHint && (
        <span className="text-[11px] font-normal leading-snug text-muted">{info}</span>
      )}
    </span>
  );
}
