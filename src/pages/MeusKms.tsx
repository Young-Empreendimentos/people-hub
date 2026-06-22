import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";

const fmtBRL = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (s: string) => {
  const [y, m, d] = s.split("-");
  return `${d}/${m}/${y}`;
};

function getPeriodoAtual() {
  const hoje = new Date();
  const dia = hoje.getDate();
  const y = hoje.getFullYear();
  const m = hoje.getMonth(); // 0-based
  // Se >= 20: período começa dia 20 deste mês e vai até dia 19 do próximo
  // Se < 20: período começou dia 20 do mês anterior e vai até dia 19 deste mês
  let ini: Date, fim: Date;
  if (dia >= 20) {
    ini = new Date(y, m, 20);
    fim = new Date(y, m + 1, 19);
  } else {
    ini = new Date(y, m - 1, 20);
    fim = new Date(y, m, 19);
  }
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  return { ini: iso(ini), fim: iso(fim) };
}

const statusBadge = (s: string) => {
  const map: Record<string, { label: string; variant: any; className?: string }> = {
    pendente: { label: "Pendente", variant: "outline", className: "border-amber-400 text-amber-700 dark:text-amber-300" },
    aprovado: { label: "Aprovado", variant: "secondary" },
    rejeitado: { label: "Rejeitado", variant: "destructive" },
    pago: { label: "Pago", variant: "default" },
  };
  const cfg = map[s] || { label: s, variant: "outline" };
  return <Badge variant={cfg.variant} className={cfg.className}>{cfg.label}</Badge>;
};

export default function MeusKms() {
  const qc = useQueryClient();
  const { user, funcionarioId, userName } = useAuth();
  const [data, setData] = useState("");
  const [km, setKm] = useState("");
  const [descricao, setDescricao] = useState("");

  const { data: funcionario } = useQuery({
    queryKey: ["meu_funcionario", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("id, nome_completo, valor_km")
        .eq("id", funcionarioId!)
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const valorKm = Number(funcionario?.valor_km || 0);

  const { data: lancamentos = [] } = useQuery({
    queryKey: ["meus_kms", funcionarioId],
    enabled: !!funcionarioId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_km_lancamentos" as any)
        .select("*")
        .eq("funcionario_id", funcionarioId!)
        .order("data", { ascending: false });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const periodo = useMemo(() => getPeriodoAtual(), []);
  const resumoPeriodo = useMemo(() => {
    const items = (lancamentos as any[]).filter(
      (l) => l.data >= periodo.ini && l.data <= periodo.fim && l.status !== "rejeitado"
    );
    const km = items.reduce((s, l) => s + Number(l.km || 0), 0);
    const total = items.reduce((s, l) => s + Number(l.valor_total || 0), 0);
    return { km, total, qtd: items.length };
  }, [lancamentos, periodo]);

  const dataForaDoPeriodo = !!data && (data < periodo.ini || data > periodo.fim);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!funcionarioId) throw new Error("Funcionário não vinculado.");
      const kmN = parseFloat(km.replace(",", "."));
      if (!data) throw new Error("Informe a data.");
      if (data < periodo.ini || data > periodo.fim) {
        throw new Error(
          `A data precisa estar no período atual (${fmtDate(periodo.ini)} a ${fmtDate(periodo.fim)}).`
        );
      }
      if (!kmN || kmN <= 0) throw new Error("Informe um valor de km válido.");
      const valor_total = +(kmN * valorKm).toFixed(2);
      const { error } = await supabase.from("rh_km_lancamentos" as any).insert({
        funcionario_id: funcionarioId,
        data,
        km: kmN,
        valor_km_snapshot: valorKm,
        valor_total,
        descricao: descricao || null,
        status: "pendente",
        criado_por: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meus_kms", funcionarioId] });
      toast.success("Lançamento enviado para aprovação.");
      setData(""); setKm(""); setDescricao("");
    },
    onError: (e: any) => toast.error(e.message || "Erro ao lançar km."),
  });


  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_km_lancamentos" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meus_kms", funcionarioId] });
      toast.success("Lançamento removido.");
    },
    onError: () => toast.error("Não foi possível excluir."),
  });

  if (!funcionarioId) {
    return (
      <Card>
        <CardContent className="p-6 text-sm text-muted-foreground">
          Seu usuário ainda não está vinculado a um funcionário. Procure o RH.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 max-w-4xl mx-auto">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Reembolso de KM</h1>
        <p className="text-sm text-muted-foreground">
          Olá{userName ? `, ${userName}` : ""}. Lance aqui seus deslocamentos. Os lançamentos aprovados entram na folha do mês.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Período atual da folha</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">De</p>
            <p className="font-medium">{fmtDate(periodo.ini)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Até</p>
            <p className="font-medium">{fmtDate(periodo.fim)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">KM no período</p>
            <p className="font-medium tabular-nums">{resumoPeriodo.km.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Valor previsto</p>
            <p className="font-medium tabular-nums">{fmtBRL(resumoPeriodo.total)}</p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Novo lançamento</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {valorKm <= 0 && (
            <p className="text-xs text-amber-600">
              Atenção: seu valor por KM ainda não foi definido pelo RH. Você ainda pode lançar; o valor R$ será aplicado quando o RH configurar.
            </p>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label>Data do deslocamento</Label>
              <Input
                type="date"
                value={data}
                min={periodo.ini}
                max={periodo.fim}
                onChange={(e) => setData(e.target.value)}
              />
              {dataForaDoPeriodo && (
                <p className="text-xs text-destructive">
                  Data fora do período atual ({fmtDate(periodo.ini)} a {fmtDate(periodo.fim)}).
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>KM percorridos</Label>
              <Input
                type="number" inputMode="decimal" step="0.01" min="0"
                value={km} onChange={(e) => setKm(e.target.value)} placeholder="Ex: 35"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Valor R$ (calculado)</Label>
              <Input
                value={fmtBRL((parseFloat(km.replace(",", ".")) || 0) * valorKm)}
                disabled readOnly
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Descrição (opcional)</Label>
            <Textarea
              value={descricao} onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex.: visita à obra X, ida ao cartório Y..."
              rows={2}
            />
          </div>
          <div className="flex justify-end">
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>
              {addMutation.isPending ? "Enviando..." : "Enviar para aprovação"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Meus lançamentos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {lancamentos.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    Nenhum lançamento ainda.
                  </TableCell>
                </TableRow>
              ) : (
                (lancamentos as any[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell>{fmtDate(l.data)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(l.km).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(Number(l.valor_total))}</TableCell>
                    <TableCell>{statusBadge(l.status)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[260px] truncate">
                      {l.status === "rejeitado" && l.motivo_rejeicao
                        ? <span className="text-destructive">Rejeitado: {l.motivo_rejeicao}</span>
                        : (l.descricao || "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === "pendente" && (
                        <Button
                          variant="ghost" size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(l.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
