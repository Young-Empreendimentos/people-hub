import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ExternalLink } from "lucide-react";

export default function Atividades() {
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();

  const [grupoDialogOpen, setGrupoDialogOpen] = useState(false);
  const [editingGrupoId, setEditingGrupoId] = useState<string | null>(null);
  const [grupoNome, setGrupoNome] = useState("");
  const [grupoResponsavelId, setGrupoResponsavelId] = useState("");

  const [atividadeDialogOpen, setAtividadeDialogOpen] = useState(false);
  const [editingAtividadeId, setEditingAtividadeId] = useState<string | null>(null);
  const [atividadeGrupoId, setAtividadeGrupoId] = useState("");
  const [atividadeDescricao, setAtividadeDescricao] = useState("");
  const [atividadeManualLink, setAtividadeManualLink] = useState("");
  const [atividadeMetodos, setAtividadeMetodos] = useState("");
  const [atividadeResponsavelId, setAtividadeResponsavelId] = useState("");

  const { data: grupos = [], isLoading } = useQuery({
    queryKey: ["rh_grupos_atividades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_grupos_atividades").select("*, rh_funcionarios(nome_completo)").order("nome");
      if (error) throw error;
      return data;
    },
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["rh_atividades"],
    queryFn: async () => {
      const { data, error } = await supabase.from("rh_atividades").select("*, rh_funcionarios(nome_completo)").order("descricao");
      if (error) throw error;
      return data;
    },
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios"],
    queryFn: async () => { const { data } = await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo"); return data || []; },
  });

  const saveGrupo = useMutation({
    mutationFn: async () => {
      const payload = { nome: grupoNome, responsavel_id: grupoResponsavelId || null };
      if (editingGrupoId) {
        const { error } = await supabase.from("rh_grupos_atividades").update(payload).eq("id", editingGrupoId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_grupos_atividades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_grupos_atividades"] }); toast.success("Grupo salvo."); setGrupoDialogOpen(false); },
    onError: () => toast.error("Erro ao salvar grupo."),
  });

  const deleteGrupo = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("rh_grupos_atividades").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_grupos_atividades"] }); queryClient.invalidateQueries({ queryKey: ["rh_atividades"] }); toast.success("Grupo excluído."); },
    onError: () => toast.error("Erro ao excluir grupo."),
  });

  const saveAtividade = useMutation({
    mutationFn: async () => {
      const payload = {
        grupo_id: atividadeGrupoId,
        descricao: atividadeDescricao,
        manual_link: atividadeManualLink || null,
        metodos_auditoria: atividadeMetodos || null,
        responsavel_id: atividadeResponsavelId || null,
      };
      if (editingAtividadeId) {
        const { error } = await supabase.from("rh_atividades").update(payload).eq("id", editingAtividadeId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_atividades").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_atividades"] }); toast.success("Atividade salva."); setAtividadeDialogOpen(false); },
    onError: () => toast.error("Erro ao salvar atividade."),
  });

  const deleteAtividade = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("rh_atividades").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["rh_atividades"] }); toast.success("Atividade excluída."); },
    onError: () => toast.error("Erro ao excluir atividade."),
  });

  const openNewGrupo = () => { setEditingGrupoId(null); setGrupoNome(""); setGrupoResponsavelId(""); setGrupoDialogOpen(true); };
  const openEditGrupo = (g: any) => { setEditingGrupoId(g.id); setGrupoNome(g.nome); setGrupoResponsavelId(g.responsavel_id || ""); setGrupoDialogOpen(true); };

  const openNewAtividade = (grupoId: string) => {
    setEditingAtividadeId(null); setAtividadeGrupoId(grupoId); setAtividadeDescricao("");
    setAtividadeManualLink(""); setAtividadeMetodos(""); setAtividadeResponsavelId("");
    setAtividadeDialogOpen(true);
  };

  const openEditAtividade = (a: any) => {
    setEditingAtividadeId(a.id); setAtividadeGrupoId(a.grupo_id); setAtividadeDescricao(a.descricao);
    setAtividadeManualLink(a.manual_link || ""); setAtividadeMetodos(a.metodos_auditoria || "");
    setAtividadeResponsavelId(a.responsavel_id || ""); setAtividadeDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Grupos de Atividades</h1>
          <p className="text-muted-foreground">Gerencie grupos de atividades e suas atividades associadas.</p>
        </div>
        <Button onClick={openNewGrupo}><Plus className="mr-2 h-4 w-4" /> Novo Grupo</Button>
      </div>

      {isLoading ? <p className="text-muted-foreground">Carregando...</p>
      : grupos.length === 0 ? <Card><CardContent className="py-8 text-center text-muted-foreground">Nenhum grupo cadastrado.</CardContent></Card>
      : (
        <Accordion type="multiple" className="space-y-2">
          {grupos.map((grupo: any) => {
            const grupoAtividades = atividades.filter((a: any) => a.grupo_id === grupo.id);
            return (
              <AccordionItem key={grupo.id} value={grupo.id} className="border rounded-lg px-4">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3">
                    <span className="font-semibold">{grupo.nome}</span>
                    {grupo.rh_funcionarios?.nome_completo && (
                      <span className="text-xs text-muted-foreground">Resp: {grupo.rh_funcionarios.nome_completo}</span>
                    )}
                    <span className="text-xs text-muted-foreground">({grupoAtividades.length} atividades)</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => openEditGrupo(grupo)}><Pencil className="mr-1 h-3 w-3" /> Editar</Button>
                      {canDelete && <Button size="sm" variant="outline" className="text-destructive" onClick={() => deleteGrupo.mutate(grupo.id)}><Trash2 className="mr-1 h-3 w-3" /> Excluir</Button>}
                      <Button size="sm" onClick={() => openNewAtividade(grupo.id)}><Plus className="mr-1 h-3 w-3" /> Nova Atividade</Button>
                    </div>
                    {grupoAtividades.length > 0 && (
                      <Table>
                        <TableHeader><TableRow>
                          <TableHead>Descrição</TableHead><TableHead>Manual</TableHead><TableHead>Métodos Auditoria</TableHead>
                          <TableHead>Responsável</TableHead><TableHead className="w-24 text-right">Ações</TableHead>
                        </TableRow></TableHeader>
                        <TableBody>
                          {grupoAtividades.map((a: any) => (
                            <TableRow key={a.id}>
                              <TableCell>{a.descricao}</TableCell>
                              <TableCell>
                                {a.manual_link ? (
                                  <a href={a.manual_link} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-1">
                                    Link <ExternalLink className="h-3 w-3" />
                                  </a>
                                ) : "—"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">{a.metodos_auditoria || "—"}</TableCell>
                              <TableCell>{a.rh_funcionarios?.nome_completo || "—"}</TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1">
                                  <Button variant="ghost" size="icon" onClick={() => openEditAtividade(a)}><Pencil className="h-4 w-4" /></Button>
                                  {canDelete && <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteAtividade.mutate(a.id)}><Trash2 className="h-4 w-4" /></Button>}
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      )}

      {/* Grupo Dialog */}
      <Dialog open={grupoDialogOpen} onOpenChange={setGrupoDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGrupoId ? "Editar Grupo" : "Novo Grupo"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Nome *</label><Input value={grupoNome} onChange={(e) => setGrupoNome(e.target.value)} placeholder="Ex: Contas a Receber" /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Responsável</label>
              <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={grupoResponsavelId} onValueChange={setGrupoResponsavelId} placeholder="Selecione" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveGrupo.mutate()} disabled={!grupoNome.trim() || saveGrupo.isPending}>{saveGrupo.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Atividade Dialog */}
      <Dialog open={atividadeDialogOpen} onOpenChange={setAtividadeDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingAtividadeId ? "Editar Atividade" : "Nova Atividade"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2"><label className="text-sm font-medium">Descrição *</label><Input value={atividadeDescricao} onChange={(e) => setAtividadeDescricao(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Manual (link)</label><Input value={atividadeManualLink} onChange={(e) => setAtividadeManualLink(e.target.value)} placeholder="https://..." /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Métodos de Auditoria</label><Textarea value={atividadeMetodos} onChange={(e) => setAtividadeMetodos(e.target.value)} /></div>
            <div className="space-y-2"><label className="text-sm font-medium">Responsável</label>
              <Combobox options={funcionarios.map((f: any) => ({ value: f.id, label: f.nome_completo }))} value={atividadeResponsavelId} onValueChange={setAtividadeResponsavelId} placeholder="Selecione" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtividadeDialogOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveAtividade.mutate()} disabled={!atividadeDescricao.trim() || saveAtividade.isPending}>{saveAtividade.isPending ? "Salvando..." : "Salvar"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
