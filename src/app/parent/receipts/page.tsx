import { getParentDashboardData } from "../actions";
import { redirect } from "next/navigation";
import ParentReceiptsClient from "./receipts-client";

interface PageProps {
  searchParams: Promise<{ tenant?: string }>;
}

export default async function ParentReceiptsPage({ searchParams }: PageProps) {
  const { tenant } = await searchParams;
  const data = await getParentDashboardData(tenant);

  if (!data) redirect("/login");

  return <ParentReceiptsClient data={data} />;
}
