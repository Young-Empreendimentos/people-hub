import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { Plus, Trash2 } from "lucide-react";

export default function Adiantamentos() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [filterFunc, setFilterFunc] = useState("");

  const [funcId, setFuncId] = useState("");
  const [data, setData] = useState("");
  const [valor, setValor] = useState("");
  const [datasPagamento, setDatasPagamento] = useState("");
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

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => { const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo"); return data || []; },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const datas = datasPagamento.split(",").map((d) => d.trim()).filter(Boolean);
      const { error } = await supabase.from("rh_adiantamentos").insert({
        funcionario_id: funcId,
        data,
        valor: parseFloat(valor) || 0,
        datas_pagamento_pretendidas: datas.length > 0 ? datas : null,
        observacoes: obs || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_adiantamentos"] });
      toast.success("Adiantamento registrado.");
      setDialogOpen(false);
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

  const openNew = () => { setFuncId(""); setData(""); setValor(""); setDatasPagamento(""); setObs(""); setDialogOpen(true); };
  const filtered = filterFunc ? adiantamentos.filter((a: any) => a.funcionario_id === filterFunc) : adiantamentos;

  const formatCurrency = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Adiantamentos</h1>
          <p className="text-muted-foreground">Controle de adiantamentos a funcionários.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Adiantamento</Button>
      </div>

      <div className="max-w-sm">
        <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Funcionário</TableHead><TableHead>Valor</TableHead>
            <TableHead>Datas Pagamento</TableHead><TableHead>Observações</TableHead>
            <TableHead className="w-16 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum adiantamento.</TableCell></TableRow>
            : filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.data}</TableCell>
                <TableCell className="font-medium">{a.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{formatCurrency(Number(a.valor))}</TableCell>
                <TableCell>{a.datas_pagamento_pretendidas?.join(", ") || "—"}</TableCell>
                <TableCell className="max-w-[150px] truncate">{a.observacoes || "—"}</TableCell>
                <TableCell className="text-right">
                  {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo Adiantamento</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
              <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Data *</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Valor (R$) *</label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="0.00" /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Datas de Pagamento Pretendidas</label><Input value={datasPagamento} onChange={(e) => setDatasPagamento(e.target.value)} placeholder="Ex: 15/01/2026, 15/02/2026" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !data || !valor || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
