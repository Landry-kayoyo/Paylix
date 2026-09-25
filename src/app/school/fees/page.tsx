import { getFeesData } from "./actions";
import { FeeWorkspace } from "./fee-workspace";

export default async function FeesPage() {
  const data = await getFeesData();
  return (
    <div className="flex-1 p-4 sm:p-6 lg:p-8"><FeeWorkspace data={data} /></div>
  );
}
