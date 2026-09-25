import { getPriorDebts } from "./actions";
import { DebtsClient } from "./debts-client";

export const metadata = {
  title: "Dettes Antérieures — Paylix",
  description: "Consultation des dettes antérieures",
};

export default async function PriorDebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const { debts, total, archivedYears } = await getPriorDebts(page, 25, {
    yearId: params.year,
    currency: params.currency,
    status: params.status,
    search: params.search,
  });

  return (
    <DebtsClient
      initialDebts={debts}
      initialTotal={total}
      archivedYears={archivedYears}
    />
  );
}
