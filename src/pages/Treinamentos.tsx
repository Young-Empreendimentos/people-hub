import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Search, GraduationCap } from "lucide-react";

export default function Treinamentos() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
  const { funcionarios, isActive } = useActiveEmployees();
  const activeFuncs = (funcionarios as any[]).filter((f) => isActive(f.id));

  const [dialogOpen, setDialogOpen] = useState(false);
  const [tipoDialogOpen, setTipoDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [tipoTreinamentoId, setTipoTreinamentoId] = useState("");
  const [data, setData] = useState("");
  const [obs, setObs] = useState("");
  const [selectedParticipantes, setSelectedParticipantes] = useState<Set<string>>(new Set());
  const [participantSearch, setParticipantSearch] = useState("");
  const [novoTipoNome, setNovoTipoNome] = useState("");
  const [search, setSearch] = useState("");

  // Queries
  const { data: tipos = [] } = useQuery({
    queryKey: ["rh_tipos_treinamento"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_tipos_treinamento").select("*").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: treinamentos = [], isLoading } = useQuery({
    queryKey: ["rh_treinamentos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_treinamentos")
        .select("*, rh_tipos_treinamento(nome)")
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: allParticipantes = [] } = useQuery({
    queryKey: ["rh_treinamento_participantes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_treinamento_participantes")
        .select("*, rh_funcionarios(nome_completo)");
      if (error) throw error;
      return data;
    },
  });

  const getParticipantes = (treinamentoId: string) =>
    allParticipantes.filter((p: any) => p.treinamento_id === treinamentoId);

  // Mutations
  const saveTipo = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("rh_tipos_treinamento").insert({ nome: novoTipoNome.trim() });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_tipos_treinamento"] });
      toast.success("Tipo de treinamento criado.");
      setTipoDialogOpen(false);
      setNovoTipoNome("");
    },
    onError: () => toast.error("Erro ao criar tipo."),
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (selectedParticipantes.size === 0) throw new Error("Selecione ao menos um participante.");

      let treinamentoId = editingId;

      if (editingId) {
        const { error } = await supabase
          .from("rh_treinamentos")
          .update({ tipo_treinamento_id: tipoTreinamentoId, data, observacoes: obs || null })
          .eq("id", editingId);
        if (error) throw error;
        // Remove old participants and re-insert
        await supabase.from("rh_treinamento_participantes").delete().eq("treinamento_id", editingId);
      } else {
        const { data: newRow, error } = await supabase
          .from("rh_treinamentos")
          .insert({ tipo_treinamento_id: tipoTreinamentoId, data, observacoes: obs || null })
          .select("id")
          .single();
        if (error) throw error;
        treinamentoId = newRow.id;
      }

      const rows = Array.from(selectedParticipantes).map((fid) => ({
        treinamento_id: treinamentoId!,
        funcionario_id: fid,
      }));
      const { error: pError } = await supabase.from("rh_treinamento_participantes").insert(rows);
      if (pError) throw pError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_treinamentos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_treinamento_participantes"] });
      toast.success(editingId ? "Treinamento atualizado." : "Treinamento registrado.");
      closeDialog();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar."),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_treinamentos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_treinamentos"] });
      queryClient.invalidateQueries({ queryKey: ["rh_treinamento_participantes"] });
      toast.success("Treinamento excluído.");
    },
    onError: () => toast.error("Erro ao excluir."),
  });

  const openNew = () => {
    setEditingId(null);
    setTipoTreinamentoId("");
    setData("");
    setObs("");
    setSelectedParticipantes(new Set());
    setParticipantSearch("");
    setDialogOpen(true);
  };

  const openEdit = (t: any) => {
    setEditingId(t.id);
    setTipoTreinamentoId(t.tipo_treinamento_id);
    setData(t.data);
    setObs(t.observacoes || "");
    const parts = getParticipantes(t.id).map((p: any) => p.funcionario_id);
    setSelectedParticipantes(new Set(parts));
    setParticipantSearch("");
    setDialogOpen(true);
  };

  const closeDialog = () => { setDialogOpen(false); setEditingId(null); };

  const toggleParticipante = (id: string) => {
    setSelectedParticipantes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const filtered = activeFuncs.filter((f: any) =>
      f.nome_completo.toLowerCase().includes(participantSearch.toLowerCase())
    );
    setSelectedParticipantes(new Set(filtered.map((f: any) => f.id)));
  };

  const selectNone = () => setSelectedParticipantes(new Set());

  const filtered = treinamentos.filter((t: any) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const tipoNome = (t.rh_tipos_treinamento as any)?.nome || "";
    return tipoNome.toLowerCase().includes(q) || t.data.includes(q);
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Button onClick={openNew}><Plus className="mr-2 h-4 w-4" /> Novo Treinamento</Button>
        {canDelete && (
          <Button variant="outline" onClick={() => setTipoDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Novo Tipo
          </Button>
        )}
        <div className="relative max-w-sm flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar treinamento..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Data</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Participantes</TableHead>
            <TableHead>Observações</TableHead>
            <TableHead className="w-24 text-right">Ações</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Nenhum treinamento registrado.</TableCell></TableRow>
            ) : filtered.map((t: any) => {
              const parts = getParticipantes(t.id);
              return (
                <TableRow key={t.id}>
                  <TableCell>{t.data}</TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      <GraduationCap className="h-3 w-3 mr-1" />
                      {(t.rh_tipos_treinamento as any)?.nome || "—"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">{parts.length} pessoa{parts.length !== 1 ? "s" : ""}</span>
                  </TableCell>
                  <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">{t.observacoes || "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(t)}><Pencil className="h-4 w-4" /></Button>
                      {canDelete && (
                        <Button variant="ghost" size="icon" className="text-destructive hover:text-destructive" onClick={() => deleteMutation.mutate(t.id)}>
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

      {/* Training dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar Treinamento" : "Novo Treinamento"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Tipo de Treinamento *</label>
                <Combobox
                  options={tipos.map((t: any) => ({ value: t.id, label: t.nome }))}
                  value={tipoTreinamentoId}
                  onValueChange={setTipoTreinamentoId}
                  placeholder="Selecione o tipo"
                />
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium">Data *</label>
                <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Observações</label>
              <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Observações opcionais" />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">
                  Participantes * <span className="text-muted-foreground font-normal">({selectedParticipantes.size} selecionados)</span>
                </label>
                <div className="flex gap-2">
                  <button onClick={selectAll} className="text-xs text-primary hover:underline">Selecionar todos</button>
                  <button onClick={selectNone} className="text-xs text-muted-foreground hover:underline">Limpar</button>
                </div>
              </div>
              <Input
                placeholder="Buscar funcionário..."
                value={participantSearch}
                onChange={(e) => setParticipantSearch(e.target.value)}
                className="mb-2"
              />
              <div className="border rounded-md max-h-[200px] overflow-y-auto">
                {activeFuncs
                  .filter((f: any) => f.nome_completo.toLowerCase().includes(participantSearch.toLowerCase()))
                  .map((f: any) => (
                    <label
                      key={f.id}
                      className="flex items-center gap-3 px-3 py-2 hover:bg-muted/50 cursor-pointer text-sm border-b last:border-0"
                    >
                      <Checkbox
                        checked={selectedParticipantes.has(f.id)}
                        onCheckedChange={() => toggleParticipante(f.id)}
                      />
                      <span className="flex-1 truncate">{f.nome_completo}</span>
                      <span className="text-xs text-muted-foreground truncate">{f.rh_cargos?.nome || ""}</span>
                    </label>
                  ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!tipoTreinamentoId || !data || selectedParticipantes.size === 0 || saveMutation.isPending}
            >
              {saveMutation.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* New tipo dialog */}
      <Dialog open={tipoDialogOpen} onOpenChange={setTipoDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Novo Tipo de Treinamento</DialogTitle></DialogHeader>
          <div className="space-y-2 py-2">
            <label className="text-sm font-medium">Nome</label>
            <Input value={novoTipoNome} onChange={(e) => setNovoTipoNome(e.target.value)} placeholder="Ex: NR-35, Integração" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTipoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveTipo.mutate()} disabled={!novoTipoNome.trim() || saveTipo.isPending}>
              {saveTipo.isPending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
