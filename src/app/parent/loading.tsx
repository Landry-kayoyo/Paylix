import { Skeleton } from "@/components/ui/skeleton";

export default function ParentLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-10 w-72 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-20 rounded-xl" />
    </div>
  );
}
