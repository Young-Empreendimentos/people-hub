import {
  ClipboardCheck, Receipt, ListChecks, Settings, Home, LogOut, GraduationCap, ShieldAlert, LayoutGrid, Wallet, Car, ClipboardList, FileCheck2,
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
  { title: "Estrutura", url: "/estrutura", icon: LayoutGrid },
  { title: "Financeiro", url: "/financeiro", icon: Wallet },
  { title: "Treinamentos", url: "/treinamentos", icon: GraduationCap },
  { title: "Avaliações", url: "/avaliacoes", icon: ClipboardCheck },
  { title: "Gestão de Pessoas", url: "/gestao-pessoas", icon: ShieldAlert },
  { title: "Folha Mensal", url: "/folha", icon: Receipt },
  { title: "Meus KMs", url: "/meus-kms", icon: Car },

  { title: "Atividades", url: "/atividades", icon: ListChecks },
];

const auditoriasItem = { title: "Auditorias", url: "/auditorias", icon: FileCheck2 };

const configItem = { title: "Configurações", url: "/configuracoes", icon: Settings };

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { canConfig, signOut, user, userName, isAuditor } = useAuth();

  const isActive = (path: string) =>
    path === "/" ? location.pathname === "/" : location.pathname.startsWith(path);

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <div className={`flex items-center gap-2 px-3 py-4 ${collapsed ? "justify-center" : ""}`}>
          <img src="/logo-icon.png" alt="Young" className={`${collapsed ? "h-8" : "h-9"} w-auto object-contain rounded shrink-0`} />
          {!collapsed && (
            <div className="leading-tight">
              <p className="text-sm font-bold tracking-tight text-sidebar-foreground">Pilares</p>
              <p className="text-[10px] text-sidebar-foreground/60">Gestão de RH</p>
            </div>
          )}
        </div>
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
              {(canConfig || isAuditor) && (
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive(auditoriasItem.url)}>
                    <NavLink to={auditoriasItem.url} className="hover:bg-sidebar-accent/50" activeClassName="bg-sidebar-accent text-sidebar-primary font-medium">
                      <auditoriasItem.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{auditoriasItem.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}
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
            {userName || user.email}
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
