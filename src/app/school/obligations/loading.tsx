import { Skeleton } from "@/components/ui/skeleton";

export default function Loading() {
  return <div className="flex-1 space-y-6 p-4 sm:p-6 lg:p-8"><Skeleton className="h-16 w-2/3" /><div className="grid gap-4 sm:grid-cols-3"><Skeleton className="h-24" /><Skeleton className="h-24" /><Skeleton className="h-24" /></div><Skeleton className="h-[28rem] w-full" /></div>;
}
