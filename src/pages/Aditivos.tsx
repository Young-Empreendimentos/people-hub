import { useState, useRef } from "react";
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
import { Plus, Pencil, Trash2, Upload } from "lucide-react";

export default function Aditivos() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [filterFunc, setFilterFunc] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [funcId, setFuncId] = useState("");
  const [tipoAditivoId, setTipoAditivoId] = useState("");
  const [empresaFinalId, setEmpresaFinalId] = useState("");
  const [cargoFinalId, setCargoFinalId] = useState("");
  const [equipeFinalId, setEquipeFinalId] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);

  const { data: aditivos = [], isLoading } = useQuery({
    queryKey: ["rh_aditivos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_aditivos")
        .select("*, rh_funcionarios(nome_completo), rh_tipos_aditivo(nome), rh_empresas(nome), rh_cargos(nome), rh_equipes(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({ queryKey: ["rh_funcionarios"], queryFn: async () => { const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo"); return data || []; }});
  const { data: tiposAditivo = [] } = useQuery({ queryKey: ["rh_tipos_aditivo"], queryFn: async () => { const { data } = await supabase.from("rh_tipos_aditivo").select("*").order("nome"); return data || []; }});
  const { data: empresas = [] } = useQuery({ queryKey: ["rh_empresas"], queryFn: async () => { const { data } = await supabase.from("rh_empresas").select("*").order("nome"); return data || []; }});
  const { data: equipes = [] } = useQuery({ queryKey: ["rh_equipes"], queryFn: async () => { const { data } = await supabase.from("rh_equipes").select("*").order("nome"); return data || []; }});
  const { data: cargos = [] } = useQuery({ queryKey: ["rh_cargos"], queryFn: async () => { const { data } = await supabase.from("rh_cargos").select("*").order("nome"); return data || []; }});

  const saveMutation = useMutation({
    mutationFn: async () => {
      let anexo_path: string | null = null;
      let anexo_name: string | null = null;
      if (file) {
        const path = `aditivos/${funcId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_path = path; anexo_name = file.name;
      }
      const payload: any = {
        funcionario_id: funcId,
        tipo_aditivo_id: tipoAditivoId || null,
        empresa_final_id: empresaFinalId || null,
        cargo_final_id: cargoFinalId || null,
        equipe_final_id: equipeFinalId || null,
        data, observacoes: obs || null,
      };
      if (file) { payload.anexo_path = anexo_path; payload.anexo_name = anexo_name; }

      if (editingId) {
        const { error } = await supabase.from("rh_aditivos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.anexo_path = anexo_path;
        payload.anexo_name = anexo_name;
        const { error } = await supabase.from("rh_aditivos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_aditivos"] });
      toast.success(editingId ? "Aditivo atualizado." : "Aditivo salvo.");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar aditivo."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_path: string | null }) => {
      if (r.anexo_path) await supabase.storage.from("rh-anexos").remove([r.anexo_path]);
      const { error } = await supabase.from("rh_aditivos").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_aditivos"] }); toast.success("Aditivo excluído."); },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null); setFuncId(""); setTipoAditivoId(""); setEmpresaFinalId(""); setCargoFinalId("");
    setEquipeFinalId(""); setData(""); setObs(""); setFile(null);
    setDialogOpen(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id); setFuncId(a.funcionario_id); setTipoAditivoId(a.tipo_aditivo_id || "");
    setEmpresaFinalId(a.empresa_final_id || ""); setCargoFinalId(a.cargo_final_id || "");
    setEquipeFinalId(a.equipe_final_id || ""); setData(a.data); setObs(a.observacoes || ""); setFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };
  const filtered = filterFunc ? aditivos.filter((a: any) => a.funcionario_id === filterFunc) : aditivos;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Aditivos Contratuais</h1>
          <p className="text-muted-foreground">Gerencie aditivos contratuais dos colaboradores.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Aditivo</Button>
      </div>

      <div className="max-w-sm">
        <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Funcionário</TableHead><TableHead>Tipo</TableHead>
            <TableHead>Empresa Final</TableHead><TableHead>Cargo Final</TableHead><TableHead>Equipe Final</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum aditivo.</TableCell></TableRow>
            : filtered.map((a: any) => (
              <TableRow key={a.id}>
                <TableCell>{a.data}</TableCell>
                <TableCell className="font-medium">{a.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell>{a.rh_tipos_aditivo?.nome || "—"}</TableCell>
                <TableCell>{a.rh_empresas?.nome || "—"}</TableCell>
                <TableCell>{a.rh_cargos?.nome || "—"}</TableCell>
                <TableCell>{a.rh_equipes?.nome || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(a)}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(a)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Aditivo" : "Novo Aditivo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
              <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Tipo de Aditivo</label>
                <Combobox options={tiposAditivo.map((t: any) => ({ value: t.id, label: t.nome }))} value={tipoAditivoId} onValueChange={setTipoAditivoId} placeholder="Selecione" />
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Data *</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Empresa Final</label>
              <Combobox options={empresas.map((e: any) => ({ value: e.id, label: e.nome }))} value={empresaFinalId} onValueChange={setEmpresaFinalId} placeholder="Selecione" />
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Cargo Final</label>
              <Combobox options={cargos.map((c: any) => ({ value: c.id, label: c.nome }))} value={cargoFinalId} onValueChange={setCargoFinalId} placeholder="Selecione" />
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Equipe Final</label>
              <Combobox options={equipes.map((e: any) => ({ value: e.id, label: e.nome }))} value={equipeFinalId} onValueChange={setEquipeFinalId} placeholder="Selecione" />
            </div>
            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Anexo</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-3 w-3" /> Selecionar</Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!funcId || !data || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
