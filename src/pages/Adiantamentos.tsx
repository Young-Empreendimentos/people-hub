import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X } from "lucide-react";

type Parcela = { mes_ano: string; valor: number };

export default function Adiantamentos() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterFunc, setFilterFunc] = useState("");

  const [funcId, setFuncId] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [numParcelas, setNumParcelas] = useState("");
  const [mesInicial, setMesInicial] = useState("");
  const [anoInicial, setAnoInicial] = useState("");
  const [obs, setObs] = useState("");

  const { data: adiantamentos = [], isLoading } = useQuery({
    queryKey: ["rh_adiantamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_adiantamentos")
        .select("*, rh_funcionarios(nome_completo)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { funcionarios, isActive } = useActiveEmployees();

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parcelasFiltered = parcelas.filter((p) => p.mes_ano);
      const payload: any = {
        funcionario_id: funcId,
        data,
        valor: parseFloat(valor) || 0,
        parcelas: parcelasFiltered.length > 0 ? parcelasFiltered : null,
        datas_pagamento_pretendidas: parcelasFiltered.length > 0 ? parcelasFiltered.map((p) => p.mes_ano) : null,
        observacoes: obs || null,
      };
      if (editingId) {
        const { error } = await supabase.from("rh_adiantamentos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_adiantamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_adiantamentos"] });
      toast.success(editingId ? "Adiantamento atualizado." : "Adiantamento registrado.");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar adiantamento."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_adiantamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_adiantamentos"] }); toast.success("Adiantamento excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => { setEditingId(null); setFuncId(""); setData(""); setValor(""); setParcelas([]); setObs(""); setDialogOpen(true); };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setFuncId(a.funcionario_id);
    setData(a.data);
    setValor(String(a.valor));
    // Migra dados antigos: se não tiver parcelas mas tiver datas_pagamento_pretendidas, divide igualmente
    if (a.parcelas && Array.isArray(a.parcelas)) {
      setParcelas(a.parcelas);
    } else if (a.datas_pagamento_pretendidas?.length) {
      const total = Number(a.valor) || 0;
      const n = a.datas_pagamento_pretendidas.length;
      const base = Math.floor((total / n) * 100) / 100;
      const resto = Math.round((total - base * n) * 100) / 100;
      setParcelas(a.datas_pagamento_pretendidas.map((m: string, i: number) => ({
        mes_ano: m,
        valor: i === 0 ? +(base + resto).toFixed(2) : base,
      })));
    } else {
      setParcelas([]);
    }
    setObs(a.observacoes || "");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const MESES_PT = [
    { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
    { value: "03", label: "Março" }, { value: "04", label: "Abril" },
    { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
    { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
    { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
    { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
  ];
  const anoAtual = new Date().getFullYear();
  const ANOS_OPTS = Array.from({ length: 11 }, (_, i) => {
    const a = String(anoAtual - 5 + i);
    return { value: a, label: a };
  });

  const recalcParcelas = (list: Parcela[], total: number): Parcela[] => {
    const n = list.length;
    if (n === 0) return list;
    const base = Math.floor((total / n) * 100) / 100;
    const resto = Math.round((total - base * n) * 100) / 100;
    return list.map((p, i) => ({ ...p, valor: i === 0 ? +(base + resto).toFixed(2) : base }));
  };

  const addParcela = () => {
    const total = parseFloat(valor) || 0;
    const next = [...parcelas, { mes_ano: "", valor: 0 }];
    setParcelas(recalcParcelas(next, total));
  };
  const updateParcelaMes = (i: number, mesAno: string) => {
    const next = [...parcelas];
    next[i] = { ...next[i], mes_ano: mesAno };
    setParcelas(next);
  };
  const updateParcelaValor = (i: number, v: string) => {
    const next = [...parcelas];
    next[i] = { ...next[i], valor: parseFloat(v) || 0 };
    setParcelas(next);
  };
  const removeParcela = (i: number) => {
    const total = parseFloat(valor) || 0;
    setParcelas(recalcParcelas(parcelas.filter((_, idx) => idx !== i), total));
  };

  const onValorChange = (v: string) => {
    setValor(v);
    if (parcelas.length > 0) setParcelas(recalcParcelas(parcelas, parseFloat(v) || 0));
  };

  const totalParcelas = useMemo(() => parcelas.reduce((s, p) => s + (Number(p.valor) || 0), 0), [parcelas]);
  const valorNum = parseFloat(valor) || 0;
  const diff = +(valorNum - totalParcelas).toFixed(2);

  const formatMesAno = (iso: string) => {
    if (!iso) return "";
    const [y, m] = iso.split("-");
    const mes = MESES_PT.find((x) => x.value === m)?.label || m;
    return `${mes}/${y}`;
  };

  const filtered = filterFunc ? adiantamentos.filter((a: any) => a.funcionario_id === filterFunc) : adiantamentos;
  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const renderParcelasResumo = (a: any) => {
    if (a.parcelas && Array.isArray(a.parcelas) && a.parcelas.length) {
      return a.parcelas.map((p: Parcela) => `${formatMesAno(p.mes_ano)} (${formatCurrency(Number(p.valor))})`).join(", ");
    }
    return a.datas_pagamento_pretendidas?.map(formatMesAno).join(", ") || "—";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Adiantamento</Button>
      </div>

      <div className="max-w-sm">
        <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Funcionário</TableHead><TableHead>Valor</TableHead>
            <TableHead>Parcelas</TableHead><TableHead>Observações</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum adiantamento.</TableCell></TableRow>
            : filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.data}</TableCell>
                <TableCell className="font-medium">{a.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{formatCurrency(Number(a.valor))}</TableCell>
                <TableCell className="max-w-[260px] truncate">{renderParcelasResumo(a)}</TableCell>
                <TableCell className="max-w-[150px] truncate">{a.observacoes || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingId ? "Editar Adiantamento" : "Novo Adiantamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2 max-h-[70vh] overflow-y-auto">
            <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
              <Combobox options={funcionarios.filter((f: any) => isActive(f.id)).map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Data *</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Valor Total (R$) *</label><Input type="number" step="0.01" value={valor} onChange={(e) => onValorChange(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Parcelas</label>
                <Button type="button" variant="outline" size="sm" onClick={addParcela}>
                  <Plus className="mr-1 h-3 w-3" /> Adicionar parcela
                </Button>
              </div>
              {parcelas.length === 0 && (
                <p className="text-xs text-muted-foreground">Nenhuma parcela. Clique em "Adicionar parcela" para dividir o valor por mês.</p>
              )}
              {parcelas.map((p, i) => {
                const mes = p.mes_ano ? p.mes_ano.slice(5, 7) : "";
                const ano = p.mes_ano ? p.mes_ano.slice(0, 4) : "";
                const setMes = (m: string) => {
                  const a = ano || String(anoAtual);
                  updateParcelaMes(i, m ? `${a}-${m}-01` : "");
                };
                const setAno = (a: string) => {
                  const m = mes || "01";
                  updateParcelaMes(i, a ? `${a}-${m}-01` : "");
                };
                return (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1 min-w-0">
                      <Combobox options={MESES_PT} value={mes} onValueChange={setMes} placeholder="Mês" />
                    </div>
                    <div className="w-24">
                      <Combobox options={ANOS_OPTS} value={ano} onValueChange={setAno} placeholder="Ano" />
                    </div>
                    <div className="w-28">
                      <Input type="number" step="0.01" value={p.valor || ""} onChange={(e) => updateParcelaValor(i, e.target.value)} placeholder="Valor" />
                    </div>
                    <Button type="button" variant="ghost" size="icon" onClick={() => removeParcela(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                );
              })}
              {parcelas.length > 0 && (
                <div className="flex justify-between text-xs pt-1">
                  <span className="text-muted-foreground">Soma das parcelas: {formatCurrency(totalParcelas)}</span>
                  <span className={diff === 0 ? "text-muted-foreground" : "text-destructive"}>
                    {diff === 0 ? "✓ Bate com o valor total" : `Diferença: ${formatCurrency(diff)}`}
                  </span>
                </div>
              )}
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !data || !valor || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
