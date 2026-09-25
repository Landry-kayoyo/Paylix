import { Suspense } from "react";
import { getParentsData } from "./actions";
import { ParentsClient } from "./parents-client";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata = {
  title: "Parents / Tuteurs — Paylix",
  description: "Gérez les parents et tuteurs de l'établissement.",
};

async function ParentsContent() {
  const { parents, total } = await getParentsData(1, 25);
  return <ParentsClient initialParents={parents} initialTotal={total} />;
}

function ParentsSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-4 w-32" />
        </div>
        <Skeleton className="h-9 w-40" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-9 flex-1" />
        <Skeleton className="h-9 w-20" />
        <Skeleton className="h-9 w-20" />
      </div>
      <div className="rounded-xl border bg-card shadow-sm overflow-hidden">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-6 py-4 border-b last:border-0">
            <Skeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-3 w-32" />
            </div>
            <Skeleton className="h-6 w-16" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function ParentsPage() {
  return (
    <Suspense fallback={<ParentsSkeleton />}>
      <ParentsContent />
    </Suspense>
  );
}
