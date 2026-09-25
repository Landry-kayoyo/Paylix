import { getPlatformStats } from "../actions";
import { PageContainer } from "@/components/layout/page-container";
import { PlatformStatsClient } from "./stats-client";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Statistiques Globales | Paylix",
  description: "Statistiques et analyses globales de la plateforme SaaS.",
};

export default async function PlatformStatsPage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const { period = "30d" } = await searchParams;
  const stats = await getPlatformStats(period);

  return (
    <PlatformStatsClient initialStats={stats} period={period} />
  );
}
