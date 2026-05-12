import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ArrowLeft, Check } from "lucide-react";

export const TIPOS_REEMBOLSO = [
  "Gratificação",
  "Reembolso de Aluguel",
  "Auxílio Moradia",
  "Outro",
];

export default function ReembolsosDetalhes() {
  const { mes } = useParams<{ mes: string }>();
  const [filterFunc, setFilterFunc] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterTipo, setFilterTipo] = useState("");

  const { data: reembolsos = [], isLoading } = useQuery({
    queryKey: ["rh_folha_reembolsos_detalhes", mes],
    enabled: !!mes,
    queryFn: async () => {
      const [y, m] = mes!.split("-").map(Number);
      const ini = `${mes}-01`;
      const nextY = m === 12 ? y + 1 : y;
      const nextM = m === 12 ? 1 : m + 1;
      const fim = `${nextY}-${String(nextM).padStart(2, "0")}-01`;
      const { data, error } = await supabase
        .from("rh_folha_reembolsos")
        .select("id, tipo, valor, observacao, origem, rh_folha_mensal!inner(mes_referencia, funcionario_id, rh_funcionarios(nome_completo, empresa_id))")
        .gte("rh_folha_mensal.mes_referencia", ini)
        .lt("rh_folha_mensal.mes_referencia", fim);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios_reemb"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo");
      return data || [];
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["rh_empresas_reemb"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_empresas").select("id, nome").order("nome");
      return data || [];
    },
  });

  const filtered = useMemo(() => {
    return (reembolsos as any[]).filter((d) => {
      const funcId = d.rh_folha_mensal?.funcionario_id;
      const empresaId = d.rh_folha_mensal?.rh_funcionarios?.empresa_id;
      if (filterFunc && funcId !== filterFunc) return false;
      if (filterEmpresa && empresaId !== filterEmpresa) return false;
      if (filterTipo && d.tipo !== filterTipo) return false;
      return true;
    });
  }, [reembolsos, filterFunc, filterEmpresa, filterTipo]);

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
        <Link to="/reembolsos"><Button variant="ghost" size="icon"><ArrowLeft className="h-4 w-4" /></Button></Link>
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
          options={TIPOS_REEMBOLSO.map((t) => ({ value: t, label: t }))}
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
            <TableHead>Origem</TableHead>
            <TableHead>Observação</TableHead>
            <TableHead className="text-right">Valor</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum reembolso.</TableCell></TableRow>
            ) : filtered.map((d: any) => (
              <TableRow key={d.id}>
                <TableCell className="font-medium">{d.rh_folha_mensal?.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{d.tipo}</TableCell>
                <TableCell>
                  {d.origem === "beneficio_moradia" ? (
                    <Badge variant="secondary">automático</Badge>
                  ) : (
                    <Badge variant="outline">manual</Badge>
                  )}
                </TableCell>
                <TableCell className="text-muted-foreground text-sm">{d.observacao || "—"}</TableCell>
                <TableCell className="text-right tabular-nums">{fmt(Number(d.valor))}</TableCell>
              </TableRow>
            ))}
            {filtered.length > 0 && (
              <TableRow>
                <TableCell colSpan={4} className="font-semibold text-right">Total</TableCell>
                <TableCell className="text-right font-semibold tabular-nums">{fmt(total)}</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent></Card>
    </div>
  );
}
