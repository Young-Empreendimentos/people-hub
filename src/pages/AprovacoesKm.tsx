import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import { Textarea } from "@/components/ui/textarea";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Check, X } from "lucide-react";

const fmtBRL = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
const fmtDate = (s: string) => { const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };

const STATUS_OPTS = [
  { value: "pendente", label: "Pendentes" },
  { value: "aprovado", label: "Aprovados" },
  { value: "rejeitado", label: "Rejeitados" },
  { value: "pago", label: "Pagos" },
  { value: "todos", label: "Todos" },
];

export default function AprovacoesKm() {
  const qc = useQueryClient();
  const { user, isStaff, canConfig } = useAuth();
  const todayISO = (() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  })();
  const [retroDate, setRetroDate] = useState(todayISO);
  const [statusFilter, setStatusFilter] = useState("pendente");
  const [funcFilter, setFuncFilter] = useState("");
  const [iniFilter, setIniFilter] = useState("");
  const [fimFilter, setFimFilter] = useState("");
  const [rejectOpen, setRejectOpen] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["funcionarios_para_aprovacao"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo");
      return data || [];
    },
  });
  const funcMap = useMemo(
    () => Object.fromEntries((funcionarios as any[]).map((f) => [f.id, f.nome_completo])),
    [funcionarios]
  );

  const { data: lancamentos = [], isLoading } = useQuery({
    queryKey: ["km_aprovacoes", statusFilter, funcFilter, iniFilter, fimFilter],
    queryFn: async () => {
      let q = supabase.from("rh_km_lancamentos" as any).select("*");
      if (statusFilter !== "todos") q = q.eq("status", statusFilter);
      if (funcFilter) q = q.eq("funcionario_id", funcFilter);
      if (iniFilter) q = q.gte("data", iniFilter);
      if (fimFilter) q = q.lte("data", fimFilter);
      q = q.order("data", { ascending: false });
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  // Liberação de lançamento retroativo (config única)
  const { data: kmConfig } = useQuery({
    queryKey: ["rh_km_config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_km_config").select("retroativo_ate").maybeSingle();
      if (error) throw error;
      return data as { retroativo_ate: string | null } | null;
    },
  });

  const saveRetro = useMutation({
    mutationFn: async (value: string | null) => {
      const { error } = await supabase.from("rh_km_config")
        .update({ retroativo_ate: value, updated_by: user?.id ?? null, updated_at: new Date().toISOString() })
        .eq("id", 1);
      if (error) throw error;
    },
    onSuccess: (_d, value) => {
      qc.invalidateQueries({ queryKey: ["rh_km_config"] });
      toast.success(value ? "Lançamento retroativo liberado." : "Liberação desligada.");
    },
    onError: () => toast.error("Erro ao atualizar (apenas admin/coordenador)."),
  });

  const approveMutation = useMutation({
    mutationFn: async (id: string) => {
      const lanc = (lancamentos as any[]).find((l) => l.id === id);
      const patch: any = {
        status: "aprovado",
        aprovado_por: user?.id ?? null,
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: null,
      };
      // Se o snapshot estava zerado, recalcula com o valor atual do funcionário
      if (lanc && (!Number(lanc.valor_km_snapshot) || Number(lanc.valor_km_snapshot) === 0)) {
        const { data: func } = await supabase
          .from("rh_funcionarios")
          .select("valor_km")
          .eq("id", lanc.funcionario_id)
          .maybeSingle();
        const vk = Number((func as any)?.valor_km || 0);
        if (vk > 0) {
          patch.valor_km_snapshot = vk;
          patch.valor_total = +(Number(lanc.km) * vk).toFixed(2);
        }
      }
      const { error } = await supabase.from("rh_km_lancamentos" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["km_aprovacoes"] });
      toast.success("Lançamento aprovado.");
    },
    onError: () => toast.error("Erro ao aprovar."),
  });


  const rejectMutation = useMutation({
    mutationFn: async ({ id, motivo }: { id: string; motivo: string }) => {
      const { error } = await supabase.from("rh_km_lancamentos" as any).update({
        status: "rejeitado",
        aprovado_por: user?.id ?? null,
        aprovado_em: new Date().toISOString(),
        motivo_rejeicao: motivo || null,
      } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["km_aprovacoes"] });
      toast.success("Lançamento rejeitado.");
      setRejectOpen(null);
      setMotivo("");
    },
    onError: () => toast.error("Erro ao rejeitar."),
  });

  if (!isStaff) {
    return <p className="text-sm text-muted-foreground">Acesso restrito.</p>;
  }

  const totalSelecionado = (lancamentos as any[]).reduce((s, l) => s + Number(l.valor_total || 0), 0);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Aprovações de KM</h1>
        <p className="text-sm text-muted-foreground">
          Aprove ou rejeite os lançamentos enviados pelos colaboradores.
        </p>
      </div>

      {canConfig && (
        <Card className="border-amber-300 dark:border-amber-700">
          <CardHeader>
            <CardTitle className="text-base">Liberar lançamento retroativo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Enquanto a data abaixo não passar, os colaboradores podem lançar no "Meus KMs" também as datas do período anterior. Depois da data, fecha sozinho.
            </p>
            <p className="text-sm">
              {kmConfig?.retroativo_ate ? (
                <>
                  Situação: liberado até <strong>{fmtDate(kmConfig.retroativo_ate)}</strong>{" "}
                  {kmConfig.retroativo_ate >= todayISO
                    ? <Badge variant="secondary">ativo</Badge>
                    : <Badge variant="outline">expirado</Badge>}
                </>
              ) : (
                <span className="text-muted-foreground">Situação: nenhuma liberação ativa.</span>
              )}
            </p>
            <div className="flex flex-wrap items-end gap-2">
              <div>
                <label className="text-xs text-muted-foreground">Liberar até</label>
                <Input type="date" value={retroDate} min={todayISO} onChange={(e) => setRetroDate(e.target.value)} />
              </div>
              <Button onClick={() => saveRetro.mutate(retroDate || null)} disabled={!retroDate || saveRetro.isPending}>
                Liberar
              </Button>
              <Button variant="outline" onClick={() => saveRetro.mutate(null)} disabled={saveRetro.isPending || !kmConfig?.retroativo_ate}>
                Desligar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="p-4 grid grid-cols-1 sm:grid-cols-4 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Status</label>
            <Combobox options={STATUS_OPTS} value={statusFilter} onValueChange={setStatusFilter} placeholder="Status" />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Funcionário</label>
            <Combobox
              options={[{ value: "", label: "Todos" }, ...(funcionarios as any[]).map((f) => ({ value: f.id, label: f.nome_completo }))]}
              value={funcFilter}
              onValueChange={setFuncFilter}
              placeholder="Todos"
            />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={iniFilter} onChange={(e) => setIniFilter(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={fimFilter} onChange={(e) => setFimFilter(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Lançamentos</CardTitle>
          <div className="text-sm text-muted-foreground">
            {(lancamentos as any[]).length} registro(s) · Total {fmtBRL(totalSelecionado)}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Funcionário</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">KM</TableHead>
                <TableHead className="text-right">R$/km</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right w-28">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : lancamentos.length === 0 ? (
                <TableRow><TableCell colSpan={8} className="py-6 text-center text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
              ) : (
                (lancamentos as any[]).map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="font-medium">{funcMap[l.funcionario_id] || "—"}</TableCell>
                    <TableCell>{fmtDate(l.data)}</TableCell>
                    <TableCell className="text-right tabular-nums">{Number(l.km).toFixed(2)}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(Number(l.valor_km_snapshot))}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtBRL(Number(l.valor_total))}</TableCell>
                    <TableCell>
                      <Badge variant={l.status === "aprovado" ? "secondary" : l.status === "rejeitado" ? "destructive" : l.status === "pago" ? "default" : "outline"}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate">
                      {l.status === "rejeitado" && l.motivo_rejeicao
                        ? <span className="text-destructive">Rejeitado: {l.motivo_rejeicao}</span>
                        : (l.descricao || "—")}
                    </TableCell>
                    <TableCell className="text-right">
                      {l.status === "pendente" && (
                        <div className="flex justify-end gap-1">
                          <Button size="icon" variant="ghost" className="text-emerald-600" onClick={() => approveMutation.mutate(l.id)}>
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="text-destructive" onClick={() => { setRejectOpen(l.id); setMotivo(""); }}>
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={!!rejectOpen} onOpenChange={(o) => { if (!o) setRejectOpen(null); }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Rejeitar lançamento</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm font-medium">Motivo (opcional)</label>
            <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} rows={3} placeholder="Explique para o colaborador" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectOpen(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => rejectOpen && rejectMutation.mutate({ id: rejectOpen, motivo })}>
              Rejeitar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
