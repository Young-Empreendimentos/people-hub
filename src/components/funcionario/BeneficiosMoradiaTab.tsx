import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";

interface Props {
  funcionarioId: string;
  remuneracaoCargo: number | null;
}

export default function BeneficiosMoradiaTab({ funcionarioId, remuneracaoCargo }: Props) {
  const queryClient = useQueryClient();
  const { canDelete, role } = useAuth();
  const canEdit = role === "admin" || role === "coordenador";

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [dataInicio, setDataInicio] = useState("");
  const [dataFim, setDataFim] = useState("");
  const [valorAluguel, setValorAluguel] = useState("");
  const [percentual, setPercentual] = useState("25");
  const [obs, setObs] = useState("");

  const { data: beneficios = [], isLoading } = useQuery({
    queryKey: ["rh_beneficios_moradia", funcionarioId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionario_beneficios_moradia")
        .select("*")
        .eq("funcionario_id", funcionarioId)
        .order("data_inicio", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!funcionarioId,
  });

  const vigente = (beneficios as any[]).find((b) => !b.data_fim);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        funcionario_id: funcionarioId,
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
        // Encerra o vigente automaticamente (se houver e o usuário não setou data_fim no anterior)
        if (vigente) {
          const novaIni = new Date(dataInicio);
          novaIni.setDate(novaIni.getDate() - 1);
          const fim = novaIni.toISOString().slice(0, 10);
          const { error: e1 } = await supabase
            .from("rh_funcionario_beneficios_moradia")
            .update({ data_fim: fim })
            .eq("id", vigente.id);
          if (e1) throw e1;
        }
        const { error } = await supabase
          .from("rh_funcionario_beneficios_moradia")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_beneficios_moradia", funcionarioId] });
      toast.success(editingId ? "Benefício atualizado." : "Benefício registrado.");
      closeDialog();
    },
    onError: (e: any) => toast.error("Erro ao salvar benefício: " + (e?.message || "")),
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
      queryClient.invalidateQueries({ queryKey: ["rh_beneficios_moradia", funcionarioId] });
      toast.success("Benefício excluído.");
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null);
    setDataInicio("");
    setDataFim("");
    setValorAluguel("");
    setPercentual("25");
    setObs("");
    setDialogOpen(true);
  };

  const openEdit = (b: any) => {
    setEditingId(b.id);
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

  const calcAuxilio = (perc: number) =>
    remuneracaoCargo ? remuneracaoCargo * (perc / 100) : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Benefícios de Moradia</CardTitle>
          {canEdit && (
            <Button size="sm" onClick={openNew}>
              <Plus className="mr-1 h-3 w-3" /> Novo benefício
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Carregando...</p>
        ) : beneficios.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum benefício de moradia cadastrado.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Reembolso Aluguel</TableHead>
                <TableHead>% Auxílio</TableHead>
                <TableHead>Aux. calculado*</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead className="w-24 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(beneficios as any[]).map((b) => {
                const isVigente = !b.data_fim;
                const auxCalc = calcAuxilio(Number(b.percentual_auxilio_moradia));
                return (
                  <TableRow key={b.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="text-sm">{b.data_inicio} → {b.data_fim || "atual"}</span>
                        {isVigente && <Badge className="bg-emerald-600">Vigente</Badge>}
                      </div>
                    </TableCell>
                    <TableCell className="tabular-nums">{fmt(Number(b.valor_reembolso_aluguel))}</TableCell>
                    <TableCell>{Number(b.percentual_auxilio_moradia)}%</TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {auxCalc !== null ? fmt(auxCalc) : "—"}
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
        )}
        <p className="text-xs text-muted-foreground pt-3">
          * Auxílio calculado com base na remuneração atual do cargo. Na folha, o valor é
          calculado com a remuneração vigente no momento do lançamento.
        </p>
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Benefício" : "Novo Benefício"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
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
            {remuneracaoCargo !== null && percentual && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                Auxílio moradia (referência): <span className="font-medium tabular-nums">
                  {fmt(remuneracaoCargo * (parseFloat(percentual) / 100))}
                </span>{" "}
                <span className="text-muted-foreground">
                  ({Number(percentual)}% de {fmt(remuneracaoCargo)})
                </span>
              </div>
            )}
            <div className="space-y-2">
              <label className="text-sm font-medium">Observação</label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} rows={3} />
            </div>
            {!editingId && vigente && (
              <p className="text-xs text-amber-600">
                Ao salvar, o benefício vigente atual será encerrado automaticamente um dia antes da nova data início.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!dataInicio || !valorAluguel || !percentual || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
