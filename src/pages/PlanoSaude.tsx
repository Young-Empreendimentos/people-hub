import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

type Registro = {
  id: string;
  funcionario_id: string;
  mes_referencia: string;
  valor_saude: number;
  valor_odonto: number;
  uso_plano: number;
  observacoes: string | null;
  rh_funcionarios?: {
    nome_completo: string;
    aniversario: string | null;
    rh_empresas?: { nome: string } | null;
  };
};

const MESES_PT = [
  { value: "01", label: "Janeiro" }, { value: "02", label: "Fevereiro" },
  { value: "03", label: "Março" }, { value: "04", label: "Abril" },
  { value: "05", label: "Maio" }, { value: "06", label: "Junho" },
  { value: "07", label: "Julho" }, { value: "08", label: "Agosto" },
  { value: "09", label: "Setembro" }, { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" }, { value: "12", label: "Dezembro" },
];

const formatMesAno = (iso: string) => {
  if (!iso) return "";
  const [y, m] = iso.split("-");
  const mes = MESES_PT.find((x) => x.value === m)?.label || m;
  return `${mes}/${y}`;
};

const calcIdade = (aniv: string | null | undefined) => {
  if (!aniv) return null;
  const d = new Date(aniv);
  if (isNaN(d.getTime())) return null;
  const hoje = new Date();
  let idade = hoje.getFullYear() - d.getFullYear();
  const m = hoje.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && hoje.getDate() < d.getDate())) idade--;
  return idade;
};

const fmtBRL = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PlanoSaude() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const { funcionarios, isActive } = useActiveEmployees();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [funcId, setFuncId] = useState("");
  const [mesRef, setMesRef] = useState("");
  const [valorSaude, setValorSaude] = useState("");
  const [valorOdonto, setValorOdonto] = useState("");
  const [usoPlano, setUsoPlano] = useState("");
  const [obs, setObs] = useState("");

  const [filterMes, setFilterMes] = useState("");
  const [filterFunc, setFilterFunc] = useState("");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["rh_plano_saude"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_plano_saude")
        .select("*, rh_funcionarios(nome_completo, aniversario, rh_empresas(nome))")
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data as Registro[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!funcId || !mesRef) throw new Error("Preencha funcionário e mês.");
      const payload = {
        funcionario_id: funcId,
        mes_referencia: mesRef + "-01",
        valor_saude: parseFloat(valorSaude) || 0,
        valor_odonto: parseFloat(valorOdonto) || 0,
        uso_plano: parseFloat(usoPlano) || 0,
        observacoes: obs || null,
      };
      if (editingId) {
        const { error } = await supabase.from("rh_plano_saude").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: existente } = await supabase
          .from("rh_plano_saude")
          .select("id")
          .eq("funcionario_id", funcId)
          .eq("mes_referencia", mesRef + "-01")
          .maybeSingle();
        if (existente) throw new Error("Já existe um lançamento para esse funcionário neste mês.");
        const { error } = await supabase.from("rh_plano_saude").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_plano_saude"] });
      toast.success(editingId ? "Lançamento atualizado." : "Lançamento registrado.");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_plano_saude").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_plano_saude"] }); toast.success("Excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null); setFuncId(""); setMesRef("");
    setValorSaude(""); setValorOdonto(""); setUsoPlano(""); setObs("");
    setDialogOpen(true);
  };
  const openEdit = (r: Registro) => {
    setEditingId(r.id);
    setFuncId(r.funcionario_id);
    setMesRef(r.mes_referencia.slice(0, 7));
    setValorSaude(String(r.valor_saude));
    setValorOdonto(String(r.valor_odonto));
    setUsoPlano(String(r.uso_plano));
    setObs(r.observacoes || "");
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const filtered = useMemo(() => {
    return registros.filter((r) => {
      if (filterMes && !r.mes_referencia.startsWith(filterMes)) return false;
      if (filterFunc && r.funcionario_id !== filterFunc) return false;
      return true;
    });
  }, [registros, filterMes, filterFunc]);

  const mesesDisponiveis = useMemo(() => {
    const set = new Set(registros.map((r) => r.mes_referencia.slice(0, 7)));
    return Array.from(set).sort().reverse().map((m) => ({ value: m, label: formatMesAno(m + "-01") }));
  }, [registros]);

  const funcionariosComPlano = useMemo(() => {
    const ids = new Set(registros.map((r) => r.funcionario_id));
    return funcionarios.filter((f: any) => ids.has(f.id))
      .map((f: any) => ({ value: f.id, label: f.nome_completo }));
  }, [registros, funcionarios]);

  // Preview no dialog
  const total = (parseFloat(valorSaude) || 0) + (parseFloat(valorOdonto) || 0) + (parseFloat(usoPlano) || 0);
  const desconto = total * 0.2;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Plano de Saúde</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-44">
            <Combobox
              options={[{ value: "", label: "Todos os funcionários" }, ...funcionariosComPlano]}
              value={filterFunc}
              onValueChange={setFilterFunc}
              placeholder="Filtrar funcionário"
            />
          </div>
          <div className="w-44">
            <Combobox
              options={[{ value: "", label: "Todos os meses" }, ...mesesDisponiveis]}
              value={filterMes}
              onValueChange={setFilterMes}
              placeholder="Filtrar por mês"
            />
          </div>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Lançamento</Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-right">Idade</TableHead>
                <TableHead className="text-right">Valor Saúde</TableHead>
                <TableHead className="text-right">Valor Odonto</TableHead>
                <TableHead className="text-right">Uso do Plano</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Desconto Mensal</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
              ) : filtered.map((r) => {
                const tot = Number(r.valor_saude) + Number(r.valor_odonto) + Number(r.uso_plano);
                const desc = tot * 0.2;
                const idade = calcIdade(r.rh_funcionarios?.aniversario);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{formatMesAno(r.mes_referencia)}</TableCell>
                    <TableCell>{r.rh_funcionarios?.rh_empresas?.nome || "—"}</TableCell>
                    <TableCell className="font-medium">{r.rh_funcionarios?.nome_completo || "—"}</TableCell>
                    <TableCell className="text-right">{idade ?? "—"}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(r.valor_saude))}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(r.valor_odonto))}</TableCell>
                    <TableCell className="text-right">{fmtBRL(Number(r.uso_plano))}</TableCell>
                    <TableCell className="text-right font-medium">{fmtBRL(tot)}</TableCell>
                    <TableCell className="text-right font-semibold text-primary">{fmtBRL(desc)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(r.id)}><Trash2 className="h-4 w-4" /></Button>}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editingId ? "Editar Lançamento" : "Novo Lançamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário *</label>
              <Combobox
                options={funcionarios.filter((f: any) => isActive(f.id) || f.id === funcId).map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId}
                onValueChange={setFuncId}
                placeholder="Selecione"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Mês/Ano de Referência *</label>
              <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor Saúde</label>
                <Input type="number" step="0.01" min="0" value={valorSaude} onChange={(e) => setValorSaude(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor Odontológico</label>
                <Input type="number" step="0.01" min="0" value={valorOdonto} onChange={(e) => setValorOdonto(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Uso do Plano (Coparticipação)</label>
              <Input type="number" step="0.01" min="0" value={usoPlano} onChange={(e) => setUsoPlano(e.target.value)} />
            </div>
            <div className="rounded-md border bg-muted/40 p-3 text-sm space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">Total</span><span className="font-medium">{fmtBRL(total)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Desconto Mensal (20%)</span><span className="font-semibold text-primary">{fmtBRL(desconto)}</span></div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Input value={obs} onChange={(e) => setObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
