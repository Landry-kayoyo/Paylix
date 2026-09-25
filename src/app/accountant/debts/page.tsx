import { getPriorDebtsForAccountant } from "./actions";
import { AccountantDebtsClient } from "./debts-client";

export const metadata = {
  title: "Dettes Antérieures — Paylix",
  description: "Consultation des dettes antérieures",
};

export default async function AccountantDebtsPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | undefined }>;
}) {
  const params = await searchParams;
  const page = params.page ? parseInt(params.page) : 1;
  const { debts, total, archivedYears } = await getPriorDebtsForAccountant(page, 25, {
    yearId: params.year,
    currency: params.currency,
    status: params.status,
    search: params.search,
  });

  return (
    <AccountantDebtsClient
      initialDebts={debts}
      initialTotal={total}
      archivedYears={archivedYears}
    />
  );
}
