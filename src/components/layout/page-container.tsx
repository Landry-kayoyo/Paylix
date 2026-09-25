"use client";

import { useEffect, useState } from "react";
import { Sidebar } from "@/components/layout/sidebar";
import { Header } from "@/components/layout/header";
import { setSidebarCollapsePreference } from "@/lib/sidebar-state";

interface PageContainerProps {
  children: React.ReactNode;
  role: "platform_admin" | "director" | "accountant" | "parent";
  title: string;
  profile: { firstName: string, lastName: string, avatarUrl: string | null } | null;
  initialCollapsed?: boolean;
  /** Extra buttons/components to render inside the header (e.g. tenant-switcher). */
  actions?: React.ReactNode;
}

export function PageContainer({ children, role, title, profile, initialCollapsed = false, actions }: PageContainerProps) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);

  useEffect(() => {
    setSidebarCollapsePreference(collapsed);
  }, [collapsed]);

  const toggleSidebar = () => setCollapsed((current) => !current);

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <Sidebar
        className="hidden md:flex"
        role={role}
        collapsed={collapsed}
      />
      <div className="flex flex-col flex-1 w-full overflow-hidden">
        <Header
          title={title}
          role={role}
          collapsed={collapsed}
          onToggleCollapse={toggleSidebar}
          profile={profile}
          actions={actions}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
