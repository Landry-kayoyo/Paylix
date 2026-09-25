"use client";

import { cn } from "@/lib/utils";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { getNavigationForRole } from "@/config/navigation";

interface SidebarProps {
  className?: string;
  role: "platform_admin" | "director" | "accountant" | "parent";
  collapsed?: boolean;
}

export function Sidebar({ className, role, collapsed = false }: SidebarProps) {
  const pathname = usePathname();
  const navGroups = getNavigationForRole(role);

  return (
    <aside
      className={cn(
        "flex h-full flex-col border-r border-border/60 bg-card transition-all duration-200 ease-in-out",
        collapsed ? "w-20" : "w-65",
        className
      )}
    >
      <div className="flex h-16 shrink-0 items-center border-b px-3">
        <div
          className={cn(
            "flex items-center gap-2 font-bold text-xl tracking-tight overflow-hidden transition-all",
            collapsed ? "justify-center w-full" : "justify-start"
          )}
        >
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold">
            P
          </div>
          {!collapsed && <span className="text-foreground">PAYLIX</span>}
        </div>
      </div>

      <div className="flex-1 overflow-auto py-4">
        <nav className="grid gap-8 px-2">
          {navGroups.map((group, index) => (
            <div key={index} className="flex flex-col gap-2">
              {!collapsed && (
                <h4 className="px-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {group.title}
                </h4>
              )}
              <div className="grid gap-1">
                {group.items.map((item, itemIndex) => {
                  const isActive = pathname === item.href || pathname?.startsWith(`${item.href}/`);
                  return (
                    <Link
                      key={itemIndex}
                      href={item.href}
                      className={cn(
                        "relative flex items-center gap-3 rounded-xl text-sm transition-all",
                        collapsed ? "justify-center px-2 py-3" : "px-3 py-2.5",
                        isActive
                          ? "text-primary font-semibold bg-primary/5 before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-1 before:bg-primary before:rounded-r-full"
                          : "text-muted-foreground font-medium hover:bg-muted/50 hover:text-foreground"
                      )}
                      title={collapsed ? item.title : undefined}
                    >
                      <item.icon className="h-5 w-5 shrink-5" />
                      {!collapsed && <span>{item.title}</span>}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      </div>
    </aside>
  );
}
