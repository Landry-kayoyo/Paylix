import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"><div className="space-y-2"><Skeleton className="h-4 w-32" /><Skeleton className="h-9 w-64" /><Skeleton className="h-4 w-80" /></div><Skeleton className="h-14 w-full" /><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-96 w-full" /></div>;
}
