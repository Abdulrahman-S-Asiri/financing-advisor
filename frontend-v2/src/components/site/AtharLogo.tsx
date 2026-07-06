type AtharLogoProps = {
  variant?: "horizontal" | "arabic" | "mark";
  tone?: "default" | "reversed";
  size?: "sm" | "md" | "lg";
  className?: string;
};

const sizeClasses = {
  sm: {
    wrapper: "gap-2",
    mark: "size-8",
    word: "text-[0.95rem]",
    sub: "text-[0.58rem]",
  },
  md: {
    wrapper: "gap-3",
    mark: "size-10",
    word: "text-lg",
    sub: "text-[0.64rem]",
  },
  lg: {
    wrapper: "gap-4",
    mark: "size-14",
    word: "text-2xl",
    sub: "text-xs",
  },
};

function AtharMark({ tone, className }: { tone: "default" | "reversed"; className: string }) {
  const ring = tone === "reversed" ? "rgba(250,247,242,0.78)" : "var(--brand)";

  return (
    <svg
      aria-hidden="true"
      className={className}
      focusable="false"
      viewBox="0 0 64 64"
    >
      <circle cx="32" cy="32" r="7" fill="var(--athar-gold)" />
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
        opacity="0.72"
        stroke={ring}
        strokeLinecap="round"
        strokeWidth="3"
      />
      <path
        d="M8 24a30 30 0 0 1 48 24"
        fill="none"
        opacity="0.54"
        stroke={ring}
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  );
}

export function AtharLogo({
  className = "",
  size = "md",
  tone = "default",
  variant = "arabic",
}: AtharLogoProps) {
  const classes = sizeClasses[size];
  const textTone = tone === "reversed" ? "text-sand" : "text-ink";
  const subTone = tone === "reversed" ? "text-sand/70" : "text-muted";

  if (variant === "mark") {
    return (
      <span aria-label="أثر" className={`inline-flex items-center ${className}`}>
        <AtharMark className={classes.mark} tone={tone} />
      </span>
    );
  }

  return (
    <span
      aria-label="أثر - ATHAR"
      className={`inline-flex items-center ${classes.wrapper} ${className}`}
    >
      <AtharMark className={classes.mark} tone={tone} />
      <span className="grid leading-none">
        <strong
          className={`${classes.word} font-black tracking-normal ${textTone}`}
          lang={variant === "horizontal" ? "en" : "ar"}
        >
          {variant === "horizontal" ? "ATHAR" : "أثر"}
        </strong>
        <small className={`mt-1 font-semibold tracking-normal ${classes.sub} ${subTone}`}>
          {variant === "horizontal" ? "AGENTIC FINANCING ADVISOR" : "مستشار تمويل وكيلي"}
        </small>
      </span>
    </span>
  );
}
