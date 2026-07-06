import { Card } from "@/components/ui/card";

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-lg bg-line/70 ${className}`} />;
}

export function SkeletonCard() {
  return (
    <Card>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="mt-3 h-4 w-2/3" />
      <Skeleton className="mt-2 h-4 w-1/2" />
    </Card>
  );
}
