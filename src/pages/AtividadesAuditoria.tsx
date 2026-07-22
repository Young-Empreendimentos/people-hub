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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Lock, FileDown, AlertTriangle, Search, List, Table2, Copy, GripVertical } from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { DndContext, closestCenter, PointerSensor, KeyboardSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

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

  const { data: atividadesInativas = [] } = useQuery({
    queryKey: ["rh_atividades_auditoria_inativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_atividades_auditoria")
        .select("id, grupo_id, nome, peso, responsavel_funcionario_id, normas, updated_at, ativo, rh_grupos_atividades_auditoria!inner(id, nome, ativo, equipe_id, rh_equipes(nome))")
        .eq("ativo", false)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
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

  const { data: activeMap = {} } = useQuery({
    queryKey: ["rh_funcionarios_active_map_v2"],
    queryFn: async () => {
      const { data } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("funcionario_id, tipo, data")
        .order("data", { ascending: false });
      const latest: Record<string, string> = {};
      for (const row of (data || []) as any[]) {
        if (!latest[row.funcionario_id]) latest[row.funcionario_id] = row.tipo;
      }
      const map: Record<string, boolean> = {};
      for (const [id, tipo] of Object.entries(latest)) {
        map[id] = tipo !== "desligamento";
      }
      return map;
    },
  });

  const isRespInativo = (id: string | null) => !!id && activeMap[id] === false;


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
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); qc.invalidateQueries({ queryKey: ["rh_atividades_auditoria_inativas"] }); toast.success("Desativada (histórico preservado)."); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const reativarAtv = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_atividades_auditoria").update({ ativo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_atividades_auditoria_inativas"] });
      toast.success("Atividade reativada.");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const reativarGrupo = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_grupos_atividades_auditoria").update({ ativo: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_atividades_auditoria_inativas"] });
      toast.success("Grupo reativado.");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const excluirAtvPerm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("rh_atividades_auditoria").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_atividades_auditoria_inativas"] });
      toast.success("Atividade excluída definitivamente.");
    },
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

  // Batch reorder: persists new "ordem" for a list of ids in the given sequence
  const reorderGrupos = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, idx) =>
        supabase.from("rh_grupos_atividades_auditoria").update({ ordem: idx + 1 }).eq("id", id)
      ));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Ordem dos grupos atualizada.");
    },
    onError: (e: any) => toast.error("Erro ao reordenar: " + e.message),
  });
  const reorderAtividades = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id, idx) =>
        supabase.from("rh_atividades_auditoria").update({ ordem: idx + 1 }).eq("id", id)
      ));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Ordem das atividades atualizada.");
    },
    onError: (e: any) => toast.error("Erro ao reordenar: " + e.message),
  });

  const dndSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );
  const podeArrastar = isAdmin && !busca && !filtroResp && !filtroGrupo && !filtroEquipe;



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
    const inativo = isRespInativo(value);
    const label = (
      <span className={`inline-flex items-center gap-1 ${inativo ? "text-destructive font-medium" : ""}`}>
        {inativo && (
          <AlertTriangle
            className="h-3.5 w-3.5 text-destructive"
            aria-label="Responsável inativo — atividade sem responsável"
          >
            <title>Responsável inativo — atividade sem responsável</title>
          </AlertTriangle>
        )}
        {funcNome(value)}
        {inativo && <span className="text-xs">(inativo)</span>}
      </span>
    );
    if (!isAdmin) return label;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span
            className="cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1"
            title={inativo ? "Responsável inativo — clique para alterar" : "Clique para editar"}
          >
            {label}
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

  // Inline editor for grupo (admin only)
  const InlineGrupo = ({ value, onSave }: { value: string; onSave: (v: string) => void }) => {
    const [open, setOpen] = useState(false);
    const label = (grupos as any[]).find((g) => g.id === value)?.nome ?? "—";
    if (!isAdmin) return <span>{label}</span>;
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <span className="cursor-pointer hover:bg-accent/50 rounded px-1 -mx-1" title="Clique para editar">{label}</span>
        </PopoverTrigger>
        <PopoverContent className="p-2 w-64" align="start">
          <Combobox
            options={grupoOptions}
            value={value}
            onValueChange={(v) => { if (v && v !== value) onSave(v); setOpen(false); }}
            placeholder="Selecionar grupo"
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

  const bulkDuplicate = useMutation({
    mutationFn: async (ids: string[]) => {
      const originais = atividades.filter((a) => ids.includes(a.id));
      if (originais.length === 0) return;
      const payload = originais.map((a) => ({
        grupo_id: a.grupo_id,
        nome: `${a.nome} (cópia)`,
        peso: Number(a.peso) || 1,
        responsavel_funcionario_id: a.responsavel_funcionario_id,
        normas: a.normas,
        manuais: a.manuais,
        indicadores: a.indicadores,
        metodo_auditoria: a.metodo_auditoria,
        ordem: Number(a.ordem) || 0,
      }));
      const { error } = await supabase.from("rh_atividades_auditoria").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] }); toast.success("Atividades duplicadas."); clearSel(); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const duplicateGrupo = useMutation({
    mutationFn: async (grupoId: string) => {
      const g = (grupos as any[]).find((x) => x.id === grupoId);
      if (!g) throw new Error("Grupo não encontrado");
      const maxOrdem = (grupos as any[]).reduce((m, x) => Math.max(m, Number(x.ordem) || 0), 0);
      const { data: novo, error: e1 } = await supabase
        .from("rh_grupos_atividades_auditoria")
        .insert({ nome: g.nome, equipe_id: g.equipe_id ?? null, peso: Number(g.peso) || 1, ordem: maxOrdem + 1 })
        .select("id")
        .single();
      if (e1) throw e1;
      const atvs = atividades.filter((a) => a.grupo_id === grupoId);
      if (atvs.length > 0) {
        const payload = atvs.map((a) => ({
          grupo_id: novo!.id,
          nome: a.nome,
          peso: Number(a.peso) || 1,
          responsavel_funcionario_id: a.responsavel_funcionario_id,
          normas: a.normas,
          manuais: a.manuais,
          indicadores: a.indicadores,
          metodo_auditoria: a.metodo_auditoria,
          ordem: Number(a.ordem) || 0,
        }));
        const { error: e2 } = await supabase.from("rh_atividades_auditoria").insert(payload);
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_grupos_atividades_auditoria"] });
      qc.invalidateQueries({ queryKey: ["rh_listar_atividades_auditoria"] });
      toast.success("Grupo duplicado.");
      clearSel();
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });


  // ===== View mode (lista / tabela) =====
  const [viewMode, setViewMode] = useState<"lista" | "tabela">("lista");

  // Select all activities within a group
  const toggleGroupSel = (atvs: Atividade[]) => {
    const ids = atvs.map((a) => a.id);
    const allIn = ids.every((id) => selecionadas.has(id));
    setSelecionadas((prev) => {
      const n = new Set(prev);
      if (allIn) ids.forEach((id) => n.delete(id));
      else ids.forEach((id) => n.add(id));
      return n;
    });
  };
  const groupSelState = (atvs: Atividade[]): "none" | "some" | "all" => {
    if (atvs.length === 0) return "none";
    const c = atvs.filter((a) => selecionadas.has(a.id)).length;
    if (c === 0) return "none";
    if (c === atvs.length) return "all";
    return "some";
  };

  // Shared table renderer
  const TableView = ({ rows }: { rows: Atividade[] }) => {
    const allSel = rows.length > 0 && rows.every((r) => selecionadas.has(r.id));
    const someSel = rows.some((r) => selecionadas.has(r.id));
    const toggleAll = () => {
      setSelecionadas((prev) => {
        const n = new Set(prev);
        if (allSel) rows.forEach((r) => n.delete(r.id));
        else rows.forEach((r) => n.add(r.id));
        return n;
      });
    };
    return (
      <Card>
        <CardContent className="pt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-8">
                  <input
                    type="checkbox"
                    className="h-4 w-4"
                    checked={allSel}
                    ref={(el) => { if (el) el.indeterminate = !allSel && someSel; }}
                    onChange={toggleAll}
                    aria-label="Selecionar todas"
                  />
                </TableHead>
                <TableHead>Equipe</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Atividade</TableHead>
                <TableHead>Peso</TableHead>
                <TableHead>Normas</TableHead>
                <TableHead>Manuais</TableHead>
                <TableHead>Indicadores</TableHead>
                {isAdmin && <TableHead>Método</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((a) => (
                <TableRow key={a.id} data-state={selecionadas.has(a.id) ? "selected" : undefined}>
                  <TableCell>
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={selecionadas.has(a.id)}
                      onChange={() => toggleSel(a.id)}
                      aria-label="Selecionar atividade"
                    />
                  </TableCell>
                  <TableCell>{equipeNome(a.equipe_id)}</TableCell>
                  <TableCell><InlineResp value={a.responsavel_funcionario_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { responsavel_funcionario_id: v } })} /></TableCell>
                  <TableCell><InlineGrupo value={a.grupo_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { grupo_id: v } })} /></TableCell>
                  <TableCell><InlineText value={a.nome} onSave={(v) => v && patchAtv.mutate({ id: a.id, patch: { nome: v } })} /></TableCell>
                  <TableCell><InlineText type="number" value={a.peso} onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchAtv.mutate({ id: a.id, patch: { peso: n } }); }} /></TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground whitespace-pre-wrap align-top">
                    <InlineText multiline value={a.normas} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { normas: v || null } })} />
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground whitespace-pre-wrap align-top">
                    <InlineText multiline value={a.manuais} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { manuais: v || null } })} />
                  </TableCell>
                  <TableCell className="max-w-[240px] text-xs text-muted-foreground whitespace-pre-wrap align-top">
                    <InlineText multiline value={a.indicadores} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { indicadores: v || null } })} />
                  </TableCell>
                  {isAdmin && (
                    <TableCell className="max-w-[240px] text-xs text-muted-foreground whitespace-pre-wrap align-top">
                      <InlineText multiline value={a.metodo_auditoria} placeholder="clique para adicionar" onSave={(v) => patchAtv.mutate({ id: a.id, patch: { metodo_auditoria: v || null } })} />
                    </TableCell>
                  )}
                </TableRow>

              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    );
  };

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

  // Drag handle button (admin-only, activated by pointer down)
  const DragHandle = ({ listeners, attributes, title }: { listeners: any; attributes: any; title: string }) => (
    <button
      type="button"
      {...attributes}
      {...listeners}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 p-1 -ml-1 rounded hover:bg-muted cursor-grab active:cursor-grabbing text-muted-foreground"
      aria-label={title}
      title={title}
    >
      <GripVertical className="h-4 w-4" />
    </button>
  );

  // Sortable activity row (admin drag-and-drop within a group)
  const SortableAtvRow = ({ a }: { a: Atividade }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: a.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.6 : 1 };
    return (
      <div ref={setNodeRef} style={style} className="flex items-start gap-1">
        {podeArrastar && <div className="pt-3"><DragHandle listeners={listeners} attributes={attributes} title="Arrastar atividade" /></div>}
        <div className="flex-1 min-w-0"><ItemRow a={a} /></div>
      </div>
    );
  };

  // Sortable group (accordion item)
  const SortableGrupo = ({ g, atvs }: { g: any; atvs: Atividade[] }) => {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: g.id });
    const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.7 : 1 };
    const gState = groupSelState(atvs);
    const atvsIds = atvs.map((a) => a.id);
    const onAtvDragEnd = (e: DragEndEvent) => {
      const { active, over } = e;
      if (!over || active.id === over.id) return;
      const oldIdx = atvsIds.indexOf(String(active.id));
      const newIdx = atvsIds.indexOf(String(over.id));
      if (oldIdx < 0 || newIdx < 0) return;
      reorderAtividades.mutate(arrayMove(atvsIds, oldIdx, newIdx));
    };
    return (
      <AccordionItem ref={setNodeRef} style={style} value={g.id} className="border rounded-lg px-3">
        <AccordionTrigger>
          <div className="flex items-center gap-2 flex-wrap text-left">
            {podeArrastar && <DragHandle listeners={listeners} attributes={attributes} title="Arrastar grupo" />}
            {canConfig && atvs.length > 0 && (
              <input
                type="checkbox"
                className="h-4 w-4 shrink-0"
                checked={gState === "all"}
                ref={(el) => { if (el) el.indeterminate = gState === "some"; }}
                onChange={() => toggleGroupSel(atvs)}
                onClick={(e) => e.stopPropagation()}
                aria-label="Selecionar grupo inteiro"
                title="Selecionar todas as atividades do grupo"
              />
            )}
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
            <div className="flex gap-2 mb-2 flex-wrap">
              <Button size="sm" variant="outline" onClick={() => openEditGrupo(g)}><Pencil className="mr-1 h-3 w-3" />Editar grupo</Button>
              <Button size="sm" variant="outline" onClick={() => openNewAtv(g.id)}><Plus className="mr-1 h-3 w-3" />Atividade neste grupo</Button>
              {isAdmin && (
                <Button size="sm" variant="outline" onClick={() => { setSelecionadas(new Set(atvs.map((a) => a.id))); setBulkResp(""); setBulkRespOpen(true); }}><Pencil className="mr-1 h-3 w-3" />Trocar responsável do grupo</Button>
              )}
              <Button size="sm" variant="outline" onClick={() => { if (confirm(`Duplicar o grupo inteiro "${g.nome}" com ${atvs.length} atividade(s)? Será criado um novo grupo com o mesmo nome e as atividades duplicadas.`)) duplicateGrupo.mutate(g.id); }}><Copy className="mr-1 h-3 w-3" />Duplicar grupo inteiro</Button>
              {isAdmin && (
                <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm("Desativar grupo e suas atividades? O histórico é preservado.")) deleteGrupo.mutate(g.id); }}><Trash2 className="mr-1 h-3 w-3" />Desativar grupo</Button>
              )}
            </div>
          )}
          {atvs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">Nenhuma atividade.</p>
          ) : podeArrastar ? (
            <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onAtvDragEnd}>
              <SortableContext items={atvsIds} strategy={verticalListSortingStrategy}>
                {atvs.map((a) => <SortableAtvRow key={a.id} a={a} />)}
              </SortableContext>
            </DndContext>
          ) : (
            atvs.map((a) => <ItemRow key={a.id} a={a} />)
          )}
        </AccordionContent>
      </AccordionItem>
    );
  };




  // ===== Relatório PDF (sempre sobre o que está filtrado) =====
  const emitirRelatorioFiltrado = () => {
    const rows = [...atividadesFiltradas].sort((a, b) => {
      const ea = equipeNome(a.equipe_id) || "";
      const eb = equipeNome(b.equipe_id) || "";
      const cmpEq = ea.localeCompare(eb, "pt-BR"); if (cmpEq) return cmpEq;
      const ra = funcNome(a.responsavel_funcionario_id) || "";
      const rb = funcNome(b.responsavel_funcionario_id) || "";
      const cmpR = ra.localeCompare(rb, "pt-BR"); if (cmpR) return cmpR;
      const cmpG = (a.grupo_nome || "").localeCompare(b.grupo_nome || "", "pt-BR"); if (cmpG) return cmpG;
      return (a.nome || "").localeCompare(b.nome || "", "pt-BR");
    });
    if (rows.length === 0) { toast.error("Nenhuma atividade no filtro atual."); return; }
    const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
    doc.setFontSize(14);
    doc.text("Relatório de Atividades de Auditoria", 40, 40);
    doc.setFontSize(10);
    const partesFiltro: string[] = [];
    if (filtroEquipe) partesFiltro.push(`Equipe: ${equipeNome(filtroEquipe)}`);
    if (filtroResp) partesFiltro.push(`Responsável: ${funcNome(filtroResp)}`);
    if (filtroGrupo) partesFiltro.push(`Grupo: ${(grupos as any[]).find((g) => g.id === filtroGrupo)?.nome ?? "—"}`);
    if (busca) partesFiltro.push(`Busca: "${busca}"`);
    const filtroTxt = partesFiltro.length ? partesFiltro.join("  •  ") : "Sem filtros";
    doc.text(`Emitido em ${new Date().toLocaleString("pt-BR")}  •  ${rows.length} atividade(s)`, 40, 56);
    doc.text(filtroTxt, 40, 70);
    autoTable(doc, {
      startY: 84,
      head: [["Equipe", "Responsável", "Grupo", "Atividade", "Peso", "Normas"]],
      body: rows.map((a) => [
        equipeNome(a.equipe_id),
        funcNome(a.responsavel_funcionario_id),
        a.grupo_nome || "—",
        a.nome || "—",
        String(a.peso ?? ""),
        a.normas || "—",
      ]),
      styles: { fontSize: 9, cellPadding: 4, valign: "top" },
      headStyles: { fillColor: [30, 41, 59] },
      columnStyles: {
        0: { cellWidth: 90 }, 1: { cellWidth: 120 }, 2: { cellWidth: 110 },
        3: { cellWidth: 160 }, 4: { cellWidth: 40, halign: "center" }, 5: { cellWidth: "auto" },
      },
    });
    doc.save(`atividades-auditoria-${new Date().toISOString().slice(0,10)}.pdf`);
  };

  return (
    <div className="space-y-4 max-w-6xl">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Buscar por normas, atividade ou grupo…"
            className="pl-8 pr-8"
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
        <ToggleGroup type="single" value={viewMode} onValueChange={(v) => v && setViewMode(v as any)} size="sm" variant="outline">
          <ToggleGroupItem value="lista" aria-label="Visualização em lista"><List className="h-4 w-4 mr-1" />Lista</ToggleGroupItem>
          <ToggleGroupItem value="tabela" aria-label="Visualização em tabela"><Table2 className="h-4 w-4 mr-1" />Tabela</ToggleGroupItem>
        </ToggleGroup>
        {canConfig && (
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" onClick={openNewGrupo}><Plus className="mr-2 h-4 w-4" />Novo grupo</Button>
            <Button onClick={() => openNewAtv()}><Plus className="mr-2 h-4 w-4" />Nova atividade</Button>
          </div>
        )}
      </div>

      {/* Filtros compartilhados entre todas as subpáginas */}
      <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
        <div className="flex flex-wrap gap-2 flex-1">
          <Combobox
            options={equipeOptions}
            value={filtroEquipe}
            onValueChange={setFiltroEquipe}
            placeholder="Equipe"
            emptyMessage="—"
            className="w-[150px]"
          />
          <Combobox
            options={funcOptions}
            value={filtroResp}
            onValueChange={setFiltroResp}
            placeholder="Responsável"
            emptyMessage="—"
            className="w-[180px]"
          />
          <Combobox
            options={grupoOptions}
            value={filtroGrupo}
            onValueChange={setFiltroGrupo}
            placeholder="Grupo"
            emptyMessage="—"
            className="w-[180px]"
          />
          {(filtroEquipe || filtroResp || filtroGrupo) && (
            <Button size="sm" variant="ghost" onClick={() => { setFiltroEquipe(""); setFiltroResp(""); setFiltroGrupo(""); }}>
              Limpar filtros
            </Button>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs text-muted-foreground whitespace-nowrap">{atividadesFiltradas.length} atividade(s)</span>
          <Button variant="outline" size="sm" onClick={emitirRelatorioFiltrado}>
            <FileDown className="mr-2 h-4 w-4" />
            Relatório PDF
          </Button>
        </div>
      </div>

      {canConfig && selecionadas.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 bg-primary/10 border border-primary/30 rounded-lg px-3 py-2">
          <span className="text-sm font-medium">{selecionadas.size} selecionada(s)</span>
          <div className="flex-1" />
          {isAdmin && (
            <Button size="sm" variant="outline" onClick={() => { setBulkResp(""); setBulkRespOpen(true); }}>
              <Pencil className="mr-1 h-3 w-3" />Alterar responsável
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => {
            // Detect fully-selected groups: if the selection covers ALL activities of some groups (and nothing else), duplicate as groups.
            const selIds = Array.from(selecionadas);
            const byGrupo = new Map<string, string[]>();
            (atividades as Atividade[]).forEach((a) => {
              if (!byGrupo.has(a.grupo_id)) byGrupo.set(a.grupo_id, []);
              byGrupo.get(a.grupo_id)!.push(a.id);
            });
            const fullGrupos: string[] = [];
            const partialAtvIds: string[] = [];
            const selSet = new Set(selIds);
            byGrupo.forEach((ids, gid) => {
              const selHere = ids.filter((id) => selSet.has(id));
              if (selHere.length === 0) return;
              if (selHere.length === ids.length) fullGrupos.push(gid);
              else partialAtvIds.push(...selHere);
            });
            if (fullGrupos.length > 0 && partialAtvIds.length === 0) {
              if (confirm(`Duplicar ${fullGrupos.length} grupo(s) completo(s)? Será(ão) criado(s) novo(s) grupo(s) "(cópia)".`)) {
                Promise.all(fullGrupos.map((gid) => duplicateGrupo.mutateAsync(gid))).catch(() => {});
              }
            } else if (fullGrupos.length > 0 && partialAtvIds.length > 0) {
              if (confirm(`Duplicar ${fullGrupos.length} grupo(s) completo(s) como novos grupos e ${partialAtvIds.length} atividade(s) avulsa(s)?`)) {
                Promise.all(fullGrupos.map((gid) => duplicateGrupo.mutateAsync(gid)))
                  .then(() => bulkDuplicate.mutate(partialAtvIds))
                  .catch(() => {});
              }
            } else {
              if (confirm(`Duplicar ${selecionadas.size} atividade(s)?`)) bulkDuplicate.mutate(selIds);
            }
          }}>
            <Copy className="mr-1 h-3 w-3" />Duplicar
          </Button>
          {isAdmin && (
            <Button size="sm" variant="destructive" onClick={() => { if (confirm(`Desativar ${selecionadas.size} atividade(s)? O histórico é preservado.`)) bulkDelete.mutate(Array.from(selecionadas)); }}>
              <Trash2 className="mr-1 h-3 w-3" />Desativar selecionadas
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={clearSel}>Limpar seleção</Button>
        </div>
      )}


      <Tabs defaultValue="grupo">
        <TabsList className="mb-3">
          <TabsTrigger value="grupo">Por Grupo</TabsTrigger>

          <TabsTrigger value="responsavel">Por Responsável</TabsTrigger>
          <TabsTrigger value="equipe">Por Equipe</TabsTrigger>
          <TabsTrigger value="desativadas">Desativadas</TabsTrigger>
        </TabsList>

        <TabsContent value="grupo" className="space-y-3">


          {viewMode === "tabela" ? (
            <TableView rows={[...atividadesFiltradas].sort((a, b) =>
              (a.grupo_nome || "").localeCompare(b.grupo_nome || "", "pt-BR") ||
              (a.nome || "").localeCompare(b.nome || "", "pt-BR")
            )} />
          ) : (() => {
            const gruposVisiveis = (grupos as any[])
              .filter((g) => !filtroGrupo || g.id === filtroGrupo)
              .filter((g) => !filtroEquipe || g.equipe_id === filtroEquipe);
            const gruposIds = gruposVisiveis.map((g) => g.id);
            const onGrupoDragEnd = (e: DragEndEvent) => {
              const { active, over } = e;
              if (!over || active.id === over.id) return;
              const oldIdx = gruposIds.indexOf(String(active.id));
              const newIdx = gruposIds.indexOf(String(over.id));
              if (oldIdx < 0 || newIdx < 0) return;
              reorderGrupos.mutate(arrayMove(gruposIds, oldIdx, newIdx));
            };
            return (
              <>
                {podeArrastar && (
                  <p className="text-xs text-muted-foreground mb-1">Arraste pelo ícone <GripVertical className="inline h-3 w-3" /> para reordenar grupos e atividades.</p>
                )}
                <DndContext sensors={dndSensors} collisionDetection={closestCenter} onDragEnd={onGrupoDragEnd}>
                  <SortableContext items={gruposIds} strategy={verticalListSortingStrategy} disabled={!podeArrastar}>
                    <Accordion type="multiple" className="space-y-2">
                      {gruposVisiveis.map((g) => {
                        const atvs = atividades.filter((a) =>
                          a.grupo_id === g.id &&
                          (!filtroResp || a.responsavel_funcionario_id === filtroResp) &&
                          matchBusca(a)
                        );
                        if ((busca || filtroResp) && atvs.length === 0) return null;
                        return (
                          <SortableGrupo
                            key={g.id}
                            g={g}
                            atvs={atvs}
                          />
                        );
                      })}
                    </Accordion>
                  </SortableContext>
                </DndContext>
              </>
            );
          })()}

        </TabsContent>

        <TabsContent value="responsavel">
          {(() => {
            const rows = [...atividadesFiltradas].sort((a, b) => {
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
            });
            const allSel = rows.length > 0 && rows.every((r) => selecionadas.has(r.id));
            const someSel = rows.some((r) => selecionadas.has(r.id));
            const toggleAll = () => {
              if (allSel) rows.forEach((r) => { if (selecionadas.has(r.id)) toggleSel(r.id); });
              else rows.forEach((r) => { if (!selecionadas.has(r.id)) toggleSel(r.id); });
            };
            return (
              <div className="space-y-3">


                {viewMode === "tabela" ? (
                <Card>
                  <CardContent className="pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-8">
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={allSel}
                              ref={(el) => { if (el) el.indeterminate = !allSel && someSel; }}
                              onChange={toggleAll}
                              aria-label="Selecionar todas"
                            />
                          </TableHead>
                          <TableHead>Equipe</TableHead>
                          <TableHead>Responsável</TableHead>
                          <TableHead>Grupo</TableHead>
                          <TableHead>Atividade</TableHead>
                          <TableHead>Peso</TableHead>
                          <TableHead>Normas</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {rows.map((a) => (
                          <TableRow key={a.id} data-state={selecionadas.has(a.id) ? "selected" : undefined}>
                            <TableCell>
                              <input
                                type="checkbox"
                                className="h-4 w-4"
                                checked={selecionadas.has(a.id)}
                                onChange={() => toggleSel(a.id)}
                                aria-label="Selecionar atividade"
                              />
                            </TableCell>
                            <TableCell>{equipeNome(a.equipe_id)}</TableCell>
                            <TableCell><InlineResp value={a.responsavel_funcionario_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { responsavel_funcionario_id: v } })} /></TableCell>
                            <TableCell><InlineGrupo value={a.grupo_id} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { grupo_id: v } })} /></TableCell>
                            <TableCell><InlineText value={a.nome} onSave={(v) => v && patchAtv.mutate({ id: a.id, patch: { nome: v } })} /></TableCell>
                            <TableCell><InlineText type="number" value={a.peso} onSave={(v) => { const n = Number(v); if (!isNaN(n)) patchAtv.mutate({ id: a.id, patch: { peso: n } }); }} /></TableCell>
                            <TableCell className="max-w-[280px] text-xs text-muted-foreground">
                              <InlineText multiline value={a.normas} placeholder={isAdmin ? "clique para adicionar" : "—"} onSave={(v) => patchAtv.mutate({ id: a.id, patch: { normas: v || null } })} />
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
                ) : (
                  <Accordion type="multiple" className="space-y-2">
                    {(() => {
                      // group rows by responsável, keeping the sort order
                      const groupsMap = new Map<string, Atividade[]>();
                      for (const a of rows) {
                        const key = a.responsavel_funcionario_id ?? "__sem__";
                        if (!groupsMap.has(key)) groupsMap.set(key, []);
                        groupsMap.get(key)!.push(a);
                      }
                      return Array.from(groupsMap.entries()).map(([key, atvs]) => {
                        const gState = groupSelState(atvs);
                        const nome = key === "__sem__" ? "Sem responsável" : funcNome(key);
                        return (
                          <AccordionItem value={key} key={key} className="border rounded-lg px-3">
                            <AccordionTrigger>
                              <div className="flex items-center gap-2 flex-wrap text-left">
                                {canConfig && (
                                  <input
                                    type="checkbox"
                                    className="h-4 w-4 shrink-0"
                                    checked={gState === "all"}
                                    ref={(el) => { if (el) el.indeterminate = gState === "some"; }}
                                    onChange={() => toggleGroupSel(atvs)}
                                    onClick={(e) => e.stopPropagation()}
                                    aria-label="Selecionar responsável inteiro"
                                  />
                                )}
                                <span className="font-semibold">{nome}</span>
                                <Badge>{atvs.length} atividades</Badge>
                              </div>
                            </AccordionTrigger>
                            <AccordionContent>
                              {atvs.map((a) => <ItemRow key={a.id} a={a} showGrupo />)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      });
                    })()}
                  </Accordion>
                )}
              </div>

            );
          })()}
        </TabsContent>

        <TabsContent value="equipe" className="space-y-3">


          {viewMode === "tabela" ? (
            <TableView rows={[...atividadesFiltradas].sort((a, b) =>
              equipeNome(a.equipe_id).localeCompare(equipeNome(b.equipe_id), "pt-BR") ||
              (a.grupo_nome || "").localeCompare(b.grupo_nome || "", "pt-BR") ||
              (a.nome || "").localeCompare(b.nome || "", "pt-BR")
            )} />
          ) : (
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
                          const gState = groupSelState(atvsGrupo);
                          return (
                            <AccordionItem value={`${e.id}-${g.id}`} key={g.id} className="border rounded-lg px-3">
                              <AccordionTrigger>
                                <div className="flex items-center gap-2 flex-wrap text-left">
                                  {canConfig && atvsGrupo.length > 0 && (
                                    <input
                                      type="checkbox"
                                      className="h-4 w-4 shrink-0"
                                      checked={gState === "all"}
                                      ref={(el) => { if (el) el.indeterminate = gState === "some"; }}
                                      onChange={() => toggleGroupSel(atvsGrupo)}
                                      onClick={(ev) => ev.stopPropagation()}
                                      aria-label="Selecionar grupo inteiro"
                                    />
                                  )}
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
                              {canConfig && (
                                <div className="flex gap-2 mb-2 flex-wrap">
                                  {isAdmin && (
                                    <Button size="sm" variant="outline" onClick={() => { setSelecionadas(new Set(atvsGrupo.map((a) => a.id))); setBulkResp(""); setBulkRespOpen(true); }}><Pencil className="mr-1 h-3 w-3" />Trocar responsável do grupo</Button>
                                  )}
                                  <Button size="sm" variant="outline" onClick={() => { if (confirm(`Duplicar o grupo inteiro "${g.nome}" com ${atvsGrupo.length} atividade(s)? Será criado um novo grupo com o mesmo nome e as atividades duplicadas.`)) duplicateGrupo.mutate(g.id); }}><Copy className="mr-1 h-3 w-3" />Duplicar grupo inteiro</Button>
                                  {isAdmin && (
                                    <Button size="sm" variant="ghost" className="text-destructive" onClick={() => { if (confirm(`Desativar ${atvsGrupo.length} atividade(s)? O histórico é preservado.`)) bulkDelete.mutate(atvsGrupo.map((a) => a.id)); }}><Trash2 className="mr-1 h-3 w-3" />Desativar atividades</Button>
                                  )}
                                </div>
                              )}
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
          )}
        </TabsContent>

        <TabsContent value="desativadas" className="space-y-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Atividades desativadas</CardTitle>
              <p className="text-xs text-muted-foreground">
                {atividadesInativas.length} atividade(s) desativada(s). Reative para voltarem a aparecer nas listas e auditorias.
                {!canConfig && " Somente admin/coordenador pode reativar ou excluir."}
              </p>
            </CardHeader>
            <CardContent>
              {atividadesInativas.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma atividade desativada.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipe</TableHead>
                      <TableHead>Grupo</TableHead>
                      <TableHead>Atividade</TableHead>
                      <TableHead>Responsável</TableHead>
                      <TableHead>Desativada em</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {atividadesInativas.map((a: any) => {
                      const g = a.rh_grupos_atividades_auditoria;
                      const grupoInativo = g && g.ativo === false;
                      return (
                        <TableRow key={a.id}>
                          <TableCell className="text-xs">{g?.rh_equipes?.nome ?? "—"}</TableCell>
                          <TableCell className="text-xs">
                            <span className="inline-flex items-center gap-1">
                              {g?.nome ?? "—"}
                              {grupoInativo && (
                                <Badge variant="destructive" className="text-[10px]">grupo desativado</Badge>
                              )}
                            </span>
                          </TableCell>
                          <TableCell className="text-sm">{a.nome}</TableCell>
                          <TableCell className="text-xs">{funcNome(a.responsavel_funcionario_id)}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {a.updated_at ? new Date(a.updated_at).toLocaleString("pt-BR") : "—"}
                          </TableCell>
                          <TableCell className="text-right space-x-1">
                            {canConfig && grupoInativo && g && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => reativarGrupo.mutate(g.id)}
                              >
                                Reativar grupo
                              </Button>
                            )}
                            {canConfig && (
                              <Button
                                size="sm"
                                onClick={() => reativarAtv.mutate(a.id)}
                                disabled={grupoInativo}
                                title={grupoInativo ? "Reative o grupo antes" : ""}
                              >
                                Reativar
                              </Button>
                            )}
                            {isAdmin && (
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => {
                                  if (confirm(`Excluir DEFINITIVAMENTE "${a.nome}"? Essa ação não pode ser desfeita.`)) {
                                    excluirAtvPerm.mutate(a.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-3 w-3" />
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
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
