import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useEffect, useRef } from "react";
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
import { Plus, Pencil, Trash2, Lock, FileDown } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

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
  const { canConfig, isAdmin } = useAuth();


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
      const rows = (data ?? []) as Atividade[];
      return [...rows].sort((a, b) =>
        (a.ordem - b.ordem) ||
        a.nome.localeCompare(b.nome, "pt-BR") ||
        a.id.localeCompare(b.id)
      );
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
  const [busca, setBusca] = useState("");

  const norm = (s: any) => (s ?? "").toString().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const matchBusca = (a: Atividade) => {
    const q = norm(busca).trim();
    if (!q) return true;
    return (
      norm(a.nome).includes(q) ||
      norm(a.grupo_nome).includes(q) ||
      norm(a.normas).includes(q)
    );
  };

  const atividadesFiltradas = useMemo(() => {
    return atividades.filter((a) => {
      if (filtroGrupo && a.grupo_id !== filtroGrupo) return false;
      if (filtroResp && a.responsavel_funcionario_id !== filtroResp) return false;
      if (filtroEquipe && a.equipe_id !== filtroEquipe) return false;
      if (!matchBusca(a)) return false;
      return true;
    });
  }, [atividades, filtroGrupo, filtroResp, filtroEquipe, busca]);

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
      const { error } = await supabase.from("rh_grupos_atividades_auditoria").update({ ativo: false }).eq("id", id);
      if (error) throw error;
      await supabase.from("rh_atividades_auditoria").update({ ativo: false }).eq("grupo_id", id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Grupo desativado (histórico preservado).");
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
      const { error } = await supabase.from("rh_atividades_auditoria").update({ ativo: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); toast.success("Desativada (histórico preservado)."); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });


  const grupoOptions = (grupos as any[]).map((g) => ({ value: g.id, label: g.nome }));
  const funcOptions = (funcionarios as any[]).map((f) => ({ value: f.id, label: f.nome_completo }));
  const equipeOptions = (equipes as any[]).map((e) => ({ value: e.id, label: e.nome }));

  // ===== Inline patch mutations (admin) =====
  const patchAtv = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("rh_atividades_auditoria").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Atualizado.");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });
  const patchGrupo = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, any> }) => {
      const { error } = await supabase.from("rh_grupos_atividades_auditoria").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Atualizado.");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // Inline editor for text/number values
  const InlineText = ({
    value, onSave, multiline = false, type = "text", placeholder, className, display,
    stopProp = false,
  }: {
    value: string | number | null; onSave: (v: string) => void;
    multiline?: boolean; type?: "text" | "number"; placeholder?: string; className?: string;
    display?: React.ReactNode; stopProp?: boolean;
  }) => {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value == null ? "" : String(value));
    const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
    useEffect(() => { if (editing) { setVal(value == null ? "" : String(value)); setTimeout(() => inputRef.current?.focus(), 0); } }, [editing]);
    if (!isAdmin) {
      return <span className={className}>{display ?? (value ?? placeholder ?? "—")}</span>;
    }
    if (!editing) {
      return (
        <span
          className={(className ?? "") + " cursor-text hover:bg-accent/50 rounded px-1 -mx-1"}
          onClick={(e) => { if (stopProp) { e.stopPropagation(); e.preventDefault(); } setEditing(true); }}
          title="Clique para editar"
        >
          {display ?? (value != null && value !== "" ? value : (placeholder ?? "—"))}
        </span>
      );
    }
    const commit = () => { setEditing(false); const nv = val.trim(); if (nv !== String(value ?? "")) onSave(nv); };
    const cancel = () => setEditing(false);
    const stop = (e: React.SyntheticEvent) => { if (stopProp) e.stopPropagation(); };
    if (multiline) {
      return (
        <Textarea
          ref={inputRef as any}
          value={val}
          onChange={(e) => setVal(e.target.value)}
          onBlur={commit}
          onClick={stop}
          onKeyDown={(e) => { stop(e); if (e.key === "Escape") cancel(); if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) commit(); }}
          rows={2}
          className="text-xs"
        />
      );
    }
    return (
      <Input
        ref={inputRef as any}
        type={type}
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={commit}
        onClick={stop}
        onKeyDown={(e) => { stop(e); if (e.key === "Escape") cancel(); if (e.key === "Enter") commit(); }}
        className={"h-7 " + (type === "number" ? "w-20" : "")}
      />
    );
  };

  // Inline editor for responsável (uses Combobox in popover)
  const InlineResp = ({ value, onSave }: { value: string | null; onSave: (v: string | null) => void }) => {
    const [open, setOpen] = useState(false);
    if (!isAdmin) return <span>{funcNome(value)}</span>;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span className="cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1" title="Clique para editar">
            {funcNome(value)}
          </span>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-64" align="start">
          <Combobox
            options={funcOptions}
            value={value ?? ""}
            onValueChange={(v) => { onSave(v || null); setOpen(false); }}
            placeholder="Selecionar responsável"
            emptyMessage="—"
          />
        </PopoverContent>
      </Popover>
    );
  };


  // ===== Seleção em massa =====
  const [selecionadas, setSelecionadas] = useState<Set<string>>(new Set());
  const toggleSel = (id: string) => setSelecionadas((prev) => {
    const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n;
  });
  const clearSel = () => setSelecionadas(new Set());
  const [bulkRespOpen, setBulkRespOpen] = useState(false);
  const [bulkResp, setBulkResp] = useState("");

  const bulkDelete = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("rh_atividades_auditoria").update({ ativo: false }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); toast.success("Atividades desativadas."); clearSel(); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const bulkPatchResp = useMutation({
    mutationFn: async ({ ids, resp }: { ids: string[]; resp: string | null }) => {
      const { error } = await supabase.from("rh_atividades_auditoria").update({ responsavel_funcionario_id: resp }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); toast.success("Responsável atualizado."); clearSel(); setBulkRespOpen(false); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const ItemRow = ({ a, showGrupo = false }: { a: Atividade; showGrupo?: boolean }) => (
    <div className="flex items-start justify-between gap-3 py-2 border-b last:border-0">
      <div className="flex-1 min-w-0 flex items-start gap-2">
        {canConfig && (
          <input
            type="checkbox"
            className="mt-1 h-4 w-4 shrink-0"
            checked={selecionadas.has(a.id)}
            onChange={() => toggleSel(a.id)}
            aria-label="Selecionar atividade"
          />
        )}
        <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <InlineText
            value={a.nome}
            className="font-medium"
            onSave={(v) => v && patchAtv.mutate({ id: a.id, patch: { nome: v } })}
          />
          <Badge variant="secondary" className="p-0">
            <InlineText
              type="number"
              value={a.peso}
              className="px-2 py-0.5 inline-block"
              display={<>peso {Number(a.peso)}</>}
              onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchAtv.mutate({ id: a.id, patch: { peso: n } }); }}
            />
          </Badge>
          {showGrupo && <Badge variant="outline">{a.grupo_nome}</Badge>}
        </div>
        <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
          <div>Responsável: <InlineResp value={a.responsavel_funcionario_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { responsavel_funcionario_id: v } })} /></div>
          <div>Normas: <InlineText multiline value={a.normas} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { normas: v || null } })} /></div>
          <div>Manuais: <InlineText multiline value={a.manuais} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { manuais: v || null } })} /></div>
          <div>Indicadores: <InlineText multiline value={a.indicadores} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { indicadores: v || null } })} /></div>
          {isAdmin ? (
            <div className="text-foreground/80">
              <strong>Método:</strong>{" "}
              <InlineText
                multiline
                value={a.metodo_auditoria}
                placeholder="clique para adicionar"
                onSave={(v) => patchAtv.mutate({ id: a.id, patch: { metodo_auditoria: v || null } })}
              />
            </div>
          ) : a.metodo_auditoria ? (
            <div className="text-foreground/80"><strong>Método:</strong> {a.metodo_auditoria}</div>
          ) : (
            <div className="flex items-center gap-1 text-amber-700"><Lock className="h-3 w-3" /> Método restrito</div>
          )}
        </div>
        </div>
      </div>
      {canConfig && (
        <div className="flex gap-1 shrink-0">
          <Button size="icon" variant="ghost" onClick={() => openEditAtv(a)}><Pencil className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" onClick={() => { if (confirm("Desativar atividade? O histórico das auditorias é preservado.")) deleteAtv.mutate(a.id); }}><Trash2 className="h-4 w-4" /></Button>
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

      {canConfig && selecionadas.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
          <span className="text-sm font-medium">{selecionadas.size} selecionada(s)</span>
          <div className="flex-1" />
          <Button size="sm" variant="outline" onClick={() => { setBulkResp(""); setBulkRespOpen(true); }}>
            <Pencil className="mr-1 h-3 w-3" />Alterar responsável
          </Button>
          <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Desativar ${selecionadas.size} atividade(s)? O histórico é preservado.`)) bulkDelete.mutate(Array.from(selecionadas)); }}>
            <Trash2 className="mr-1 h-3 w-3" />Desativar selecionadas

          </Button>
          <Button size="sm" variant="ghost" onClick={clearSel}>Limpar seleção</Button>
        </div>
      )}

      <div className="relative">
        <Input
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar por normas, atividade ou grupo…"
          className="pr-8"
        />
        {busca && (
          <button
            type="button"
            onClick={() => setBusca("")}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground text-xs"
            aria-label="Limpar busca"
          >
            ✕
          </button>
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
                const atvs = atividades.filter((a) => a.grupo_id === g.id && matchBusca(a));
                if (busca && atvs.length === 0) return null;
                return (
                  <AccordionItem value={g.id} key={g.id} className="border rounded-lg px-3">
                    <AccordionTrigger>
                      <div className="flex items-center gap-2 flex-wrap text-left">
                        <InlineText
                          value={g.nome}
                          className="font-semibold"
                          stopProp
                          onSave={(v) => v && patchGrupo.mutate({ id: g.id, patch: { nome: v } })}
                        />
                        <Badge variant="secondary" className="p-0">
                          <InlineText
                            type="number"
                            value={g.peso}
                            stopProp
                            className="px-2 py-0.5 inline-block"
                            display={<>peso grupo {Number(g.peso)}</>}
                            onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchGrupo.mutate({ id: g.id, patch: { peso: n } }); }}
                          />
                        </Badge>
                        <Badge variant="outline">{equipeNome(g.equipe_id)}</Badge>
                        <Badge>{atvs.length} atividades</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      {canConfig && (
                        <div className="flex gap-2 mb-2">
                          <Button size="sm" variant="outline" onClick={() => openEditGrupo(g)}><Pencil className="mr-1 h-3 w-3" />Editar grupo</Button>
                          <Button size="sm" variant="outline" onClick={() => openNewAtv(g.id)}><Plus className="mr-1 h-3 w-3" />Atividade neste grupo</Button>
                          <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Desativar grupo e suas atividades? O histórico é preservado.")) deleteGrupo.mutate(g.id); }}><Trash2 className="mr-1 h-3 w-3" />Desativar grupo</Button>
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
                    <TableHead>Equipe</TableHead>
                    <TableHead>Responsável</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Atividade</TableHead>
                    <TableHead>Peso</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...atividadesFiltradas]
                    .sort((a, b) => {
                      const ea = equipeNome(a.equipe_id) || "";
                      const eb = equipeNome(b.equipe_id) || "";
                      const cmpEq = ea.localeCompare(eb, "pt-BR");
                      if (cmpEq) return cmpEq;
                      const ra = funcNome(a.responsavel_funcionario_id) || "";
                      const rb = funcNome(b.responsavel_funcionario_id) || "";
                      const cmpR = ra.localeCompare(rb, "pt-BR");
                      if (cmpR) return cmpR;
                      const cmpG = (a.grupo_nome || "").localeCompare(b.grupo_nome || "", "pt-BR");
                      if (cmpG) return cmpG;
                      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
                    })
                    .map((a) => (
                    <TableRow key={a.id}>
                      <TableCell>{equipeNome(a.equipe_id)}</TableCell>
                      <TableCell><InlineResp value={a.responsavel_funcionario_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { responsavel_funcionario_id: v } })} /></TableCell>
                      <TableCell>{a.grupo_nome}</TableCell>
                      <TableCell><InlineText value={a.nome} onSave={(v) => v && patchAtv.mutate({ id: a.id, patch: { nome: v } })} /></TableCell>
                      <TableCell><InlineText type="number" value={a.peso} onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchAtv.mutate({ id: a.id, patch: { peso: n } }); }} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="equipe">
          <div className="flex flex-wrap gap-2 mb-3">
            <Combobox options={equipeOptions} value={filtroEquipe} onValueChange={setFiltroEquipe} placeholder="Filtrar equipe" emptyMessage="—" />
            {filtroEquipe && <Button variant="ghost" onClick={() => setFiltroEquipe("")}>Limpar equipe</Button>}
            {(() => {
              const atvsEscopo = atividades.filter((a) => !filtroEquipe || a.equipe_id === filtroEquipe);
              const respIds = Array.from(new Set(atvsEscopo.map((a) => a.responsavel_funcionario_id).filter(Boolean))) as string[];
              const respOpts = respIds
                .map((id) => ({ value: id, label: funcNome(id) }))
                .sort((a, b) => a.label.localeCompare(b.label));
              return (
                <>
                  <Combobox options={respOpts} value={filtroResp} onValueChange={setFiltroResp} placeholder="Filtrar responsável" emptyMessage="—" />
                  {filtroResp && <Button variant="ghost" onClick={() => setFiltroResp("")}>Limpar responsável</Button>}
                </>
              );
            })()}
          </div>
          <div className="space-y-3">
            {(equipes as any[])
              .filter((e) => !filtroEquipe || e.id === filtroEquipe)
              .map((e) => {
                const atvsEquipe = atividades.filter(
                  (a) => a.equipe_id === e.id && (!filtroResp || a.responsavel_funcionario_id === filtroResp) && matchBusca(a)
                );
                if (atvsEquipe.length === 0) return null;
                const gruposDaEquipe = (grupos as any[])
                  .filter((g) => atvsEquipe.some((a) => a.grupo_id === g.id))
                  .sort((a: any, b: any) => (a.ordem - b.ordem) || a.nome.localeCompare(b.nome));
                return (
                  <Card key={e.id}>
                    <CardHeader><CardTitle className="text-base">{e.nome}</CardTitle></CardHeader>
                    <CardContent className="pt-0">
                      <Accordion type="multiple" className="space-y-2">
                        {gruposDaEquipe.map((g: any) => {
                          const atvsGrupo = atvsEquipe.filter((a) => a.grupo_id === g.id);
                          return (
                            <AccordionItem value={`${e.id}-${g.id}`} key={g.id} className="border rounded-lg px-3">
                              <AccordionTrigger>
                                <div className="flex items-center gap-2 flex-wrap text-left">
                                  <InlineText
                                    value={g.nome}
                                    className="font-semibold"
                                    stopProp
                                    onSave={(v) => v && patchGrupo.mutate({ id: g.id, patch: { nome: v } })}
                                  />
                                  <Badge variant="secondary" className="p-0">
                                    <InlineText
                                      type="number"
                                      value={g.peso}
                                      stopProp
                                      className="px-2 py-0.5 inline-block"
                                      display={<>peso grupo {Number(g.peso)}</>}
                                      onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchGrupo.mutate({ id: g.id, patch: { peso: n } }); }}
                                    />
                                  </Badge>
                                  <Badge>{atvsGrupo.length} atividades</Badge>
                                </div>
                              </AccordionTrigger>
                              <AccordionContent>
                                {atvsGrupo.map((a) => <ItemRow key={a.id} a={a} />)}
                              </AccordionContent>
                            </AccordionItem>
                          );
                        })}
                      </Accordion>
                    </CardContent>
                  </Card>
                );
              })}
            {!filtroResp && (() => {
              const semEquipe = atividades.filter((a) => !a.equipe_id && matchBusca(a));
              if (semEquipe.length === 0) return null;
              return (
              <Card>
                <CardHeader><CardTitle className="text-base">Sem equipe</CardTitle></CardHeader>
                <CardContent className="pt-0">
                  {semEquipe.map((a) => <ItemRow key={a.id} a={a} showGrupo />)}
                </CardContent>
              </Card>
              );
            })()}
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

      {/* Dialog Bulk Responsável */}
      <Dialog open={bulkRespOpen} onOpenChange={setBulkRespOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Alterar responsável ({selecionadas.size})</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <label className="text-sm">Novo responsável</label>
            <Combobox options={funcOptions} value={bulkResp} onValueChange={setBulkResp} placeholder="Selecionar (vazio = remover)" emptyMessage="—" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkRespOpen(false)}>Cancelar</Button>
            <Button onClick={() => bulkPatchResp.mutate({ ids: Array.from(selecionadas), resp: bulkResp || null })}>Aplicar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
