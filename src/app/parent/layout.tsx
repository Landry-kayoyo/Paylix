import { getMyProfile } from "@/app/actions/account";
import { cookies } from "next/headers";
import { SIDEBAR_COLLAPSED_STORAGE_KEY } from "@/lib/sidebar-state";
import { ParentLayoutClient } from "./layout-client";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  const profile = await getMyProfile().catch(() => null);
  const cookieStore = await cookies();
  const initialCollapsed = cookieStore.get(SIDEBAR_COLLAPSED_STORAGE_KEY)?.value === "true";

  return (
    <ParentLayoutClient profile={profile} initialCollapsed={initialCollapsed}>
      {children}
    </ParentLayoutClient>
  );
}
