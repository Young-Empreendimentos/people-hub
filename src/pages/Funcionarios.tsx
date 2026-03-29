import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, Eye } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Funcionarios() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Form fields
  const [nomeCompleto, setNomeCompleto] = useState("");
  const [rg, setRg] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [dataContratoVigente, setDataContratoVigente] = useState("");

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("*, rh_empresas(nome), rh_equipes(nome), rh_cargos(nome)")
        .order("nome_completo");
      if (error) throw error;
      return data;
    },
  });

  const { data: empresas = [] } = useQuery({
    queryKey: ["rh_empresas"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_empresas").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["rh_equipes"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_equipes").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_cargos").select("*, rh_trilhas_cargo(nome)").order("nome");
      if (error) throw error;
      return data;
    },
  });

  // Get status from last admissão/desligamento
  const { data: statusMap = {} } = useQuery({
    queryKey: ["rh_status_funcionarios"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*")
        .order("data", { ascending: false });
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data || []) {
        if (!map[row.funcionario_id]) {
          map[row.funcionario_id] = row.tipo;
        }
      }
      return map;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_completo: nomeCompleto,
        rg: rg || null,
        cpf: cpf || null,
        endereco: endereco || null,
        aniversario: aniversario || null,
        empresa_id: empresaId || null,
        equipe_id: equipeId || null,
        cargo_id: cargoId || null,
        data_contrato_vigente: dataContratoVigente || null,
      };
      if (editingId) {
        const { error } = await supabase.from("rh_funcionarios").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_funcionarios").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionarios"] });
      toast.success(editingId ? "Funcionário atualizado." : "Funcionário cadastrado.");
      closeDialog();
    },
    onError: () => toast.error("Erro ao salvar funcionário."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_funcionarios").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionarios"] });
      toast.success("Funcionário excluído.");
    },
    onError: () => toast.error("Erro ao excluir funcionário."),
  });

  const openNew = () => {
    setEditingId(null);
    setNomeCompleto(""); setRg(""); setCpf(""); setEndereco("");
    setAniversario(""); setEmpresaId(""); setEquipeId(""); setCargoId("");
    setDataContratoVigente("");
    setDialogOpen(true);
  };

  const openEdit = (f: any) => {
    setEditingId(f.id);
    setNomeCompleto(f.nome_completo);
    setRg(f.rg || ""); setCpf(f.cpf || ""); setEndereco(f.endereco || "");
    setAniversario(f.aniversario || "");
    setEmpresaId(f.empresa_id || ""); setEquipeId(f.equipe_id || "");
    setCargoId(f.cargo_id || ""); setDataContratoVigente(f.data_contrato_vigente || "");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false); setEditingId(null);
  };

  const filtered = funcionarios.filter((f) =>
    f.nome_completo.toLowerCase().includes(search.toLowerCase())
  );

  const getStatusBadge = (funcId: string) => {
    const st = (statusMap as Record<string, string>)[funcId];
    if (st === "desligamento") return <Badge variant="destructive">Desligado</Badge>;
    if (st === "admissao") return <Badge className="bg-emerald-600 hover:bg-emerald-700">Ativo</Badge>;
    return <Badge variant="secondary">Sem registro</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Funcionários</h1>
          <p className="text-muted-foreground">Gerencie o cadastro de colaboradores.</p>
        </div>
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Funcionário</Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome..."
          className="pl-9"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum funcionário encontrado.</TableCell></TableRow>
              ) : filtered.map((f: any) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome_completo}</TableCell>
                  <TableCell>{f.cpf || "—"}</TableCell>
                  <TableCell>{f.rh_empresas?.nome || "—"}</TableCell>
                  <TableCell>{f.rh_equipes?.nome || "—"}</TableCell>
                  <TableCell>{f.rh_cargos?.nome || "—"}</TableCell>
                  <TableCell>{getStatusBadge(f.id)}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/funcionarios/${f.id}`)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(f)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(f.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Funcionário" : "Novo Funcionário"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <label className="text-sm font-medium">Nome Completo *</label>
              <Input value={nomeCompleto} onChange={(e) => setNomeCompleto(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">RG</label>
                <Input value={rg} onChange={(e) => setRg(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">CPF</label>
                <Input value={cpf} onChange={(e) => setCpf(e.target.value)} />
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
              <Combobox
                options={empresas.map((e) => ({ value: e.id, label: e.nome }))}
                value={empresaId}
                onValueChange={setEmpresaId}
                placeholder="Selecione a empresa"
                searchPlaceholder="Buscar empresa..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipe</label>
              <Combobox
                options={equipes.map((e) => ({ value: e.id, label: e.nome }))}
                value={equipeId}
                onValueChange={setEquipeId}
                placeholder="Selecione a equipe"
                searchPlaceholder="Buscar equipe..."
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo</label>
              <Combobox
                options={cargos.map((c: any) => ({
                  value: c.id,
                  label: `${c.rh_trilhas_cargo?.nome ? c.rh_trilhas_cargo.nome + " — " : ""}${c.nome} (Nível ${c.nivel})`,
                }))}
                value={cargoId}
                onValueChange={setCargoId}
                placeholder="Selecione o cargo"
                searchPlaceholder="Buscar cargo..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!nomeCompleto.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
