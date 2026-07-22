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

const modules = [
  { title: "Tableau de bord", url: "/", icon: LayoutDashboard },
  { title: "Demandes d'intervention", url: "/demandes", icon: ClipboardList },
  { title: "Interventions", url: "/interventions", icon: Wrench },
  { title: "Équipements", url: "/equipements", icon: Cog },
  { title: "Stocks", url: "/stocks", icon: Boxes },
  { title: "Préventif", url: "/preventif", icon: CalendarClock },
  { title: "Techniciens", url: "/techniciens", icon: Users },
  { title: "Rapports", url: "/rapports", icon: FileBarChart },
  { title: "Paramétrage", url: "/parametrage", icon: Settings },
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
                const isActive =
                  item.url === "/"
                    ? currentPath === "/"
                    : currentPath.startsWith(item.url);
                return (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton
                      asChild
                      isActive={isActive}
                      tooltip={item.title}
                    >
                      <Link to={item.url as never} disabled>
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
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
