import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays } from "lucide-react";

export default function Reembolsos() {
  const { data: reembolsos = [], isLoading } = useQuery({
    queryKey: ["rh_folha_reembolsos_meses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_folha_reembolsos")
        .select("valor, rh_folha_mensal!inner(mes_referencia)");
      if (error) throw error;
      return data || [];
    },
  });

  const meses = useMemo(() => {
    const map: Record<string, { total: number; qtd: number }> = {};
    for (const d of reembolsos as any[]) {
      const mes = d.rh_folha_mensal?.mes_referencia?.slice(0, 7);
      if (!mes) continue;
      if (!map[mes]) map[mes] = { total: 0, qtd: 0 };
      map[mes].total += Number(d.valor || 0);
      map[mes].qtd += 1;
    }
    return Object.entries(map)
      .map(([mes, v]) => ({ mes, ...v }))
      .sort((a, b) => b.mes.localeCompare(a.mes));
  }, [reembolsos]);

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatMes = (mes: string) => {
    const [y, m] = mes.split("-");
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[parseInt(m) - 1]} / ${y}`;
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reembolsos</h1>
        <p className="text-sm text-muted-foreground">
          Visualize por mês os reembolsos lançados nas folhas mensais.
        </p>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : meses.length === 0 ? (
        <Card><CardContent className="p-6 text-center text-muted-foreground">
          Nenhum reembolso lançado ainda.
        </CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {meses.map((m) => (
            <Link key={m.mes} to={`/reembolsos/${m.mes}`}>
              <Card className="hover:border-primary transition-colors cursor-pointer h-full">
                <CardContent className="p-5 space-y-2">
                  <div className="flex items-center gap-2">
                    <CalendarDays className="h-5 w-5 text-primary" />
                    <h2 className="font-semibold">{formatMes(m.mes)}</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {m.qtd} lançamento{m.qtd !== 1 ? "s" : ""}
                  </p>
                  <p className="text-sm font-medium tabular-nums">
                    Total: {fmt(m.total)}
                  </p>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
