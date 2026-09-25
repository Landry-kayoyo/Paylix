import { getObligations } from "./actions";
import { ObligationsClient } from "./obligations-client";

export const metadata = { title: "Obligations financières — Paylix", description: "Suivi des obligations financières des élèves" };

export default async function ObligationsPage() {
  const obligations = await getObligations();
  return <div className="flex-1 p-4 sm:p-6 lg:p-8"><ObligationsClient initialObligations={obligations} /></div>;
}
