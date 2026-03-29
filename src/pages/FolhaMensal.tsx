import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

export default function FolhaMensal() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterFunc, setFilterFunc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [funcId, setFuncId] = useState("");
  const [mesRef, setMesRef] = useState("");
  const [horasAtraso, setHorasAtraso] = useState("");
  const [horasExtra, setHorasExtra] = useState("");
  const [planoSaude, setPlanoSaude] = useState(false);
  const [descontoParque, setDescontoParque] = useState(false);
  const [auxilioEdu, setAuxilioEdu] = useState(false);
  const [descontos, setDescontos] = useState("");
  const [comissoes, setComissoes] = useState("");
  const [plr, setPlr] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: folhas = [], isLoading } = useQuery({
    queryKey: ["rh_folha_mensal"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_folha_mensal")
        .select("*, rh_funcionarios(nome_completo)")
        .order("mes_referencia", { ascending: false });
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
      let anexo_holerite_path: string | null = null;
      if (file) {
        const path = `folha/${funcId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_holerite_path = path;
      }
      const payload: any = {
        funcionario_id: funcId,
        mes_referencia: mesRef + "-01",
        horas_atraso_faltas: parseFloat(horasAtraso) || 0,
        horas_extra: parseFloat(horasExtra) || 0,
        plano_saude: planoSaude,
        desconto_titulo_parque: descontoParque,
        auxilio_educacional: auxilioEdu,
        descontos_adiantamentos: parseFloat(descontos) || 0,
        valor_comissoes: parseFloat(comissoes) || 0,
        valor_plr: parseFloat(plr) || 0,
        observacoes: obs || null,
      };
      if (file) payload.anexo_holerite_path = anexo_holerite_path;

      if (editingId) {
        const { error } = await supabase.from("rh_folha_mensal").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.anexo_holerite_path = anexo_holerite_path;
        const { error } = await supabase.from("rh_folha_mensal").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_folha_mensal"] });
      toast.success(editingId ? "Folha atualizada." : "Folha registrada.");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar folha."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_holerite_path: string | null }) => {
      if (r.anexo_holerite_path) await supabase.storage.from("rh-anexos").remove([r.anexo_holerite_path]);
      const { error } = await supabase.from("rh_folha_mensal").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_folha_mensal"] }); toast.success("Folha excluída."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null); setFuncId(""); setMesRef(""); setHorasAtraso(""); setHorasExtra("");
    setPlanoSaude(false); setDescontoParque(false); setAuxilioEdu(false);
    setDescontos(""); setComissoes(""); setPlr(""); setObs(""); setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (f: any) => {
    setEditingId(f.id); setFuncId(f.funcionario_id); setMesRef(f.mes_referencia?.slice(0, 7) || "");
    setHorasAtraso(String(f.horas_atraso_faltas)); setHorasExtra(String(f.horas_extra));
    setPlanoSaude(f.plano_saude); setDescontoParque(f.desconto_titulo_parque);
    setAuxilioEdu(f.auxilio_educacional); setDescontos(String(f.descontos_adiantamentos));
    setComissoes(String(f.valor_comissoes)); setPlr(String(f.valor_plr));
    setObs(f.observacoes || ""); setFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };
  const filtered = filterFunc ? folhas.filter((f: any) => f.funcionario_id === filterFunc) : folhas;
  const fmt = (v: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fechamento de Folha Mensal</h1>
          <p className="text-muted-foreground">Gerencie o fechamento mensal da folha de pagamento.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Nova Folha</Button>
      </div>

      <div className="max-w-sm">
        <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Mês</TableHead><TableHead>Funcionário</TableHead>
            <TableHead>H. Atraso</TableHead><TableHead>H. Extra</TableHead>
            <TableHead>Comissões</TableHead><TableHead>PLR</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            : filtered.map((f: any) => (
              <TableRow key={f.id}>
                <TableCell>{f.mes_referencia?.slice(0, 7)}</TableCell>
                <TableCell className="font-medium">{f.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{Number(f.horas_atraso_faltas).toFixed(1)}h</TableCell>
                <TableCell>{Number(f.horas_extra).toFixed(1)}h</TableCell>
                <TableCell>{fmt(Number(f.valor_comissoes))}</TableCell>
                <TableCell>{fmt(Number(f.valor_plr))}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(f)}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(f)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Folha" : "Nova Folha"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
                <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione" />
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Mês de Referência *</label>
                <Input type="month" value={mesRef} onChange={(e) => setMesRef(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Horas Atraso/Faltas</label><Input type="number" step="0.1" value={horasAtraso} onChange={(e) => setHorasAtraso(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Horas Extra</label><Input type="number" step="0.1" value={horasExtra} onChange={(e) => setHorasExtra(e.target.value)} /></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="flex items-center gap-2"><Switch checked={planoSaude} onCheckedChange={setPlanoSaude} /><label className="text-sm">Plano de Saúde</label></div>
              <div className="flex items-center gap-2"><Switch checked={descontoParque} onCheckedChange={setDescontoParque} /><label className="text-sm">Desc. Título Parque</label></div>
              <div className="flex items-center gap-2"><Switch checked={auxilioEdu} onCheckedChange={setAuxilioEdu} /><label className="text-sm">Auxílio Educacional</label></div>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Descontos/Adiant. (R$)</label><Input type="number" step="0.01" value={descontos} onChange={(e) => setDescontos(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">Comissões (R$)</label><Input type="number" step="0.01" value={comissoes} onChange={(e) => setComissoes(e.target.value)} /></div>
              <div className="space-y-2"><label className="text-sm font-medium">PLR (R$)</label><Input type="number" step="0.01" value={plr} onChange={(e) => setPlr(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Holerite (anexo)</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-3 w-3" /> Selecionar</Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !mesRef || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
