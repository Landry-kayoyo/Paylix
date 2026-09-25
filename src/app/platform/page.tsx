import { getPlatformStats } from "./actions";
import { PlatformClient } from "./platform-client";

export default async function PlatformAdminPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "30d" } = await searchParams;
  
  const stats = await getPlatformStats(period);

  return (
    <PlatformClient 
      initialStats={stats}
      period={period}
    />
  );
}
