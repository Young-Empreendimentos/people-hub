import {
  Users, Building2, Briefcase, UserPlus, FileText,
  DollarSign, ClipboardCheck, Receipt, ListChecks, Settings, Home, LogOut, Factory
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const mainItems = [
  { title: "Início", url: "/", icon: Home },
  { title: "Funcionários", url: "/funcionarios", icon: Users },
  { title: "Equipes", url: "/equipes", icon: Building2 },
  { title: "Empresas", url: "/empresas", icon: Factory },
  { title: "Cargos", url: "/cargos", icon: Briefcase },
  { title: "Admissões e Deslig.", url: "/admissoes", icon: UserPlus },
  { title: "Aditivos", url: "/aditivos", icon: FileText },
  { title: "Adiantamentos", url: "/adiantamentos", icon: DollarSign },
  { title: "Avaliações", url: "/avaliacoes", icon: ClipboardCheck },
  { title: "Folha Mensal", url: "/folha", icon: Receipt },
  { title: "Atividades", url: "/atividades", icon: ListChecks },
];

const configItem = { title: "Configurações", url: "/configuracoes", icon: Settings };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { canConfig, signOut, user } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {mainItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild isActive={isActive(item.url)}>
                    <NavLink to={item.url} end={item.url === "/"} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
              {canConfig && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(configItem.url)}>
                    <NavLink to={configItem.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <configItem.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{configItem.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        {!collapsed && user && (
          <p className="text-xs text-sidebar-foreground/60 truncate px-2 mb-1">
            {user.email}
          </p>
        )}
        <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start text-sidebar-foreground/70 hover:text-sidebar-foreground">
          <LogOut className="mr-2 h-4 w-4" />
          {!collapsed && "Sair"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
