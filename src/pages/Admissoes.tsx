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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, Trash2, Upload } from "lucide-react";
import { maskCPF, maskRG, isValidCPF } from "@/lib/masks";

export default function Admissoes() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Tabs
  const [activeTab, setActiveTab] = useState<"admissao" | "desligamento">("admissao");

  // Filters
  const [filterFunc, setFilterFunc] = useState("");
  const [filterEmpresa, setFilterEmpresa] = useState("");
  const [filterEquipe, setFilterEquipe] = useState("");
  const [filterDataDe, setFilterDataDe] = useState("");
  const [filterDataAte, setFilterDataAte] = useState("");

  // Form - admission fields
  const [tipo, setTipo] = useState("admissao");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [file, setFile] = useState<File | null>(null);

  // Form - employee fields (for new admission)
  const [funcId, setFuncId] = useState("");
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [rg, setRg] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [dataContratoVigente, setDataContratoVigente] = useState("");
  const [cpfError, setCpfError] = useState("");

  const { data: registros = [], isLoading } = useQuery({
    queryKey: ["rh_admissoes_desligamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*, rh_funcionarios(nome_completo, empresa_id, equipe_id)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => { const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo"); return data || []; },
  });
  const { data: empresas = [] } = useQuery({
    queryKey: ["rh_empresas"],
    queryFn: async () => { const { data } = await supabase.from("rh_empresas").select("*").order("nome"); return data || []; },
  });
  const { data: equipes = [] } = useQuery({
    queryKey: ["rh_equipes"],
    queryFn: async () => { const { data } = await supabase.from("rh_equipes").select("*").order("nome"); return data || []; },
  });
  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos"],
    queryFn: async () => { const { data } = await supabase.from("rh_cargos").select("*, rh_trilhas_cargo(nome)").order("nome"); return data || []; },
  });

  const isNewAdmission = tipo === "admissao" && !editingId;

  const saveMutation = useMutation({
    mutationFn: async () => {
      let targetFuncId = funcId;

      // If new admission, create employee first
      if (isNewAdmission && !funcId) {
        if (!nomeCompleto.trim()) throw new Error("Nome é obrigatório.");
        if (cpf && !isValidCPF(cpf)) throw new Error("CPF inválido.");

        const employeePayload = {
          nome_completo: nomeCompleto.trim(),
          rg: rg || null,
          cpf: cpf || null,
          endereco: endereco || null,
          aniversario: aniversario || null,
          empresa_id: empresaId || null,
          equipe_id: equipeId || null,
          cargo_id: cargoId || null,
          data_contrato_vigente: dataContratoVigente || data || null,
        };
        const { data: newFunc, error: funcError } = await supabase
          .from("rh_funcionarios")
          .insert(employeePayload)
          .select("id")
          .single();
        if (funcError) throw funcError;
        targetFuncId = newFunc.id;
      }

      if (!targetFuncId) throw new Error("Funcionário é obrigatório.");

      let anexo_path: string | null = null;
      let anexo_name: string | null = null;
      if (file) {
        const path = `admissoes/${targetFuncId}/${Date.now()}_${file.name}`;
        const { error } = await supabase.storage.from("rh-anexos").upload(path, file);
        if (error) throw error;
        anexo_path = path; anexo_name = file.name;
      }
      const payload: any = {
        funcionario_id: targetFuncId,
        tipo,
        data,
        observacoes: obs || null,
      };
      if (file) { payload.anexo_path = anexo_path; payload.anexo_name = anexo_name; }

      if (editingId) {
        const { error } = await supabase.from("rh_admissoes_desligamentos").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        payload.anexo_path = anexo_path;
        payload.anexo_name = anexo_name;
        const { error } = await supabase.from("rh_admissoes_desligamentos").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_admissoes_desligamentos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_status_funcionarios"] });
      queryClient.invalidateQueries({ queryKey: ["rh_funcionarios"] });
      toast.success(editingId ? "Registro atualizado." : "Registro salvo.");
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar registro."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: { id: string; anexo_path: string | null }) => {
      if (r.anexo_path) await supabase.storage.from("rh-anexos").remove([r.anexo_path]);
      const { error } = await supabase.from("rh_admissoes_desligamentos").delete().eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_admissoes_desligamentos"] });
      toast.success("Registro excluído.");
    },
    onError: () => toast.error("Erro ao excluir registro."),
  });

  const openNew = () => {
    setEditingId(null); setFuncId(""); setTipo("admissao"); setData(""); setObs(""); setFile(null);
    setNomeCompleto(""); setRg(""); setCpf(""); setEndereco(""); setAniversario("");
    setEmpresaId(""); setEquipeId(""); setCargoId(""); setDataContratoVigente(""); setCpfError("");
    setDialogOpen(true);
  };

  const openEdit = (r: any) => {
    setEditingId(r.id);
    setFuncId(r.funcionario_id); setTipo(r.tipo); setData(r.data); setObs(r.observacoes || ""); setFile(null);
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const filtered = registros.filter((r: any) => {
    if (r.tipo !== activeTab) return false;
    if (filterFunc && r.funcionario_id !== filterFunc) return false;
    if (filterEmpresa && r.rh_funcionarios?.empresa_id !== filterEmpresa) return false;
    if (filterEquipe && r.rh_funcionarios?.equipe_id !== filterEquipe) return false;
    if (filterDataDe && r.data < filterDataDe) return false;
    if (filterDataAte && r.data > filterDataAte) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-4">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList>
            <TabsTrigger value="admissao">Admissões</TabsTrigger>
            <TabsTrigger value="desligamento">Desligamentos</TabsTrigger>
          </TabsList>
        </Tabs>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Registro</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Combobox options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo }))} value={filterFunc} onValueChange={setFilterFunc} placeholder="Filtrar por funcionário" />
        <Combobox options={empresas.map((e: any) => ({ value: e.id, label: e.nome }))} value={filterEmpresa} onValueChange={setFilterEmpresa} placeholder="Filtrar por empresa" />
        <Combobox options={equipes.map((e: any) => ({ value: e.id, label: e.nome }))} value={filterEquipe} onValueChange={setFilterEquipe} placeholder="Filtrar por equipe" />
        <Input type="date" value={filterDataDe} onChange={(e) => setFilterDataDe(e.target.value)} placeholder="Data de" />
        <Input type="date" value={filterDataAte} onChange={(e) => setFilterDataAte(e.target.value)} placeholder="Data até" />
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead><TableHead>Funcionário</TableHead>
            <TableHead>Observações</TableHead><TableHead>Anexo</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            : filtered.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum registro.</TableCell></TableRow>
            : filtered.map((r: any) => (
              <TableRow key={r.id}>
                <TableCell>{r.data}</TableCell>
                <TableCell className="font-medium">{r.rh_funcionarios?.nome_completo || "—"}</TableCell>
                <TableCell className="max-w-[200px] truncate">{r.observacoes || "—"}</TableCell>
                <TableCell>{r.anexo_name || "—"}</TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                    {canDelete && (
                      <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteMutation.mutate(r)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Registro" : "Novo Registro"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><label className="text-sm font-medium">Tipo *</label>
                <Combobox options={[{ value: "admissao", label: "Admissão" }, { value: "desligamento", label: "Desligamento" }]} value={tipo} onValueChange={setTipo} />
              </div>
              <div className="space-y-2"><label className="text-sm font-medium">Data *</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
            </div>

            {/* For editing or desligamento, select existing employee */}
            {(editingId || tipo === "desligamento") && (
              <div className="space-y-2"><label className="text-sm font-medium">Funcionário *</label>
                <Combobox options={funcionarios.map((f) => ({ value: f.id, label: f.nome_completo }))} value={funcId} onValueChange={setFuncId} placeholder="Selecione o funcionário" />
              </div>
            )}

            {/* For new admission, show employee creation fields */}
            {isNewAdmission && (
              <>
                <div className="border-t pt-4">
                  <p className="text-sm font-semibold text-muted-foreground mb-3">Dados do novo funcionário</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Nome Completo *</label>
                  <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} placeholder="Nome completo do colaborador" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">RG</label>
                    <Input value={rg} onChange={(e) => setRg(maskRG(e.target.value))} placeholder="00.000.000-0" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-sm font-medium">CPF</label>
                    <Input value={cpf} onChange={(e) => { setCpf(maskCPF(e.target.value)); setCpfError(""); }} placeholder="000.000.000-00" className={cpfError ? "border-destructive" : ""} />
                    {cpfError && <p className="text-xs text-destructive">{cpfError}</p>}
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Endereço</label>
                  <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Aniversário</label>
                    <Input type="date" value={aniversario} onChange={(e) => setAniversario(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Data Contrato Vigente</label>
                    <Input type="date" value={dataContratoVigente} onChange={(e) => setDataContratoVigente(e.target.value)} />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Empresa Contratante</label>
                  <Combobox options={empresas.map((e: any) => ({ value: e.id, label: e.nome }))} value={empresaId} onValueChange={setEmpresaId} placeholder="Selecione a empresa" />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Equipe</label>
                    <Combobox options={equipes.map((e: any) => ({ value: e.id, label: e.nome }))} value={equipeId} onValueChange={setEquipeId} placeholder="Selecione a equipe" />
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Cargo</label>
                    <Combobox options={cargos.map((c: any) => ({ value: c.id, label: c.nome }))} value={cargoId} onValueChange={setCargoId} placeholder="Selecione o cargo" />
                  </div>
                </div>
              </>
            )}

            <div className="space-y-2"><label className="text-sm font-medium">Observações</label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Anexo</label>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}><Upload className="mr-1 h-3 w-3" /> Selecionar arquivo</Button>
                <span className="text-sm text-muted-foreground">{file?.name || "Nenhum arquivo"}</span>
                <input ref={fileRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!data || saveMutation.isPending || (editingId && !funcId) || (tipo === "desligamento" && !funcId) || (isNewAdmission && !nomeCompleto.trim())}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
