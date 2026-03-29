import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Pencil, Trash2, Search, Eye, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { maskCPF, maskRG, isValidCPF } from "@/lib/masks";

export default function Funcionarios() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [filterEmpresaId, setFilterEmpresaId] = useState("");
  const [filterEquipeId, setFilterEquipeId] = useState("");

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

  const { funcionarios, statusMap, isActive, activeCount, isLoading } = useActiveEmployees();

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

  const validateForm = () => {
    if (!nomeCompleto.trim()) { toast.error("Nome completo é obrigatório."); return false; }
    if (cpf && !isValidCPF(cpf)) { setCpfError("CPF inválido"); return false; }
    setCpfError("");
    return true;
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nome_completo: nomeCompleto.trim(),
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
      toast.success("Funcionário atualizado.");
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

  const openEdit = (f: any) => {
    setEditingId(f.id);
    setNomeCompleto(f.nome_completo);
    setRg(f.rg || ""); setCpf(f.cpf || ""); setEndereco(f.endereco || "");
    setAniversario(f.aniversario || "");
    setEmpresaId(f.empresa_id || ""); setEquipeId(f.equipe_id || "");
    setCargoId(f.cargo_id || ""); setDataContratoVigente(f.data_contrato_vigente || "");
    setCpfError("");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const handleSubmit = () => {
    if (validateForm()) saveMutation.mutate();
  };

  const filtered = funcionarios.filter((f: any) => {
    if (statusFilter === "ativos" && !isActive(f.id)) return false;
    if (statusFilter === "inativos" && isActive(f.id)) return false;
    if (filterEmpresaId && f.empresa_id !== filterEmpresaId) return false;
    if (filterEquipeId && f.equipe_id !== filterEquipeId) return false;
    return f.nome_completo.toLowerCase().includes(search.toLowerCase());
  });

  const getStatusBadge = (funcId: string) => {
    const st = (statusMap as Record<string, string>)[funcId];
    if (st === "desligamento") return <Badge variant="destructive">Desligado</Badge>;
    if (st === "admissao") return <Badge className="bg-primary hover:bg-primary/90">Ativo</Badge>;
    return <Badge variant="secondary">Sem registro</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Badge variant="secondary" className="text-sm px-3 py-1">
          <Users className="h-3.5 w-3.5 mr-1.5" />
          {activeCount} ativos
        </Badge>
        <Tabs value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="ativos" className="text-xs px-3 h-7">Ativos</TabsTrigger>
            <TabsTrigger value="inativos" className="text-xs px-3 h-7">Inativos</TabsTrigger>
            <TabsTrigger value="todos" className="text-xs px-3 h-7">Todos</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Select value={filterEmpresaId} onValueChange={(v) => setFilterEmpresaId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[220px]"><SelectValue placeholder="Todas as empresas" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as empresas</SelectItem>
            {empresas.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterEquipeId} onValueChange={(v) => setFilterEquipeId(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todas as equipes" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as equipes</SelectItem>
            {equipes.map((e: any) => <SelectItem key={e.id} value={e.id}>{e.nome}</SelectItem>)}
          </SelectContent>
        </Select>
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
          <DialogHeader><DialogTitle>Editar Funcionário</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
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
                <Input
                  value={cpf}
                  onChange={(e) => { setCpf(maskCPF(e.target.value)); setCpfError(""); }}
                  placeholder="000.000.000-00"
                  className={cpfError ? "border-destructive" : ""}
                />
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
              <Combobox options={empresas.map((e) => ({ value: e.id, label: e.nome }))} value={empresaId} onValueChange={setEmpresaId} placeholder="Selecione a empresa" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Equipe</label>
              <Combobox options={equipes.map((e) => ({ value: e.id, label: e.nome }))} value={equipeId} onValueChange={setEquipeId} placeholder="Selecione a equipe" />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cargo</label>
              <Combobox
                options={cargos.map((c: any) => ({
                  value: c.id,
                  label: `${c.rh_trilhas_cargo?.nome ? c.rh_trilhas_cargo.nome + " — " : ""}${c.nome} (Nível ${c.nivel})`,
                }))}
                value={cargoId} onValueChange={setCargoId} placeholder="Selecione o cargo"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button onClick={handleSubmit} disabled={!nomeCompleto.trim() || saveMutation.isPending}>
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
