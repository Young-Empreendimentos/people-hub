import { Outlet, Navigate, useLocation, Link } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert, LogOut } from "lucide-react";

export function AppLayout() {
  const { user, role, roleStatus, loading, signOut, isColaborador } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;

  // Usuário logado sem nenhum papel cadastrado → oferece conclusão do primeiro acesso.
  if (!role) {
    if (location.pathname === "/primeiro-acesso") return <Outlet />;
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

  if (isColaborador && roleStatus === "rejeitado") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center"><CardTitle>Acesso recusado</CardTitle></CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">Procure o RH para mais informações.</p>
            <Button variant="outline" className="w-full" onClick={signOut}>Sair</Button>
          </CardContent>
        </Card>
      </div>
    );
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

  // Colaborador ativo → layout reduzido, sem sidebar; só acessa /meus-kms
  if (isColaborador) {
    if (location.pathname !== "/meus-kms") return <Navigate to="/meus-kms" replace />;
    return (
      <div className="min-h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="container mx-auto flex items-center justify-between py-3 px-4">
            <Link to="/meus-kms" className="flex items-center gap-2">
              <img src="/logo-icon.png" alt="Young" className="h-8 w-8 rounded" />
              <div className="leading-tight">
                <p className="text-sm font-bold">Pilares</p>
                <p className="text-[10px] text-muted-foreground">Reembolso de KM</p>
              </div>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </header>
        <main className="flex-1 container mx-auto p-4 sm:p-6"><Outlet /></main>
      </div>
    );
  }

  // Staff
  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <main className="flex-1 p-6 overflow-auto">
            <SidebarTrigger className="mb-4" />
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
