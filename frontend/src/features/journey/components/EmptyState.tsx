export function EmptyState({
  actionLabel,
  title,
  onAction,
}: {
  actionLabel?: string;
  title: string;
  onAction?: () => void;
}) {
  return (
    <section className="emptyState">
      <h3>{title}</h3>
      {actionLabel && onAction && (
        <button className="secondaryButton" type="button" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </section>
  );
}
