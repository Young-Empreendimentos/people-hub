import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, Building2, Briefcase, ClipboardCheck } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export default function Index() {
  const { user, role } = useAuth();

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

  const cards = [
    { title: "Funcionários", icon: Users, value: counts?.funcionarios ?? "—", desc: "Total de colaboradores" },
    { title: "Equipes", icon: Building2, value: counts?.equipes ?? "—", desc: "Equipes cadastradas" },
    { title: "Cargos", icon: Briefcase, value: counts?.cargos ?? "—", desc: "Trilhas de carreira" },
    { title: "Avaliações", icon: ClipboardCheck, value: counts?.avaliacoes ?? "—", desc: "Avaliações registradas" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Pilares</h1>
        <p className="text-muted-foreground mt-1">
          Bem-vindo ao sistema de gestão de recursos humanos.
        </p>
      </div>

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
