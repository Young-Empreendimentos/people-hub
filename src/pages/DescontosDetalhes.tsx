import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft } from "lucide-react";

export const TIPOS_DESCONTO = [
  "Plano de Saúde",
  "Parque da Guarda",
  "Danos Patrimoniais",
  "Horas Falta",
  "Reembolso de Aluguel",
  "Gastos no Cartão Corporativo",
  "Gastos no Cartão Corporativo",
  "Outros",
];

export default function DescontosDetalhes() {
  const { mes } = useParams<{ mes: string }>();
  const [filterFunc, setFilterFunc] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const { data: descontos = [], isLoading } = useQuery({
    queryKey: ["rh_folha_descontos_detalhes", mes],
    enabled: !!mes,
    queryFn: async () => {
      const [y, m] = mes!.split("-").map(Number);
      const ini = `${mes}-01`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const fim = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("rh_folha_descontos")
        .select("id, tipo, valor, observacao, rh_folha_mensal!inner(mes_referencia, funcionario_id, rh_funcionarios(nome_completo, empresa_id))")
        .gte("rh_folha_mensal.mes_referencia", ini)
        .lt("rh_folha_mensal.mes_referencia", fim);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios_desc"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo");
      return data || [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["rh_empresas_desc"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_empresas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return (descontos as any[]).filter((d) => {
      const funcId = d.rh_folha_mensal?.funcionario_id;
      const empresaId = d.rh_folha_mensal?.rh_funcionarios?.empresa_id;
      if (filterFunc && funcId !== filterFunc) return false;
      if (filterEmpresa && empresaId !== filterEmpresa) return false;
      if (filterTipo && d.tipo !== filterTipo) return false;
      return true;
    });
  }, [descontos, filterFunc, filterEmpresa, filterTipo]);

  const total = useMemo(
    () => filtered.reduce((s, d: any) => s + Number(d.valor || 0), 0),
    [filtered]
  );

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const formatMes = (m: string) => {
    const [y, mm] = m.split("-");
    const nomes = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
    return `${nomes[parseInt(mm) - 1]} / ${y}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/descontos"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Detalhes — {mes && formatMes(mes)}</h1>
          <p className="text-sm text-muted-foreground">Apenas visualização.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Combobox
          options={empresas.map((e: any) => ({ value: e.id, label: e.nome }))}
          value={filterEmpresa}
          onValueChange={setFilterEmpresa}
          placeholder="Filtrar por empresa"
        />
        <Combobox
          options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))}
          value={filterFunc}
          onValueChange={setFilterFunc}
          placeholder="Filtrar por funcionário"
        />
        <Combobox
          options={TIPOS_DESCONTO.map((t) => ({ value: t, label: t }))}
          value={filterTipo}
          onValueChange={setFilterTipo}
          placeholder="Filtrar por tipo"
        />
      </div>

      {(filterFunc || filterEmpresa || filterTipo) && (
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => { setFilterFunc(""); setFilterEmpresa(""); setFilterTipo(""); }}>
            Limpar filtros
          </Button>
        </div>
      )}

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Funcionário</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Observação</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={4} className="text-center py-8 text-muted-foreground">Nenhum desconto.</TableCell></TableRow>
            ) : filtered.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.rh_folha_mensal?.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{d.tipo}</TableCell>
                <TableCell className="text-muted-foreground text-sm">{d.observacao || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(d.valor))}</TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow>
                <TableCell colSpan={3} className="font-semibold text-right">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
