"use client";

import { useEffect, useState } from "react";
import { Bell, Menu, Search, User as UserIcon, LogOut, Settings, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuGroup,
  DropdownMenuItem, 
  DropdownMenuLabel, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { logout } from "@/app/login/actions";
import { NotificationBell } from "@/components/notifications/notification-bell";
import { MessageBell } from "@/components/notifications/message-bell";
import Image from "next/image";
import { OfflineIndicator } from "@/components/pwa/offline-indicator";
import { getUserInitials } from "@/lib/user-profile";

interface HeaderProps {
  title: string;
  role?: "platform_admin" | "director" | "accountant" | "parent";
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  profile: { firstName: string, lastName: string, avatarUrl: string | null } | null;
  /** Extra actions rendered in the header (e.g. tenant-switcher). Visible on all screen sizes. */
  actions?: React.ReactNode;
}

export function Header({ title, role = "director", collapsed = false, onToggleCollapse, profile, actions }: HeaderProps) {


  const initials = getUserInitials(profile);

  return (
    <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border/60 bg-card px-4 md:px-6 shadow-[0_1px_2px_rgba(0,0,0,0.02)] relative z-10">
      <Sheet>
        <SheetTrigger
          render={
            <Button variant="ghost" size="icon" className="md:hidden">
              <Menu className="h-5 w-5" />
              <span className="sr-only">Toggle navigation menu</span>
            </Button>
          }
        />
        <SheetContent side="left" className="p-0 w-72">
          <Sidebar role={role} className="border-none w-full" />
        </SheetContent>
      </Sheet>

      {onToggleCollapse && (
        <Button
          variant="ghost"
          size="icon"
          className="hidden md:inline-flex shrink-0 rounded-full"
          onClick={onToggleCollapse}
          aria-label={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
          title={collapsed ? "Ouvrir la barre latérale" : "Réduire la barre latérale"}
        >
          {collapsed ? <PanelLeftOpen className="h-5 w-5" /> : <PanelLeftClose className="h-5 w-5" />}
        </Button>
      )}

      <h1 className="text-lg font-semibold md:text-xl hidden md:block text-foreground tracking-tight">{title}</h1>

      <div className="flex flex-1 items-center justify-end gap-4 md:gap-2 lg:gap-4">
        <form className="hidden md:flex ml-auto flex-1 sm:flex-initial">
          <div className="relative group">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <Input
              type="search"
              placeholder="Rechercher..."
              className="pl-8 sm:w-[300px] md:w-[200px] lg:w-[300px] bg-muted/50 border-none focus-visible:ring-1"
            />
          </div>
        </form>
        <OfflineIndicator />
        {actions}
        <MessageBell role={role} />
        <NotificationBell />

        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <Button variant="ghost" className="relative h-9 w-9 rounded-full overflow-hidden p-0 border border-primary/20">
                {profile?.avatarUrl ? (
                  <Image src={profile.avatarUrl} alt="Avatar" fill className="object-cover" unoptimized />
                ) : (
                  <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full">
                    <circle cx="50" cy="50" r="50" fill="url(#hgrad)" />
                    <circle cx="50" cy="38" r="16" fill="white" fillOpacity="0.9" />
                    <ellipse cx="50" cy="78" rx="24" ry="18" fill="white" fillOpacity="0.9" />
                    <defs>
                      <linearGradient id="hgrad" x1="0" y1="0" x2="100" y2="100" gradientUnits="userSpaceOnUse">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#065f46" />
                      </linearGradient>
                    </defs>
                    <text x="50" y="44" textAnchor="middle" dominantBaseline="middle" fontSize="14" fontWeight="700" fontFamily="system-ui, sans-serif" fill="#065f46">
                      {initials}
                    </text>
                  </svg>
                )}
              </Button>
            }
          />
          <DropdownMenuContent className="w-56" align="end">
            <DropdownMenuGroup>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">
                    {profile ? `${profile.firstName} ${profile.lastName}` : "Utilisateur"}
                  </p>
                  <p className="text-xs leading-none text-muted-foreground capitalize">
                    {role.replace('_', ' ')}
                  </p>
                </div>
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => window.location.href = "/account"} className="cursor-pointer">
              <UserIcon className="mr-2 h-4 w-4" />
              <span>Mon Profil</span>
            </DropdownMenuItem>
            
            {role === "platform_admin" && (
              <DropdownMenuItem onClick={() => window.location.href = "/platform/settings"} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
            )}

            {role === "director" && (
              <DropdownMenuItem onClick={() => window.location.href = "/school/settings"} className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" />
                <span>Paramètres</span>
              </DropdownMenuItem>
            )}

            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive cursor-pointer"
              onClick={() => logout()}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Déconnexion</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
