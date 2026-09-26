import type { LucideIcon } from "lucide-react";
import { 
  Building2, 
  Calendar,
  CreditCard, 
  Home, 
  LayoutDashboard, 
  MessageCircle,
  PieChart, 
  Settings, 
  Users, 
  Wallet,
  GraduationCap,
  UsersRound,
  Presentation,
  UserCog,
  Banknote,
  ClipboardList,
  ReceiptText,
  BarChart3,
  CircleUser,
  AlertTriangle
} from "lucide-react";

type AppRole = 'platform_admin' | 'director' | 'accountant' | 'parent';

export interface NavItem {
  title: string;
  href: string;
  icon: LucideIcon;
  roles?: AppRole[];
  items?: NavItem[]; // for nested navigation if needed
}

export interface NavGroup {
  title: string;
  items: NavItem[];
}

export const navigationConfig: NavGroup[] = [
  {
    title: "Général",
    items: [
      {
        title: "Plateforme",
        href: "/platform",
        icon: LayoutDashboard,
        roles: ["platform_admin"],
      },
      {
        title: "Vue d'ensemble",
        href: "/school",
        icon: LayoutDashboard,
        roles: ["director"],
      },
      {
        title: "Tableau de bord",
        href: "/accountant",
        icon: LayoutDashboard,
        roles: ["accountant"],
      },
      {
        title: "Mon Portail",
        href: "/parent",
        icon: Home,
        roles: ["parent"],
      },
      {
        title: "Historique",
        href: "/parent/history",
        icon: ReceiptText,
        roles: ["parent"],
      },
      {
        title: "Messages",
        href: "/parent/messages",
        icon: MessageCircle,
        roles: ["parent"],
      },
    ]
  },
  {
    title: "Établissement",
    items: [
      {
        title: "Écoles",
        href: "/platform/schools",
        icon: Building2,
        roles: ["platform_admin"],
      },
      {
        title: "Messages",
        href: "/platform/messages",
        icon: MessageCircle,
        roles: ["platform_admin"],
      },
      {
        title: "Élèves",
        href: "/school/students",
        icon: GraduationCap,
        roles: ["director"],
      },
      {
        title: "Parents / Tuteurs",
        href: "/school/parents",
        icon: UsersRound,
        roles: ["director"],
      },
      {
        title: "Classes",
        href: "/school/classes",
        icon: Presentation,
        roles: ["director"],
      },
      {
        title: "Années scolaires",
        href: "/school/years",
        icon: Calendar,
        roles: ["director"],
      },
      {
        title: "Réinscription",
        href: "/school/students/reenrollment",
        icon: GraduationCap,
        roles: ["director"],
      },
      {
        title: "Utilisateurs / Équipe",
        href: "/school/users",
        icon: UserCog,
        roles: ["director"],
      },
      {
        title: "Messages",
        href: "/school/messages",
        icon: MessageCircle,
        roles: ["director"],
      },
    ]
  },
  {
    title: "Finances",
    items: [
      {
        title: "Paiements",
        href: "/school/payments",
        icon: CreditCard,
        roles: ["director"],
      },
      {
        title: "Paiements",
        href: "/accountant/payments",
        icon: CreditCard,
        roles: ["accountant"],
      },
      {
        title: "Frais scolaires",
        href: "/school/fees",
        icon: Banknote,
        roles: ["director"],
      },
      {
        title: "Reçus",
        href: "/school/receipts",
        icon: ReceiptText,
        roles: ["director"],
      },
      {
        title: "Reçus",
        href: "/accountant/receipts",
        icon: ReceiptText,
        roles: ["accountant"],
      },
      {
        title: "Dettes Antérieures",
        href: "/school/debts",
        icon: AlertTriangle,
        roles: ["director"],
      },
      {
        title: "Dettes Antérieures",
        href: "/accountant/debts",
        icon: AlertTriangle,
        roles: ["accountant"],
      },
    ]
  },
  {
    title: "Analyses",
    items: [
      {
        title: "Rapports Financiers",
        href: "/school/reports",
        icon: BarChart3,
        roles: ["director"],
      },
      {
        title: "Rapports Financiers",
        href: "/accountant/reports",
        icon: BarChart3,
        roles: ["accountant"],
      },
      {
        title: "Statistiques Globales",
        href: "/platform/stats",
        icon: PieChart,
        roles: ["platform_admin"],
      },
    ]
  },

  {
    title: "Compte",
    items: [
      {
        title: "Mon Compte",
        href: "/account",
        icon: CircleUser,
        roles: ["platform_admin", "director", "accountant", "parent"]
      },
      {
        title: "Paramètres Plateforme",
        href: "/platform/settings",
        icon: Settings,
        roles: ["platform_admin"]
      },
      {
        title: "Paramètres Établissement",
        href: "/school/settings",
        icon: Settings,
        roles: ["director"]
      }
    ]
  },
];

export function getNavigationForRole(role: AppRole): NavGroup[] {
  return navigationConfig.map(group => {
    const filteredItems = group.items.filter(item => {
      // If roles are not specified, it's public (but in our case, we always specify roles)
      return !item.roles || item.roles.includes(role);
    });
    
    return {
      ...group,
      items: filteredItems,
    };
  }).filter(group => group.items.length > 0);
}
