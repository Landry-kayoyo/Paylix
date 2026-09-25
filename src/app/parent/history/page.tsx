import { getParentPaymentHistory } from "./actions";
import { ParentHistoryClient } from "./history-client";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Historique des paiements — Paylix",
  description: "Consultez l'historique complet des paiements de vos enfants.",
};

interface PageProps {
  searchParams: Promise<{
    tenant?: string;
    student?: string;
    year?: string;
    currency?: string;
    page?: string;
  }>;
}

export default async function ParentHistoryPage({ searchParams }: PageProps) {
  const params = await searchParams;

  const page = Math.max(1, parseInt(params.page || "1", 10));

  const result = await getParentPaymentHistory({
    tenantId: params.tenant,
    studentId: params.student || "all",
    schoolYearId: params.year || "all",
    currency: params.currency || "all",
    page,
    limit: 20,
  });

  if (!result) {
    redirect("/login");
  }

  return (
    <ParentHistoryClient
      result={result}
      filters={{
        tenantId: params.tenant,
        studentId: params.student || "all",
        schoolYearId: params.year || "all",
        currency: params.currency || "all",
        page,
      }}
    />
  );
}
