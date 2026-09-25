import { getParentDashboardData } from "./actions";
import { ParentPortalClient } from "./portal-client";
import { ParentRealtimeRefresher } from "./realtime-refresher";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Mon Portail — Paylix",
  description: "Consultez la situation scolaire de vos enfants.",
};

interface PageProps {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function ParentPortalPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const data = await getParentDashboardData(tenant);

  if (!data) {
    redirect("/login");
  }

  return (
    <>
      <ParentRealtimeRefresher tenantId={data.tenant.id} />
      <ParentPortalClient data={data} activeTenantId={data.tenant.id} />
    </>
  );
}
