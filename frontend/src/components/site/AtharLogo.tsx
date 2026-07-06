type AtharLogoProps = {
  variant?: "horizontal" | "arabic" | "mark";
  tone?: "default" | "reversed";
  size?: "sm" | "md" | "lg";
  className?: string;
};

function AtharMark({ tone }: { tone: "default" | "reversed" }) {
  const ring = tone === "reversed" ? "rgba(250,247,242,0.72)" : "rgba(10,31,68,0.62)";
  const dot = "var(--athar-gold)";

  return (
    <svg
      aria-hidden="true"
      className="atharLogoMark"
      focusable="false"
      viewBox="0 0 64 64"
    >
      <circle cx="32" cy="32" r="7" fill={dot} />
      <circle cx="32" cy="32" fill="none" r="16" stroke={ring} strokeWidth="3" />
      <path
        d="M13 32a19 19 0 0 1 38 0"
        fill="none"
        stroke={ring}
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M51 32a19 19 0 0 1-38 0"
        fill="none"
        stroke={ring}
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.72"
      />
      <path
        d="M8 24a30 30 0 0 1 48 24"
        fill="none"
        stroke={ring}
        strokeLinecap="round"
        strokeWidth="3"
        opacity="0.54"
      />
    </svg>
  );
}

export default function AtharLogo({
  className = "",
  size = "md",
  tone = "default",
  variant = "horizontal",
}: AtharLogoProps) {
  const classNames = [
    "atharLogo",
    `atharLogo-${variant}`,
    `atharLogo-${tone}`,
    `atharLogo-${size}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (variant === "mark") {
    return (
      <span aria-label="أثر" className={classNames}>
        <AtharMark tone={tone} />
      </span>
    );
  }

  return (
    <span aria-label="أثر - ATHAR" className={classNames}>
      <AtharMark tone={tone} />
      <span className="atharLogoWordmark">
        {variant === "arabic" ? (
          <>
            <strong lang="ar">أثر</strong>
            <small>مستشار تمويل وكيلي</small>
          </>
        ) : (
          <>
            <strong lang="en">ATHAR</strong>
            <small>AGENTIC FINANCING ADVISOR</small>
          </>
        )}
      </span>
    </span>
  );
}
