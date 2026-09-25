import { getTenantDetail } from "../../actions";
import { TenantDetailClient } from "./tenant-detail-client";
import { notFound } from "next/navigation";

export default async function TenantDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  try {
    const data = await getTenantDetail(id);
    return <TenantDetailClient data={data} />;
  } catch {
    notFound();
  }
}
