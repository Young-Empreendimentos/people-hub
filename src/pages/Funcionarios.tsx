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
import { Pencil, Trash2, Search, Eye, Users, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { maskCPF, maskRG, maskPhone, isValidCPF } from "@/lib/masks";
import { SortAlphaToggle, sortByName, type SortAlpha } from "@/components/SortAlphaToggle";

export default function Funcionarios() {
  const queryClient = useQueryClient();
  const { canDelete, canEditCargoSalario } = useAuth();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ativos" | "inativos" | "todos">("ativos");
  const [filterEmpresaId, setFilterEmpresaId] = useState("");
  const [filterEquipeId, setFilterEquipeId] = useState("");
  const [filterTipoContrato, setFilterTipoContrato] = useState("");

  const [nomeCompleto, setNomeCompleto] = useState("");
  const [rg, setRg] = useState("");
  const [cpf, setCpf] = useState("");
  const [endereco, setEndereco] = useState("");
  const [telefone, setTelefone] = useState("");
  const [aniversario, setAniversario] = useState("");
  const [empresaId, setEmpresaId] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [cargoId, setCargoId] = useState("");
  const [dataContratoVigente, setDataContratoVigente] = useState("");
  const [gestorId, setGestorId] = useState("");
  const [tipoContrato, setTipoContrato] = useState("");
  const [valorKm, setValorKm] = useState("");
  const [cpfError, setCpfError] = useState("");

  const TIPO_CONTRATO_OPTIONS = [
    { value: "CLT", label: "CLT" },
    { value: "PJ", label: "PJ" },
    { value: "Temporário", label: "Temporário" },
    { value: "Estágio", label: "Estágio" },
    { value: "Menor aprendiz", label: "Menor aprendiz" },
    { value: "S/ DOC", label: "S/ DOC" },
  ];

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

  const { data: ultimoAditivoPorFunc = {} } = useQuery({
    queryKey: ["rh_aditivos_ultimo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_aditivos")
        .select("funcionario_id, cargo_final_id, empresa_final_id, equipe_final_id, data")
        .order("data", { ascending: false })
        .order("created_at", { ascending: false });
      const map: Record<string, { cargo_final_id: string | null; empresa_final_id: string | null; equipe_final_id: string | null }> = {};
      for (const row of data || []) {
        const cur = map[row.funcionario_id] || { cargo_final_id: null, empresa_final_id: null, equipe_final_id: null };
        // pega o mais recente de cada campo (data desc)
        if (cur.cargo_final_id == null && row.cargo_final_id) cur.cargo_final_id = row.cargo_final_id;
        if (cur.empresa_final_id == null && row.empresa_final_id) cur.empresa_final_id = row.empresa_final_id;
        if (cur.equipe_final_id == null && row.equipe_final_id) cur.equipe_final_id = row.equipe_final_id;
        map[row.funcionario_id] = cur;
      }
      return map;
    },
  });

  const { data: planoSaudePorFunc = {} } = useQuery({
    queryKey: ["rh_plano_saude_ultimo"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_plano_saude")
        .select("funcionario_id, mes_referencia, valor_saude, valor_odonto")
        .order("mes_referencia", { ascending: false });
      const map: Record<string, { valor_saude: number | null; valor_odonto: number | null; mes: string }> = {};
      for (const row of (data as any[]) || []) {
        if (!map[row.funcionario_id]) {
          map[row.funcionario_id] = {
            valor_saude: row.valor_saude,
            valor_odonto: row.valor_odonto,
            mes: row.mes_referencia,
          };
        }
      }
      return map;
    },
  });

  const cargoMap = Object.fromEntries(cargos.map((c: any) => [c.id, c]));
  const empresaMap = Object.fromEntries(empresas.map((e: any) => [e.id, e]));
  const equipeMap = Object.fromEntries(equipes.map((e: any) => [e.id, e]));

  // Aditivo é a fonte de verdade. Cai para o cadastro do funcionário se não houver.
  const getEffective = (f: any) => {
    const ad = (ultimoAditivoPorFunc as any)[f.id] || {};
    return {
      cargo_id: ad.cargo_final_id || f.cargo_id || null,
      empresa_id: ad.empresa_final_id || f.empresa_id || null,
      equipe_id: ad.equipe_final_id || f.equipe_id || null,
    };
  };

  const getSalario = (f: any): number | null => {
    const { cargo_id } = getEffective(f);
    if (!cargo_id) return null;
    return cargoMap[cargo_id]?.remuneracao ?? null;
  };

  const formatCargoLabel = (cargo: any) => {
    if (!cargo?.nome) return "—";
    return cargo.nivel ? `${cargo.nome} (Nível ${cargo.nivel})` : cargo.nome;
  };

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

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
        telefone: telefone || null,
        aniversario: aniversario || null,
        empresa_id: empresaId || null,
        equipe_id: equipeId || null,
        cargo_id: cargoId || null,
        data_contrato_vigente: dataContratoVigente || null,
        gestor_id: gestorId || null,
        tipo_contrato: tipoContrato || null,
        valor_km: parseFloat(valorKm.replace(",", ".")) || 0,
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
    setRg(f.rg || ""); setCpf(f.cpf || ""); setEndereco(f.endereco || ""); setTelefone(f.telefone || "");
    setAniversario(f.aniversario || "");
    setEmpresaId(f.empresa_id || ""); setEquipeId(f.equipe_id || "");
    setCargoId(f.cargo_id || ""); setDataContratoVigente(f.data_contrato_vigente || "");
    setGestorId(f.gestor_id || "");
    setTipoContrato(f.tipo_contrato || "");
    setValorKm(f.valor_km != null ? String(f.valor_km) : "");
    setCpfError("");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const handleSubmit = () => {
    if (validateForm()) saveMutation.mutate();
  };

  const [sortAlpha, setSortAlpha] = useState<SortAlpha>("none");
  const filteredBase = funcionarios.filter((f: any) => {
    const eff = getEffective(f);
    if (statusFilter === "ativos" && !isActive(f.id)) return false;
    if (statusFilter === "inativos" && isActive(f.id)) return false;
    if (filterEmpresaId && eff.empresa_id !== filterEmpresaId) return false;
    if (filterEquipeId && eff.equipe_id !== filterEquipeId) return false;
    if (filterTipoContrato && f.tipo_contrato !== filterTipoContrato) return false;
    return f.nome_completo.toLowerCase().includes(search.toLowerCase());
  });
  const filtered = sortByName(filteredBase, (f: any) => f.nome_completo || "", sortAlpha);

  const getStatusBadge = (funcId: string) => {
    const st = (statusMap as Record<string, string>)[funcId];
    if (st === "desligamento") return <Badge variant="destructive">Desligado</Badge>;
    if (st === "admissao") return <Badge className="bg-primary hover:bg-primary/90">Ativo</Badge>;
    return <Badge variant="secondary">Sem registro</Badge>;
  };

  const exportarRelatorio = () => {
    if (!filtered.length) { toast.error("Nenhum funcionário para exportar."); return; }
    const headers = [
      "Nome","CPF","RG","Telefone","Endereço","Aniversário",
      "Empresa","Equipe","Cargo","Nível","Salário",
      "Tipo Contrato","Data Contrato Vigente","Status",
    ];
    const statusLabel = (id: string) => {
      const st = (statusMap as Record<string, string>)[id];
      if (st === "desligamento") return "Desligado";
      if (st === "admissao") return "Ativo";
      return "Sem registro";
    };
    const fmtNum = (n: number | null) => n == null ? "" : Number(n).toFixed(2).replace(".", ",");
    const rows = filtered.map((f: any) => {
      const eff = getEffective(f);
      const cargo = eff.cargo_id ? cargoMap[eff.cargo_id] : null;
      return [
        f.nome_completo || "",
        f.cpf || "",
        f.rg || "",
        f.telefone || "",
        (f.endereco || "").replace(/\r?\n/g, " "),
        f.aniversario || "",
        eff.empresa_id ? (empresaMap[eff.empresa_id]?.nome || "") : "",
        eff.equipe_id ? (equipeMap[eff.equipe_id]?.nome || "") : "",
        cargo?.nome || "",
        cargo?.nivel ?? "",
        fmtNum(getSalario(f)),
        f.tipo_contrato || "",
        f.data_contrato_vigente || "",
        statusLabel(f.id),
      ];
    });
    const escape = (v: any) => {
      const s = String(v ?? "");
      return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = [headers, ...rows].map((r) => r.map(escape).join(";")).join("\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `funcionarios_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success(`${filtered.length} funcionário(s) exportado(s).`);
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
        <Select value={filterTipoContrato} onValueChange={(v) => setFilterTipoContrato(v === "all" ? "" : v)}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Todos os contratos" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os contratos</SelectItem>
            {TIPO_CONTRATO_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <SortAlphaToggle value={sortAlpha} onChange={setSortAlpha} className="ml-auto" />
        <Button variant="outline" onClick={exportarRelatorio}>
          <FileDown className="h-4 w-4 mr-2" />
          Gerar relatório
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>CPF</TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Cargo</TableHead>
                <TableHead>Tipo Contrato</TableHead>
                <TableHead>Parque</TableHead>
                <TableHead>Plano de Saúde</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-28 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
              ) : filtered.length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center py-8 text-muted-foreground">Nenhum funcionário encontrado.</TableCell></TableRow>
              ) : filtered.map((f: any) => {
                const eff = getEffective(f);
                const ps = (planoSaudePorFunc as any)[f.id];
                const valorPs = ps ? (Number(ps.valor_saude || 0) + Number(ps.valor_odonto || 0)) : 0;
                return (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.nome_completo}</TableCell>
                  <TableCell>{f.cpf || "—"}</TableCell>
                  <TableCell>{eff.empresa_id ? (empresaMap[eff.empresa_id]?.nome || "—") : "—"}</TableCell>
                  <TableCell>{eff.cargo_id ? formatCargoLabel(cargoMap[eff.cargo_id]) : "—"}</TableCell>
                  <TableCell>{f.tipo_contrato || "—"}</TableCell>
                  <TableCell>{eff.equipe_id ? (equipeMap[eff.equipe_id]?.nome || "—") : "—"}</TableCell>
                  <TableCell>
                    {ps && valorPs > 0 ? (
                      <Badge className="bg-primary hover:bg-primary/90">Sim</Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
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
                );
              })}
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Endereço</label>
                <Input value={endereco} onChange={(e) => setEndereco(e.target.value)} />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Telefone</label>
                <Input value={telefone} onChange={(e) => setTelefone(maskPhone(e.target.value))} placeholder="(00) 00000-0000" />
              </div>
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
                disabled={!canEditCargoSalario}
              />
              {!canEditCargoSalario && <p className="text-xs text-muted-foreground">Apenas coordenadores podem alterar cargos.</p>}
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Gestor Direto</label>
              <Combobox
                options={funcionarios
                  .filter((f: any) => f.id !== editingId)
                  .map((f: any) => ({ value: f.id, label: f.nome_completo }))}
                value={gestorId} onValueChange={setGestorId} placeholder="Selecione o gestor"
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Contrato</label>
                <Combobox options={TIPO_CONTRATO_OPTIONS} value={tipoContrato} onValueChange={setTipoContrato} placeholder="Selecione o tipo de contrato" />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Valor por KM (R$)</label>
                <Input
                  type="number" inputMode="decimal" step="0.0001" min="0"
                  value={valorKm} onChange={(e) => setValorKm(e.target.value)}
                  placeholder="Ex: 1.20"
                />
                <p className="text-[11px] text-muted-foreground">
                  Usado quando o colaborador lança km no Pilares.
                </p>
              </div>
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
