type WrestlerAvatarProps = {
  name: string;
  weightClass?: number;
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CLASS = {
  sm: "h-12 w-12 text-sm",
  md: "h-16 w-16 text-lg sm:h-20 sm:w-20 sm:text-xl",
  lg: "h-24 w-24 text-2xl sm:h-28 sm:w-28 sm:text-3xl",
} as const;

function initialsFromName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0] ?? ""}${parts[parts.length - 1][0] ?? ""}`.toUpperCase();
}

/** Blue-ringed silhouette + initials placeholder for the active wrestler. */
export default function WrestlerAvatar({
  name,
  weightClass,
  size = "md",
  className = "",
}: WrestlerAvatarProps) {
  const initials = initialsFromName(name);

  return (
    <div
      className={`relative shrink-0 overflow-hidden rounded-md border-2 border-accent bg-[linear-gradient(160deg,#0f172a_0%,#0c0e12_55%,#12161f_100%)] shadow-[inset_0_0_0_1px_rgba(59,130,246,0.25)] ${SIZE_CLASS[size]} ${className}`}
      aria-label={`${name} avatar placeholder`}
      title={weightClass ? `${name} · ${weightClass} lbs` : name}
    >
      <svg
        className="absolute inset-0 h-full w-full text-accent/25"
        viewBox="0 0 80 80"
        fill="none"
        aria-hidden
      >
        <circle cx="40" cy="28" r="12" fill="currentColor" />
        <path
          d="M18 72c4-16 12-24 22-24s18 8 22 24"
          fill="currentColor"
        />
        <path
          d="M8 78h64"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.4"
        />
      </svg>
      <span className="relative z-[1] flex h-full w-full items-center justify-center font-display font-bold tracking-wide text-accent drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]">
        {initials}
      </span>
    </div>
  );
}
