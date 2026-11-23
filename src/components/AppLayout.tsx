import { Outlet, Navigate, useLocation, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";

export function AppLayout() {
  const { user, role, roleStatus, loading, signOut, isColaborador, isAuditor } = useAuth();
  const location = useLocation();

  // Decide a página de entrada do colaborador: quem tem plano de sucessão
  // disponibilizado abre nele. Mesma chave de cache da AppSidebar, então é uma
  // consulta só. O dado em si é protegido pela função do banco.
  const { data: meusPublicados, isLoading: carregandoPublicados } = useQuery({
    queryKey: ["rh_sucessao_meus_publicados_menu"],
    enabled: !!user && isColaborador && roleStatus === "ativo",
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_sucessao_meus_planos_publicados" as any);
      if (error) return [];
      return (data ?? []) as any[];
    },
  });
  const temPlanoPublicado = (meusPublicados?.length ?? 0) > 0;

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Pode (re)solicitar acesso: quem não tem papel OU colaborador recusado/desativado.
  const podeResolicitar = !role || (isColaborador && roleStatus === "rejeitado");
  if (podeResolicitar && location.pathname === "/primeiro-acesso") return <Outlet />;

  // Usuário logado sem nenhum papel cadastrado → oferece conclusão do primeiro acesso.
  if (!role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950/40 p-3">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-xl">Acesso não liberado</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{user.email}</span> ainda não concluiu o primeiro acesso. Selecione seu nome para solicitar a liberação do RH.
            </p>
            <Button asChild className="w-full">
              <Link to="/primeiro-acesso">Concluir primeiro acesso</Link>
            </Button>
            <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }


  // Colaborador pendente → tela de espera
  if (isColaborador && roleStatus === "pendente") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center space-y-2">
            <div className="flex justify-center">
              <div className="rounded-full bg-amber-100 dark:bg-amber-950/40 p-3">
                <ShieldAlert className="h-6 w-6 text-amber-600" />
              </div>
            </div>
            <CardTitle className="text-xl">Aguardando aprovação do RH</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium">{user.email}</span> — seu cadastro foi enviado e aguarda aprovação de um responsável do RH.
            </p>
            <p className="text-xs text-muted-foreground">
              Você será liberado(a) assim que confirmarem o vínculo com seu cadastro de funcionário.
            </p>
            <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Colaborador recusado/desativado → reabre o formulário de solicitação no login.
  if (isColaborador && roleStatus === "rejeitado") {
    return <Navigate to="/primeiro-acesso" replace />;
  }

  // Outros papéis sem status definido (legacy) — bloqueio antigo
  if (!isColaborador && roleStatus && roleStatus !== "ativo") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center"><CardTitle>Acesso pendente de liberação</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Aguardando aprovação de um administrador.</p>
            <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Colaborador ativo → barra lateral reduzida; acessa /meus-kms, os planos
  // de sucessão disponibilizados para ele (/sucessao*, em modo leitura — a rota
  // entrega só o que a função do banco libera) e /auditorias* se for auditor.
  if (isColaborador) {
    const allowed =
      location.pathname === "/meus-kms" ||
      location.pathname === "/sucessao" ||
      location.pathname.startsWith("/sucessao/") ||
      (isAuditor && location.pathname.startsWith("/auditorias")) ||
      (isAuditor && location.pathname.startsWith("/atividades-auditoria"));
    if (!allowed) {
      // Entrada pelo login (cai em "/"): quem tem plano disponibilizado abre
      // direto nele; os demais seguem para Meus KMs, como sempre.
      if (location.pathname === "/") {
        if (carregandoPublicados) {
          return (
            <div className="min-h-screen flex items-center justify-center">
              <p className="text-muted-foreground animate-pulse">Carregando...</p>
            </div>
          );
        }
        if (temPlanoPublicado) return <Navigate to="/sucessao" replace />;
      }
      return <Navigate to="/meus-kms" replace />;
    }
    // Mesma barra lateral do staff, mas a AppSidebar mostra só o que o
    // colaborador acessa. No celular a barra vira gaveta, então a faixa do topo
    // traz o botão que a abre — sem ele não haveria menu nem "Sair".
    return (
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="md:hidden flex items-center gap-2 border-b bg-card px-3 py-2">
              <SidebarTrigger />
              <img src="/logo-icon.png" alt="Young" className="h-6 w-6 rounded" />
              <p className="text-sm font-bold">Pilares</p>
            </header>
            <main className="flex-1 p-4 sm:p-6 overflow-auto">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    );
  }

  // Staff
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
