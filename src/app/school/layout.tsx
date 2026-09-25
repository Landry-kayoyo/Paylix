import { PageContainer } from "@/components/layout/page-container";
import { getMyProfile } from "@/app/actions/account";
import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/sidebar-state";

export default async function SchoolLayout({ children }: { children: React.ReactNode }) {
  const profile = await getMyProfile().catch(() => null);
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_STORAGE_KEY)?.value === "true";

  return (
    <PageContainer 
      role="director" 
      title="Vue d'ensemble de l'établissement"
      profile={profile}
      initialCollapsed={initialCollapsed}
    >
      {children}
    </PageContainer>
  );
}
