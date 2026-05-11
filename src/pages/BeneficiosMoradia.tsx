import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";

export default function BeneficiosMoradia() {
  const queryClient = useQueryClient();
  const { canDelete, role } = useAuth();
  const canEdit = role === "admin" || role === "coordenador";

  const [filterFunc, setFilterFunc] = useState("");
  const [onlyVigentes, setOnlyVigentes] = useState(false);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [funcId, setFuncId] = useState("");
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valorAluguel, setValorAluguel] = useState("");
  const [percentual, setPercentual] = useState("25");
  const [obs, setObs] = useState("");

  const { data: beneficios = [], isLoading } = useQuery({
    queryKey: ["rh_beneficios_moradia_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionario_beneficios_moradia")
        .select("*, rh_funcionarios(nome_completo, cargo_id)")
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { isActive } = useActiveEmployees();
  const { data: funcionariosAll = [] } = useQuery({
    queryKey: ["rh_funcionarios_moradia"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_funcionarios")
        .select("id, nome_completo, cargo_id")
        .order("nome_completo");
      return data || [];
    },
  });
  const funcionarios = useMemo(
    () => (funcionariosAll as any[]).filter((f) => isActive(f.id)),
    [funcionariosAll, isActive]
  );

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos_moradia"],
    queryFn: async () => {
      const { data } = await supabase.from("rh_cargos").select("id, remuneracao");
      return data || [];
    },
  });
  const cargoMap = useMemo(() => {
    const m: Record<string, number> = {};
    for (const c of cargos as any[]) m[c.id] = Number(c.remuneracao) || 0;
    return m;
  }, [cargos]);

  const filtered = useMemo(() => {
    return (beneficios as any[]).filter((b) => {
      if (filterFunc && b.funcionario_id !== filterFunc) return false;
      if (onlyVigentes && b.data_fim) return false;
      return true;
    });
  }, [beneficios, filterFunc, onlyVigentes]);

  const vigentePara = (funcionarioId: string) =>
    (beneficios as any[]).find((b) => b.funcionario_id === funcionarioId && !b.data_fim);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!funcId) throw new Error("Selecione um funcionário.");
      const payload: any = {
        funcionario_id: funcId,
        data_inicio: dataInicio,
        data_fim: dataFim || null,
        valor_reembolso_aluguel: parseFloat(valorAluguel) || 0,
        percentual_auxilio_moradia: parseFloat(percentual) || 0,
        observacao: obs || null,
      };
      if (editingId) {
        const { error } = await supabase
          .from("rh_funcionario_beneficios_moradia")
          .update(payload)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const vig = vigentePara(funcId);
        if (vig && !dataFim) {
          // Encerra o anterior vigente um dia antes do novo início
          const d = new Date(dataInicio);
          d.setDate(d.getDate() - 1);
          const fim = d.toISOString().slice(0, 10);
          const { error: e1 } = await supabase
            .from("rh_funcionario_beneficios_moradia")
            .update({ data_fim: fim })
            .eq("id", vig.id);
          if (e1) throw e1;
        }
        const { error } = await supabase
          .from("rh_funcionario_beneficios_moradia")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_beneficios_moradia_all"] });
      queryClient.invalidateQueries({ queryKey: ["rh_beneficios_moradia"] });
      toast.success(editingId ? "Benefício atualizado." : "Benefício registrado.");
      closeDialog();
    },
    onError: (e: any) => toast.error("Erro ao salvar: " + (e?.message || "")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("rh_funcionario_beneficios_moradia")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_beneficios_moradia_all"] });
      toast.success("Benefício excluído.");
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null);
    setFuncId("");
    setDataInicio("");
    setDataFim("");
    setValorAluguel("");
    setPercentual("25");
    setObs("");
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
    setFuncId(b.funcionario_id);
    setDataInicio(b.data_inicio || "");
    setDataFim(b.data_fim || "");
    setValorAluguel(String(b.valor_reembolso_aluguel || 0));
    setPercentual(String(b.percentual_auxilio_moradia || 25));
    setObs(b.observacao || "");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const selectedFuncRemun = useMemo(() => {
    const f = (funcionarios as any[]).find((x) => x.id === funcId);
    return f?.cargo_id ? cargoMap[f.cargo_id] : null;
  }, [funcId, funcionarios, cargoMap]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benefícios de Moradia</h1>
          <p className="text-sm text-muted-foreground">
            Reembolso de aluguel + auxílio moradia (% sobre salário). Aplicado automaticamente na folha mensal.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openNew}>
            <Plus className="mr-2 h-4 w-4" /> Novo Benefício
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-center">
        <Combobox
          options={(funcionarios as any[]).map((f) => ({ value: f.id, label: f.nome_completo }))}
          value={filterFunc}
          onValueChange={setFilterFunc}
          placeholder="Filtrar por funcionário"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={onlyVigentes}
            onChange={(e) => setOnlyVigentes(e.target.checked)}
            className="h-4 w-4"
          />
          Apenas vigentes
        </label>
        {(filterFunc || onlyVigentes) && (
          <Button variant="ghost" size="sm" onClick={() => { setFilterFunc(""); setOnlyVigentes(false); }}>
            Limpar filtros
          </Button>
        )}
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funcionário</TableHead>
              <TableHead>Período</TableHead>
              <TableHead>Reembolso Aluguel</TableHead>
              <TableHead>% Auxílio</TableHead>
              <TableHead>Aux. calculado*</TableHead>
              <TableHead>Observação</TableHead>
              <TableHead className="w-24 text-right">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum benefício.</TableCell></TableRow>
            ) : filtered.map((b: any) => {
              const isVigente = !b.data_fim;
              const remun = b.rh_funcionarios?.cargo_id ? cargoMap[b.rh_funcionarios.cargo_id] : null;
              const auxCalc = remun != null ? remun * (Number(b.percentual_auxilio_moradia) / 100) : null;
              return (
                <TableRow key={b.id}>
                  <TableCell className="font-medium">{b.rh_funcionarios?.nome_completo || "—"}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{b.data_inicio} → {b.data_fim || "atual"}</span>
                      {isVigente && <Badge className="bg-emerald-600">Vigente</Badge>}
                    </div>
                  </TableCell>
                  <TableCell className="tabular-nums">{fmt(Number(b.valor_reembolso_aluguel))}</TableCell>
                  <TableCell>{Number(b.percentual_auxilio_moradia)}%</TableCell>
                  <TableCell className="tabular-nums text-muted-foreground">
                    {auxCalc != null ? fmt(auxCalc) : "—"}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                    {b.observacao || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <Button variant="ghost" size="icon" onClick={() => openEdit(b)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                      )}
                      {canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive"
                          onClick={() => deleteMutation.mutate(b.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent></Card>
      <p className="text-xs text-muted-foreground">
        * Auxílio calculado com base na remuneração atual do cargo do funcionário.
      </p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Benefício" : "Novo Benefício"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Funcionário *</label>
              <Combobox
                options={(funcionarios as any[]).map((f) => ({ value: f.id, label: f.nome_completo }))}
                value={funcId}
                onValueChange={setFuncId}
                placeholder="Selecione"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Data início *</label>
                <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data fim (opcional)</label>
                <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Reembolso de aluguel (R$) *</label>
                <Input type="number" step="0.01" value={valorAluguel} onChange={(e) => setValorAluguel(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">% Auxílio moradia *</label>
                <Input type="number" step="0.01" value={percentual} onChange={(e) => setPercentual(e.target.value)} />
              </div>
            </div>
            {selectedFuncRemun != null && percentual && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                Auxílio moradia (referência):{" "}
                <span className="font-medium tabular-nums">
                  {fmt(selectedFuncRemun * (parseFloat(percentual) / 100))}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({Number(percentual)}% de {fmt(selectedFuncRemun)})
                </span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>
            {!editingId && funcId && vigentePara(funcId) && (
              <p className="text-xs text-amber-600">
                Existe um benefício vigente para este funcionário. Ao salvar, ele será encerrado automaticamente um dia antes da nova data início.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!funcId || !dataInicio || !valorAluguel || !percentual || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
