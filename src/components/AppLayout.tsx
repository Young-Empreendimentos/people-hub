import { Outlet, Navigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";

export function AppLayout() {
  const { user, role, loading, signOut } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground animate-pulse">Carregando...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // Usuário autenticado mas SEM perfil/role liberado: bloqueia todo o sistema.
  // Acessos só são liberados manualmente por um administrador em Configurações > Usuários.
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
            <CardTitle className="text-xl">Acesso pendente de liberação</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-center">
            <p className="text-sm text-muted-foreground">
              Seu cadastro foi recebido com sucesso, <span className="font-medium">{user.email}</span>.
            </p>
            <p className="text-sm text-muted-foreground">
              Por se tratar de um sistema de Recursos Humanos com informações confidenciais,
              o acesso só é liberado após aprovação de um administrador.
            </p>
            <p className="text-xs text-muted-foreground">
              Avise o RH para liberar seu perfil. Você será notificado quando o acesso estiver disponível.
            </p>
            <Button variant="outline" className="w-full" onClick={signOut}>
              Sair
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
