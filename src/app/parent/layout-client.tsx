"use client";

import { usePathname } from "next/navigation";
import { PageContainer } from "@/components/layout/page-container";
import { HeaderActionsProvider, useHeaderActions } from "./header-actions-context";

interface ParentLayoutClientProps {
  children: React.ReactNode;
  profile: any;
  initialCollapsed: boolean;
}

function ParentLayoutInner({ children, profile, initialCollapsed }: ParentLayoutClientProps) {
  const pathname = usePathname();
  const { actions } = useHeaderActions();

  if (pathname.startsWith("/parent/join")) {
    return <>{children}</>;
  }

  return (
    <PageContainer
      role="parent"
      title="Mon Portail Parent"
      profile={profile}
      initialCollapsed={initialCollapsed}
      actions={actions}
    >
      {children}
    </PageContainer>
  );
}

export function ParentLayoutClient({ children, profile, initialCollapsed }: ParentLayoutClientProps) {
  return (
    <HeaderActionsProvider>
      <ParentLayoutInner profile={profile} initialCollapsed={initialCollapsed}>
        {children}
      </ParentLayoutInner>
    </HeaderActionsProvider>
  );
}
