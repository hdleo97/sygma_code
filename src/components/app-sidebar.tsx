import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  ClipboardList,
  Wrench,
  Cog,
  Boxes,
  CalendarClock,
  Users,
  FileBarChart,
  Settings,
  LogOut,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useAuth, type AppRole } from "@/lib/auth-context";

type ModuleItem = {
  title: string;
  icon: typeof LayoutDashboard;
  url?: "/" | "/equipements" | "/demandes";
  roles: AppRole[] | "all";
};

const ALL_ROLES: AppRole[] = [
  "super_admin",
  "responsable_maintenance",
  "technicien",
  "demandeur",
  "gestionnaire_stock",
  "prestataire",
  "responsable_etablissement",
];

const modules: ModuleItem[] = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard, roles: "all" },
  {
    title: "Demandes d'intervention",
    icon: ClipboardList,
    roles: ALL_ROLES,
  },
  {
    title: "Interventions",
    icon: Wrench,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "responsable_etablissement",
      "technicien",
      "prestataire",
    ],
  },
  {
    title: "Équipements",
    url: "/equipements",
    icon: Cog,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "responsable_etablissement",
      "technicien",
    ],
  },
  {
    title: "Stocks",
    icon: Boxes,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "gestionnaire_stock",
    ],
  },
  {
    title: "Préventif",
    icon: CalendarClock,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "technicien",
    ],
  },
  {
    title: "Techniciens",
    icon: Users,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "responsable_etablissement",
    ],
  },
  {
    title: "Rapports",
    icon: FileBarChart,
    roles: [
      "super_admin",
      "responsable_maintenance",
      "responsable_etablissement",
    ],
  },
  { title: "Paramétrage", icon: Settings, roles: ["super_admin"] },
];

export function AppSidebar() {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { roles, profil, user, signOut } = useAuth();

  const visible = modules.filter((m) => {
    if (m.roles === "all") return true;
    return m.roles.some((r) => roles.includes(r));
  });

  const displayName =
    [profil?.prenom, profil?.nom].filter(Boolean).join(" ") ||
    user?.email ||
    "Utilisateur";

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            S
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">SYGMA</span>
            <span className="text-xs text-sidebar-foreground/60">
              Maintenance
            </span>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Modules</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {visible.map((item) => {
                const isActive = item.url
                  ? item.url === "/"
                    ? currentPath === "/"
                    : currentPath.startsWith(item.url)
                  : false;
                const Icon = item.icon;

                if (item.url) {
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={isActive}
                        tooltip={item.title}
                      >
                        <Link to={item.url}>
                          <Icon className="h-4 w-4" />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                }

                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      tooltip={`${item.title} (bientôt)`}
                      className="cursor-not-allowed opacity-60"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      <span className="ml-auto text-[10px] uppercase tracking-wide text-sidebar-foreground/50 group-data-[collapsible=icon]:hidden">
                        Bientôt
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border">
        <div className="px-2 py-2 text-xs text-sidebar-foreground/70 group-data-[collapsible=icon]:hidden">
          <div className="truncate font-medium text-sidebar-foreground">
            {displayName}
          </div>
          {roles.length > 0 && (
            <div className="truncate">{roles.join(", ")}</div>
          )}
        </div>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip="Se déconnecter"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              <span>Se déconnecter</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
