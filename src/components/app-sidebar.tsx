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
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

type ModuleItem = {
  title: string;
  icon: typeof LayoutDashboard;
  url?: "/";
};

const modules: ModuleItem[] = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Demandes d'intervention", icon: ClipboardList },
  { title: "Interventions", icon: Wrench },
  { title: "Équipements", icon: Cog },
  { title: "Stocks", icon: Boxes },
  { title: "Préventif", icon: CalendarClock },
  { title: "Techniciens", icon: Users },
  { title: "Rapports", icon: FileBarChart },
  { title: "Paramétrage", icon: Settings },
];

export function AppSidebar() {
  const currentPath = useRouterState({
    select: (r) => r.location.pathname,
  });

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground font-bold">
            G
          </div>
          <div className="flex flex-col leading-tight group-data-[collapsible=icon]:hidden">
            <span className="text-sm font-semibold">GMAO</span>
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
              {modules.map((item) => {
                const isActive = item.url ? currentPath === item.url : false;
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
    </Sidebar>
  );
}
