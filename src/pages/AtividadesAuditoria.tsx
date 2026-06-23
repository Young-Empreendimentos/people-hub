import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";

type Atividade = {
  id: string; grupo_id: string; nome: string; peso: number;
  responsavel_funcionario_id: string | null;
  normas: string | null; manuais: string | null; indicadores: string | null;
  metodo_auditoria: string | null;
  ordem: number; ativo: boolean;
  equipe_id: string | null; grupo_nome: string; grupo_peso: number; grupo_ordem: number;
};

export default function AtividadesAuditoria() {
  const qc = useQueryClient();
  const { canConfig } = useAuth();

  const { data: grupos = [] } = useQuery({
    queryKey: ["rh_grupos_atividades_auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_grupos_atividades_auditoria")
        .select("*, rh_equipes(nome)")
        .order("ordem").order("nome");
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: atividades = [] } = useQuery({
    queryKey: ["rh_listar_atividades_auditoria"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_listar_atividades_auditoria");
      if (error) throw error;
      return (data ?? []) as Atividade[];
    },
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["rh_equipes"],
    queryFn: async () => (await supabase.from("rh_equipes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: funcionarios = [] } = useQuery({
    queryKey: ["rh_funcionarios_lite"],
    queryFn: async () => (await supabase.from("rh_funcionarios").select("id, nome_completo").order("nome_completo")).data ?? [],
  });

  const funcNome = (id: string | null) =>
    id ? funcionarios.find((f: any) => f.id === id)?.nome_completo ?? "—" : "—";
  const equipeNome = (id: string | null) =>
    id ? (equipes as any[]).find((e) => e.id === id)?.nome ?? "—" : "—";

  // ===== Filtros =====
  const [filtroGrupo, setFiltroGrupo] = useState("");
  const [filtroResp, setFiltroResp] = useState("");
  const [filtroEquipe, setFiltroEquipe] = useState("");

  const atividadesFiltradas = useMemo(() => {
    return atividades.filter((a) => {
      if (filtroGrupo && a.grupo_id !== filtroGrupo) return false;
      if (filtroResp && a.responsavel_funcionario_id !== filtroResp) return false;
      if (filtroEquipe && a.equipe_id !== filtroEquipe) return false;
      return true;
    });
  }, [atividades, filtroGrupo, filtroResp, filtroEquipe]);

  // ===== CRUD Grupo =====
  const [grupoOpen, setGrupoOpen] = useState(false);
  const [editingGrupo, setEditingGrupo] = useState<any>(null);
  const [gNome, setGNome] = useState("");
  const [gEquipe, setGEquipe] = useState("");
  const [gPeso, setGPeso] = useState("1");
  const [gOrdem, setGOrdem] = useState("0");

  const openNewGrupo = () => { setEditingGrupo(null); setGNome(""); setGEquipe(""); setGPeso("1"); setGOrdem("0"); setGrupoOpen(true); };
  const openEditGrupo = (g: any) => { setEditingGrupo(g); setGNome(g.nome); setGEquipe(g.equipe_id ?? ""); setGPeso(String(g.peso)); setGOrdem(String(g.ordem)); setGrupoOpen(true); };

  const saveGrupo = useMutation({
    mutationFn: async () => {
      const payload = { nome: gNome, equipe_id: gEquipe || null, peso: Number(gPeso), ordem: Number(gOrdem) };
      if (editingGrupo) {
        const { error } = await supabase.from("rh_grupos_atividades_auditoria").update(payload).eq("id", editingGrupo.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_grupos_atividades_auditoria").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Grupo salvo."); setGrupoOpen(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_grupos_atividades_auditoria").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Grupo excluído.");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ===== CRUD Atividade =====
  const [atvOpen, setAtvOpen] = useState(false);
  const [editingAtv, setEditingAtv] = useState<any>(null);
  const [aGrupo, setAGrupo] = useState("");
  const [aNome, setANome] = useState("");
  const [aPeso, setAPeso] = useState("1");
  const [aResp, setAResp] = useState("");
  const [aNormas, setANormas] = useState("");
  const [aManuais, setAManuais] = useState("");
  const [aIndicadores, setAIndicadores] = useState("");
  const [aMetodo, setAMetodo] = useState("");
  const [aOrdem, setAOrdem] = useState("0");

  const openNewAtv = (grupoId?: string) => {
    setEditingAtv(null); setAGrupo(grupoId ?? ""); setANome(""); setAPeso("1");
    setAResp(""); setANormas(""); setAManuais(""); setAIndicadores(""); setAMetodo(""); setAOrdem("0");
    setAtvOpen(true);
  };
  const openEditAtv = (a: Atividade) => {
    setEditingAtv(a);
    setAGrupo(a.grupo_id); setANome(a.nome); setAPeso(String(a.peso));
    setAResp(a.responsavel_funcionario_id ?? ""); setANormas(a.normas ?? "");
    setAManuais(a.manuais ?? ""); setAIndicadores(a.indicadores ?? "");
    setAMetodo(a.metodo_auditoria ?? ""); setAOrdem(String(a.ordem));
    setAtvOpen(true);
  };

  const saveAtv = useMutation({
    mutationFn: async () => {
      const payload = {
        grupo_id: aGrupo, nome: aNome, peso: Number(aPeso),
        responsavel_funcionario_id: aResp || null,
        normas: aNormas || null, manuais: aManuais || null,
        indicadores: aIndicadores || null, metodo_auditoria: aMetodo || null,
        ordem: Number(aOrdem),
      };
      if (editingAtv) {
        const { error } = await supabase.from("rh_atividades_auditoria").update(payload).eq("id", editingAtv.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("rh_atividades_auditoria").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Atividade salva."); setAtvOpen(false);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const deleteAtv = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_atividades_auditoria").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); toast.success("Excluída."); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const grupoOptions = (grupos as any[]).map((g) => ({ value: g.id, label: g.nome }));
  const funcOptions = (funcionarios as any[]).map((f) => ({ value: f.id, label: f.nome_completo }));
  const equipeOptions = (equipes as any[]).map((e) => ({ value: e.id, label: e.nome }));

  const ItemRow = ({ a, showGrupo = false }: { a: Atividade; showGrupo?: boolean }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-medium">{a.nome}</span>
          <Badge variant="secondary">peso {Number(a.peso)}</Badge>
          {showGrupo && <Badge variant="outline">{a.grupo_nome}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <div>Responsável: {funcNome(a.responsavel_funcionario_id)}</div>
          {a.normas && <div>Normas: {a.normas}</div>}
          {a.manuais && <div>Manuais: {a.manuais}</div>}
          {a.indicadores && <div>Indicadores: {a.indicadores}</div>}
          {a.metodo_auditoria
            ? <div className="text-foreground/80"><strong>Método:</strong> {a.metodo_auditoria}</div>
            : <div className="flex items-center gap-1 text-amber-700"><Lock className="h-3 w-3" /> Método restrito</div>}
        </div>
      </div>
      {canConfig && (
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => openEditAtv(a)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Excluir atividade?")) deleteAtv.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Atividades de Auditoria</h1>
          <p className="text-sm text-muted-foreground">Cadastro de grupos e atividades auditáveis.</p>
        </div>
        {canConfig && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={openNewGrupo}><Plus className="mr-2 h-4 w-4" />Novo grupo</Button>
            <Button onClick={() => openNewAtv()}><Plus className="mr-2 h-4 w-4" />Nova atividade</Button>
          </div>
        )}
      </div>

      <Tabs defaultValue="grupo">
        <TabsList>
          <TabsTrigger value="grupo">Por Grupo</TabsTrigger>
          <TabsTrigger value="responsavel">Por Responsável</TabsTrigger>
          <TabsTrigger value="equipe">Por Equipe</TabsTrigger>
        </TabsList>

        <TabsContent value="grupo">
          <div className="flex gap-2 mb-3">
            <Combobox options={grupoOptions} value={filtroGrupo} onValueChange={setFiltroGrupo} placeholder="Filtrar grupo" emptyMessage="—" />
            {filtroGrupo && <Button variant="ghost" onClick={() => setFiltroGrupo("")}>Limpar</Button>}
          </div>
          <Accordion type="multiple" className="space-y-2">
            {(grupos as any[])
              .filter((g) => !filtroGrupo || g.id === filtroGrupo)
              .map((g) => {
                const atvs = atividades.filter((a) => a.grupo_id === g.id);
                return (
                  <AccordionItem value={g.id} key={g.id} className="border rounded-lg px-3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <span className="font-semibold">{g.nome}</span>
                        <Badge variant="secondary">peso grupo {Number(g.peso)}</Badge>
                        <Badge variant="outline">{equipeNome(g.equipe_id)}</Badge>
                        <Badge>{atvs.length} atividades</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {canConfig && (
                        <div className="flex gap-2 mb-2">
                          <Button size="sm" variant="outline" onClick={() => openEditGrupo(g)}><Pencil className="mr-1 h-3 w-3" />Editar grupo</Button>
                          <Button size="sm" variant="outline" onClick={() => openNewAtv(g.id)}><Plus className="mr-1 h-3 w-3" />Atividade neste grupo</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Excluir grupo? As atividades também serão excluídas.")) deleteGrupo.mutate(g.id); }}><Trash2 className="mr-1 h-3 w-3" />Excluir grupo</Button>
                        </div>
                      )}
                      {atvs.length === 0
                        ? <p className="text-sm text-muted-foreground py-2">Nenhuma atividade.</p>
                        : atvs.map((a) => <ItemRow key={a.id} a={a} />)}
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
          </Accordion>
        </TabsContent>

        <TabsContent value="responsavel">
          <div className="flex gap-2 mb-3">
            <Combobox options={funcOptions} value={filtroResp} onValueChange={setFiltroResp} placeholder="Filtrar responsável" emptyMessage="—" />
            {filtroResp && <Button variant="ghost" onClick={() => setFiltroResp("")}>Limpar</Button>}
          </div>
          <Card>
            <CardContent className="pt-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {atividadesFiltradas.map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{funcNome(a.responsavel_funcionario_id)}</TableCell>
                      <TableCell>{a.nome}</TableCell>
                      <TableCell>{a.grupo_nome}</TableCell>
                      <TableCell>{Number(a.peso)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <div className="flex gap-2 mb-3">
            <Combobox options={equipeOptions} value={filtroEquipe} onValueChange={setFiltroEquipe} placeholder="Filtrar equipe" emptyMessage="—" />
            {filtroEquipe && <Button variant="ghost" onClick={() => setFiltroEquipe("")}>Limpar</Button>}
          </div>
          <div className="space-y-3">
            {(equipes as any[])
              .filter((e) => !filtroEquipe || e.id === filtroEquipe)
              .map((e) => {
                const atvs = atividades.filter((a) => a.equipe_id === e.id);
                if (atvs.length === 0) return null;
                return (
                  <Card key={e.id}>
                    <CardHeader><CardTitle className="text-base">{e.nome}</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      {atvs.map((a) => <ItemRow key={a.id} a={a} showGrupo />)}
                    </CardContent>
                  </Card>
                );
              })}
            {atividades.filter((a) => !a.equipe_id).length > 0 && (
              <Card>
                <CardHeader><CardTitle className="text-base">Sem equipe</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {atividades.filter((a) => !a.equipe_id).map((a) => <ItemRow key={a.id} a={a} showGrupo />)}
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialog Grupo */}
      <Dialog open={grupoOpen} onOpenChange={setGrupoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editingGrupo ? "Editar" : "Novo"} grupo</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">Nome</label><Input value={gNome} onChange={(e) => setGNome(e.target.value)} /></div>
            <div><label className="text-sm">Equipe</label>
              <Combobox options={equipeOptions} value={gEquipe} onValueChange={setGEquipe} placeholder="Selecionar equipe (opcional)" emptyMessage="—" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><label className="text-sm">Peso</label><Input type="number" step="0.5" value={gPeso} onChange={(e) => setGPeso(e.target.value)} /></div>
              <div><label className="text-sm">Ordem</label><Input type="number" value={gOrdem} onChange={(e) => setGOrdem(e.target.value)} /></div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGrupoOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveGrupo.mutate()} disabled={!gNome}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Atividade */}
      <Dialog open={atvOpen} onOpenChange={setAtvOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader><DialogTitle>{editingAtv ? "Editar" : "Nova"} atividade</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">Grupo</label>
              <Combobox options={grupoOptions} value={aGrupo} onValueChange={setAGrupo} placeholder="Selecionar grupo" emptyMessage="—" />
            </div>
            <div><label className="text-sm">Nome</label><Input value={aNome} onChange={(e) => setANome(e.target.value)} /></div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="text-sm">Peso</label><Input type="number" step="0.5" value={aPeso} onChange={(e) => setAPeso(e.target.value)} /></div>
              <div><label className="text-sm">Ordem</label><Input type="number" value={aOrdem} onChange={(e) => setAOrdem(e.target.value)} /></div>
              <div className="col-span-1">
                <label className="text-sm">Responsável</label>
                <Combobox options={funcOptions} value={aResp} onValueChange={setAResp} placeholder="—" emptyMessage="—" />
              </div>
            </div>
            <div><label className="text-sm">Normas</label><Textarea rows={2} value={aNormas} onChange={(e) => setANormas(e.target.value)} /></div>
            <div><label className="text-sm">Manuais</label><Textarea rows={2} value={aManuais} onChange={(e) => setAManuais(e.target.value)} /></div>
            <div><label className="text-sm">Indicadores</label><Textarea rows={2} value={aIndicadores} onChange={(e) => setAIndicadores(e.target.value)} /></div>
            <div>
              <label className="text-sm flex items-center gap-1"><Lock className="h-3 w-3" />Método de auditoria (restrito)</label>
              <Textarea rows={3} value={aMetodo} onChange={(e) => setAMetodo(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAtvOpen(false)}>Cancelar</Button>
            <Button onClick={() => saveAtv.mutate()} disabled={!aNome || !aGrupo}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
