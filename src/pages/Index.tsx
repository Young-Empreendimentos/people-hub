import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Briefcase, ClipboardCheck, UserCheck } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function Index() {
  const { user, role, canConfig } = useAuth();
  const queryClient = useQueryClient();

  const { data: counts } = useQuery({
    queryKey: ["rh_dashboard_counts"],
    queryFn: async () => {
      const [funcRes, equipesRes, cargosRes, avalRes] = await Promise.all([
        supabase.from("rh_funcionarios").select("id", { count: "exact", head: true }),
        supabase.from("rh_equipes").select("id", { count: "exact", head: true }),
        supabase.from("rh_cargos").select("id", { count: "exact", head: true }),
        supabase.from("rh_avaliacoes").select("id", { count: "exact", head: true }),
      ]);
      return {
        funcionarios: funcRes.count ?? 0,
        equipes: equipesRes.count ?? 0,
        cargos: cargosRes.count ?? 0,
        avaliacoes: avalRes.count ?? 0,
      };
    },
  });

  // Colaboradores aguardando aprovação — visível só para quem gerencia acessos.
  const { data: pendentes = [] } = useQuery({
    queryKey: ["rh_pendentes_home"],
    enabled: canConfig,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_get_all_users_with_roles");
      if (error) throw error;
      return (data as any[]).filter((u) => u.role === "colaborador" && u.status === "pendente");
    },
  });

  const aprovar = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await supabase.from("rh_user_roles").update({ status: "ativo" } as any).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_pendentes_home"] });
      queryClient.invalidateQueries({ queryKey: ["rh_users_with_roles"] });
      toast.success("Acesso aprovado.");
    },
    onError: () => toast.error("Erro ao aprovar."),
  });

  const recusar = useMutation({
    mutationFn: async (userId: string) => {
      // Recusa e limpa o funcionário escolhido (libera o vínculo para nova solicitação).
      const { error } = await supabase.from("rh_user_roles")
        .update({ status: "rejeitado", funcionario_id: null } as any)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_pendentes_home"] });
      queryClient.invalidateQueries({ queryKey: ["rh_users_with_roles"] });
      toast.success("Acesso recusado.");
    },
    onError: () => toast.error("Erro ao recusar."),
  });

  const cards = [
    { title: "Funcionários", icon: Users, value: counts?.funcionarios ?? "—", desc: "Total de colaboradores" },
    { title: "Equipes", icon: Building2, value: counts?.equipes ?? "—", desc: "Equipes cadastradas" },
    { title: "Cargos", icon: Briefcase, value: counts?.cargos ?? "—", desc: "Trilhas de carreira" },
    { title: "Avaliações", icon: ClipboardCheck, value: counts?.avaliacoes ?? "—", desc: "Avaliações registradas" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{c.title}</CardTitle>
              <c.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{c.value}</div>
              <p className="text-xs text-muted-foreground">{c.desc}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {canConfig && pendentes.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader className="flex flex-row items-center justify-between space-y-0">
            <CardTitle className="text-base flex items-center gap-2">
              <UserCheck className="h-4 w-4 text-amber-600" />
              {pendentes.length} acesso(s) aguardando aprovação
            </CardTitle>
            <Button asChild variant="outline" size="sm">
              <Link to="/configuracoes">Ver todos</Link>
            </Button>
          </CardHeader>
          <CardContent className="space-y-2">
            {(pendentes as any[]).slice(0, 5).map((u) => (
              <div key={u.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground truncate">
                    {u.funcionario_nome || "não vinculado"}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button size="sm" onClick={() => aprovar.mutate(u.id)} disabled={aprovar.isPending}>
                    Aprovar
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-destructive"
                    onClick={() => recusar.mutate(u.id)}
                    disabled={recusar.isPending}
                  >
                    Recusar
                  </Button>
                </div>
              </div>
            ))}
            {pendentes.length > 5 && (
              <p className="text-xs text-muted-foreground">
                e mais {pendentes.length - 5}… veja em Configurações.
              </p>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            <strong>Usuário:</strong> {user?.email} &nbsp;|&nbsp;
            <strong>Nível:</strong> {role ?? "sem função atribuída"}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
