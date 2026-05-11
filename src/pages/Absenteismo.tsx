import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FileBarChart } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

type Registro = {
  id: string;
  funcionario_id: string;
  mes_referencia: string;
  dias_trabalhados: number;
  dias_faltas: number;
  observacoes: string | null;
  rh_funcionarios?: { nome_completo: string };
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

const calcTaxa = (dt: number, df: number) => {
  const total = dt + df;
  if (total <= 0) return 0;
  return (df / total) * 100;
};

export default function Absenteismo() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const { funcionarios, isActive } = useActiveEmployees();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [funcId, setFuncId] = useState("");
  const [mesRef, setMesRef] = useState("");
  const [diasTrab, setDiasTrab] = useState("");
  const [diasFalta, setDiasFalta] = useState("");
  const [obs, setObs] = useState("");

  const [filterMes, setFilterMes] = useState("");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["rh_absenteismo"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_absenteismo")
        .select("*, rh_funcionarios(nome_completo)")
        .order("mes_referencia", { ascending: false });
      if (error) throw error;
      return data as Registro[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const dt = parseInt(diasTrab) || 0;
      const df = parseInt(diasFalta) || 0;
      if (!funcId || !mesRef) throw new Error("Preencha funcionário e mês.");
      if (dt + df <= 0) throw new Error("Informe os dias trabalhados ou de falta.");
      const payload = {
        funcionario_id: funcId,
        mes_referencia: mesRef + "-01",
        dias_trabalhados: dt,
        dias_faltas: df,
        observacoes: obs || null,
      };
      if (editingId) {
        const { error } = await supabase.from("rh_absenteismo").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data: existente } = await supabase
          .from("rh_absenteismo")
          .select("id")
          .eq("funcionario_id", funcId)
          .eq("mes_referencia", mesRef + "-01")
          .maybeSingle();
        if (existente) throw new Error("Já existe um lançamento para esse funcionário neste mês.");
        const { error } = await supabase.from("rh_absenteismo").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_absenteismo"] });
      toast.success(editingId ? "Lançamento atualizado." : "Lançamento registrado.");
      closeDialog();
    },
    onError: (e: any) => toast.error(e.message || "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_absenteismo").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_absenteismo"] }); toast.success("Excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null); setFuncId(""); setMesRef(""); setDiasTrab(""); setDiasFalta(""); setObs("");
    setDialogOpen(true);
  };
  const openEdit = (r: Registro) => {
    setEditingId(r.id);
    setFuncId(r.funcionario_id);
    setMesRef(r.mes_referencia.slice(0, 7));
    setDiasTrab(String(r.dias_trabalhados));
    setDiasFalta(String(r.dias_faltas));
    setObs(r.observacoes || "");
    setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const filtered = useMemo(() => {
    if (!filterMes) return registros;
    return registros.filter((r) => r.mes_referencia.startsWith(filterMes));
  }, [registros, filterMes]);

  // Opções de meses disponíveis para filtro
  const mesesDisponiveis = useMemo(() => {
    const set = new Set(registros.map((r) => r.mes_referencia.slice(0, 7)));
    return Array.from(set).sort().reverse().map((m) => ({ value: m, label: formatMesAno(m + "-01") }));
  }, [registros]);

  // Relatório do mês selecionado (ou último mês se não houver filtro)
  const mesRelatorio = filterMes || (mesesDisponiveis[0]?.value || "");
  const registrosMes = useMemo(
    () => registros.filter((r) => r.mes_referencia.startsWith(mesRelatorio)),
    [registros, mesRelatorio]
  );
  const mediaEmpresa = useMemo(() => {
    if (registrosMes.length === 0) return 0;
    const soma = registrosMes.reduce((s, r) => s + calcTaxa(r.dias_trabalhados, r.dias_faltas), 0);
    return soma / registrosMes.length;
  }, [registrosMes]);
  const topFuncionarios = useMemo(() => {
    return [...registrosMes]
      .map((r) => ({ ...r, taxa: calcTaxa(r.dias_trabalhados, r.dias_faltas) }))
      .sort((a, b) => b.taxa - a.taxa)
      .slice(0, 10);
  }, [registrosMes]);

  // Evolução nos últimos 6 meses
  const evolucao = useMemo(() => {
    const map = new Map<string, { soma: number; count: number }>();
    registros.forEach((r) => {
      const key = r.mes_referencia.slice(0, 7);
      const taxa = calcTaxa(r.dias_trabalhados, r.dias_faltas);
      const cur = map.get(key) || { soma: 0, count: 0 };
      cur.soma += taxa; cur.count += 1;
      map.set(key, cur);
    });
    const arr = Array.from(map.entries())
      .map(([mes, v]) => ({ mes, taxa: v.count > 0 ? +(v.soma / v.count).toFixed(2) : 0 }))
      .sort((a, b) => a.mes.localeCompare(b.mes));
    const last6 = arr.slice(-6);
    return last6.map((x) => ({ mes: formatMesAno(x.mes + "-01").replace(/\/\d{2}(\d{2})$/, "/$1"), taxa: x.taxa }));
  }, [registros]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Absenteísmo</h1>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-48">
            <Combobox
              options={[{ value: "", label: "Todos os meses" }, ...mesesDisponiveis]}
              value={filterMes}
              onValueChange={setFilterMes}
              placeholder="Filtrar por mês"
            />
          </div>
          <Button variant="outline" onClick={() => setReportOpen(true)}>
            <FileBarChart className="mr-2 h-4 w-4" /> Gerar Relatório
          </Button>
          <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Lançamento</Button>
        </div>
      </div>

      {/* Gráfico de evolução */}
      <Card>
        <CardHeader><CardTitle className="text-base">Evolução do Absenteísmo (últimos 6 meses)</CardTitle></CardHeader>
        <CardContent>
          {evolucao.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Sem dados para exibir.</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={evolucao}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="mes" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(v) => `${v}%`} />
                <Tooltip formatter={(v: number) => `${v.toFixed(2)}%`} />
                <Bar dataKey="taxa" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Tabela de lançamentos */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Mês</TableHead>
                <TableHead>Funcionário</TableHead>
                <TableHead className="text-right">Dias Trabalhados</TableHead>
                <TableHead className="text-right">Dias de Falta</TableHead>
                <TableHead className="text-right">Taxa</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">Nenhum lançamento.</TableCell></TableRow>
              ) : filtered.map((r) => {
                const taxa = calcTaxa(r.dias_trabalhados, r.dias_faltas);
                return (
                  <TableRow key={r.id}>
                    <TableCell>{formatMesAno(r.mes_referencia)}</TableCell>
                    <TableCell className="font-medium">{r.rh_funcionarios?.nome_completo || "—"}</TableCell>
                    <TableCell className="text-right">{r.dias_trabalhados}</TableCell>
                    <TableCell className="text-right">{r.dias_faltas}</TableCell>
                    <TableCell className={`text-right font-medium ${taxa >= 10 ? "text-destructive" : taxa >= 5 ? "text-amber-600" : ""}`}>
                      {taxa.toFixed(2)}%
                    </TableCell>
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

      {/* Dialog de cadastro */}
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
                <label className="text-sm font-medium">Dias Trabalhados</label>
                <Input type="number" min="0" value={diasTrab} onChange={(e) => setDiasTrab(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Dias de Falta</label>
                <Input type="number" min="0" value={diasFalta} onChange={(e) => setDiasFalta(e.target.value)} />
              </div>
            </div>
            {(parseInt(diasTrab) || 0) + (parseInt(diasFalta) || 0) > 0 && (
              <div className="text-sm text-muted-foreground">
                Taxa de absenteísmo: <span className="font-semibold text-foreground">{calcTaxa(parseInt(diasTrab) || 0, parseInt(diasFalta) || 0).toFixed(2)}%</span>
              </div>
            )}
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

      {/* Dialog de relatório */}
      <Dialog open={reportOpen} onOpenChange={setReportOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Relatório de Absenteísmo — {mesRelatorio ? formatMesAno(mesRelatorio + "-01") : "—"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            <Card>
              <CardContent className="p-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-muted-foreground">Média da empresa</p>
                  <p className="text-2xl font-bold">{mediaEmpresa.toFixed(2)}%</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Funcionários no mês</p>
                  <p className="text-2xl font-bold">{registrosMes.length}</p>
                </div>
              </CardContent>
            </Card>
            <div>
              <h3 className="font-semibold mb-2">Maiores índices</h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Funcionário</TableHead>
                    <TableHead className="text-right">Faltas</TableHead>
                    <TableHead className="text-right">Trabalhados</TableHead>
                    <TableHead className="text-right">Taxa</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {topFuncionarios.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center py-6 text-muted-foreground">Sem dados.</TableCell></TableRow>
                  ) : topFuncionarios.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.rh_funcionarios?.nome_completo || "—"}</TableCell>
                      <TableCell className="text-right">{r.dias_faltas}</TableCell>
                      <TableCell className="text-right">{r.dias_trabalhados}</TableCell>
                      <TableCell className={`text-right font-medium ${r.taxa >= 10 ? "text-destructive" : r.taxa >= 5 ? "text-amber-600" : ""}`}>
                        {r.taxa.toFixed(2)}%
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setReportOpen(false)}>Fechar</Button>
            <Button onClick={() => window.print()}>Imprimir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
