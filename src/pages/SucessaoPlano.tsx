import { Fragment, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rhDb, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/ui/combobox";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, Legend,
} from "recharts";
import {
  ArrowLeft, Plus, Trash2, UserPlus, Lock, Info, TriangleAlert,
  EyeOff, Eye, Pencil, FileDown, GraduationCap,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import {
  NIVEIS, NIVEL_PRONTO, HORIZONTES, CATEGORIAS, SITUACOES_PLANO, NIVEIS_RISCO,
  nivelLabel, nivelClasses, horizonteLabel, categoriaLabel, riscoClasses,
  prontidao, fragilidades,
} from "@/lib/sucessao";

const CORES_LINHA = [
  "hsl(221 83% 53%)", "hsl(142 71% 45%)", "hsl(38 92% 50%)",
  "hsl(280 65% 60%)", "hsl(0 72% 51%)", "hsl(190 80% 42%)",
];

export default function SucessaoPlano() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isAdmin, funcionarioId } = useAuth();
  const qc = useQueryClient();
  const { funcionarios, isActive } = useActiveEmployees();

  // ---- dialogs -------------------------------------------------------------
  const [celulaOpen, setCelulaOpen] = useState(false);
  const [celula, setCelula] = useState<any>(null);
  const [cNivel, setCNivel] = useState("0");
  const [cDataAlvo, setCDataAlvo] = useState("");
  const [cEvidencia, setCEvidencia] = useState("");

  const [itemOpen, setItemOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [iCategoria, setICategoria] = useState("atividade");
  const [iAtividade, setIAtividade] = useState("");
  const [iTitulo, setITitulo] = useState("");
  const [iCriterio, setICriterio] = useState("");
  const [iAvaliador, setIAvaliador] = useState("");
  const [iPeso, setIPeso] = useState("1");

  const [candOpen, setCandOpen] = useState(false);
  const [kFunc, setKFunc] = useState("");
  const [kHorizonte, setKHorizonte] = useState("1_2_anos");

  const [planoOpen, setPlanoOpen] = useState(false);
  const [pSituacao, setPSituacao] = useState("rascunho");
  const [pImpacto, setPImpacto] = useState("alto");
  const [pRisco, setPRisco] = useState("medio");
  const [pRevisao, setPRevisao] = useState("");
  const [pTitular, setPTitular] = useState("");
  const [pObs, setPObs] = useState("");

  const [confirmDel, setConfirmDel] = useState<{ tipo: "item" | "candidato" | "plano"; id: string; nome: string } | null>(null);

  // ---- data ----------------------------------------------------------------
  const { data: plano, isLoading } = useQuery({
    queryKey: ["rh_sucessao_plano", id],
    enabled: isAdmin && !!id,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_planos").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos_lite"],
    enabled: isAdmin,
    queryFn: async () =>
      (await rhDb.from("rh_cargos").select("id, nome, nivel").order("nome")).data ?? [],
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ["rh_listar_atividades_auditoria"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_listar_atividades_auditoria");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["rh_sucessao_itens", id],
    enabled: isAdmin && !!id,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_itens").select("*").eq("plano_id", id)
        .order("ordem").order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: candidatos = [] } = useQuery({
    queryKey: ["rh_sucessao_candidatos", id],
    enabled: isAdmin && !!id,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_candidatos").select("*").eq("plano_id", id)
        .order("ordem").order("created_at");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const candIds = useMemo(() => (candidatos as any[]).map((c) => c.id), [candidatos]);

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["rh_sucessao_avaliacoes", id, candIds.join(",")],
    enabled: isAdmin && candIds.length > 0,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_avaliacoes").select("*").in("candidato_id", candIds);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["rh_sucessao_hist", id],
    enabled: isAdmin && !!id,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_avaliacoes_hist").select("*")
        .eq("plano_id", id).order("alterado_em");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // ---- derivados -----------------------------------------------------------
  const funcNome = (fid: string | null) =>
    fid ? (funcionarios as any[]).find((f) => f.id === fid)?.nome_completo ?? "—" : "—";
  const cargoNome = (cid: string) => (cargos as any[]).find((c) => c.id === cid)?.nome ?? "—";
  const atvById = (aid: string | null) =>
    aid ? (catalogo as any[]).find((a) => a.id === aid) : null;

  /** Rótulo do item: nome da atividade do catálogo, ou o título livre. */
  const itemTitulo = (i: any) => (i.categoria === "atividade" ? atvById(i.atividade_id)?.nome ?? "(atividade removida)" : i.titulo);
  /** Critério efetivo: override do plano > critério do catálogo. */
  const itemCriterio = (i: any) =>
    (i.criterio_override && i.criterio_override.trim())
      ? i.criterio_override
      : (i.categoria === "atividade" ? atvById(i.atividade_id)?.criterio_proficiencia ?? null : null);
  const itemGrupo = (i: any) =>
    i.categoria === "atividade"
      ? atvById(i.atividade_id)?.grupo_nome ?? "—"
      : categoriaLabel(i.categoria);

  const itensAtivos = useMemo(() => (itens as any[]).filter((i) => i.ativo), [itens]);
  const candAtivos = useMemo(
    () => (candidatos as any[]).filter((c) => c.situacao !== "descartado"),
    [candidatos],
  );

  const avalMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const a of avaliacoes as any[]) m.set(`${a.candidato_id}|${a.item_id}`, a);
    return m;
  }, [avaliacoes]);

  const nivelDe = (candidatoId: string, itemId: string) =>
    avalMap.get(`${candidatoId}|${itemId}`)?.nivel ?? 0;

  const prontidaoPor = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of candAtivos) {
      const avals = (avaliacoes as any[]).filter((a) => a.candidato_id === c.id);
      m.set(c.id, prontidao(itensAtivos, avals));
    }
    return m;
  }, [candAtivos, avaliacoes, itensAtivos]);

  /** Agrupa as linhas por grupo de atividade / categoria, como na planilha. */
  const grupos = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const i of itensAtivos) {
      const g = itemGrupo(i);
      if (!map.has(g)) map.set(g, []);
      map.get(g)!.push(i);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [itensAtivos, catalogo]);

  const itensSemCriterio = useMemo(
    () => itensAtivos.filter((i) => !itemCriterio(i)).length,
    [itensAtivos, catalogo],
  );

  const frags = useMemo(() => {
    if (!plano) return [];
    const melhor = candAtivos.length
      ? Math.max(...candAtivos.filter((c) => c.situacao === "ativo").map((c) => prontidaoPor.get(c.id) ?? 0), 0)
      : 0;
    return fragilidades({
      itensAtivos: itensAtivos.length,
      itensSemCriterio,
      candidatosAtivos: candAtivos.filter((c) => c.situacao === "ativo").length,
      temEmergencial: candAtivos.some((c) => c.situacao === "ativo" && c.horizonte === "emergencial"),
      melhorProntidao: melhor,
      dataProximaRevisao: plano.data_proxima_revisao,
    });
  }, [plano, itensAtivos, itensSemCriterio, candAtivos, prontidaoPor]);

  /**
   * Curva de prontidão: replay do histórico, um ponto por dia em que houve
   * mudança. Reconstrói o estado de cada candidato naquele momento e recalcula
   * a % com os pesos atuais dos itens.
   */
  const curva = useMemo(() => {
    if ((historico as any[]).length === 0 || itensAtivos.length === 0) return [];
    const pesoItem = new Map(itensAtivos.map((i) => [i.id, Number(i.peso) || 0]));
    const pesoTotal = [...pesoItem.values()].reduce((s, v) => s + v, 0);
    if (pesoTotal <= 0) return [];

    const estado = new Map<string, Map<string, number>>(); // candidato -> item -> nivel
    const pontos: Record<string, any>[] = [];

    const pctDe = (cid: string) => {
      const st = estado.get(cid);
      if (!st) return 0;
      let pronto = 0;
      for (const [itemId, nivel] of st) {
        if (nivel >= NIVEL_PRONTO) pronto += pesoItem.get(itemId) ?? 0;
      }
      return Math.round((pronto / pesoTotal) * 100);
    };

    let diaAtual = "";
    for (const h of historico as any[]) {
      if (!pesoItem.has(h.item_id)) continue; // item já removido/inativo
      if (!estado.has(h.candidato_id)) estado.set(h.candidato_id, new Map());
      estado.get(h.candidato_id)!.set(h.item_id, h.nivel_novo);

      const dia = String(h.alterado_em).slice(0, 10);
      const linha: Record<string, any> = { dia };
      for (const c of candAtivos) linha[c.id] = pctDe(c.id);

      if (dia === diaAtual && pontos.length) pontos[pontos.length - 1] = linha;
      else { pontos.push(linha); diaAtual = dia; }
    }
    return pontos;
  }, [historico, itensAtivos, candAtivos]);

  // ---- mutations -----------------------------------------------------------
  const invalidarTudo = () => {
    qc.invalidateQueries({ queryKey: ["rh_sucessao_itens", id] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_candidatos", id] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_avaliacoes"] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_hist", id] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_plano", id] });
    // dashboard
    qc.invalidateQueries({ queryKey: ["rh_sucessao_itens_todos"] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_candidatos_todos"] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_avaliacoes_todas"] });
    qc.invalidateQueries({ queryKey: ["rh_sucessao_planos"] });
  };

  const salvarCelula = useMutation({
    mutationFn: async () => {
      const payload = {
        candidato_id: celula.candidatoId,
        item_id: celula.itemId,
        nivel: Number(cNivel),
        data_alvo: cDataAlvo || null,
        evidencia: cEvidencia || null,
        data_avaliacao: Number(cNivel) > 0 ? new Date().toISOString().slice(0, 10) : null,
        avaliado_por: Number(cNivel) > 0 ? funcionarioId ?? null : null,
      };
      const { error } = await rhDb
        .from("rh_sucessao_avaliacoes")
        .upsert(payload, { onConflict: "candidato_id,item_id" });
      if (error) throw error;
    },
    onSuccess: () => { invalidarTudo(); setCelulaOpen(false); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const salvarItem = useMutation({
    mutationFn: async () => {
      const payload: any = {
        plano_id: id,
        categoria: iCategoria,
        atividade_id: iCategoria === "atividade" ? iAtividade : null,
        titulo: iCategoria === "atividade" ? null : iTitulo,
        criterio_override: iCriterio || null,
        avaliador_id: iAvaliador || null,
        peso: Number(iPeso) || 1,
      };
      if (editingItem) {
        const { error } = await rhDb.from("rh_sucessao_itens").update(payload).eq("id", editingItem.id);
        if (error) throw error;
      } else {
        const { error } = await rhDb.from("rh_sucessao_itens").insert({
          ...payload, ordem: itensAtivos.length,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => { invalidarTudo(); setItemOpen(false); toast.success("Item salvo."); },
    onError: (e: any) =>
      toast.error(
        e.message?.includes("uq_rh_sucessao_itens_plano_atividade")
          ? "Esta atividade já está no plano."
          : "Erro: " + e.message,
      ),
  });

  const addCandidato = useMutation({
    mutationFn: async () => {
      const { error } = await rhDb.from("rh_sucessao_candidatos").insert({
        plano_id: id, funcionario_id: kFunc, horizonte: kHorizonte,
        ordem: (candidatos as any[]).length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidarTudo(); setCandOpen(false); setKFunc(""); setKHorizonte("1_2_anos");
      toast.success("Candidato adicionado.");
    },
    onError: (e: any) =>
      toast.error(e.message?.includes("duplicate") ? "Pessoa já é candidata neste plano." : "Erro: " + e.message),
  });

  const patchCandidato = useMutation({
    mutationFn: async ({ cid, patch }: { cid: string; patch: any }) => {
      const { error } = await rhDb.from("rh_sucessao_candidatos").update(patch).eq("id", cid);
      if (error) throw error;
    },
    onSuccess: invalidarTudo,
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const salvarPlano = useMutation({
    mutationFn: async () => {
      const { error } = await rhDb.from("rh_sucessao_planos").update({
        situacao: pSituacao,
        impacto_vacancia: pImpacto,
        risco_saida: pRisco,
        data_proxima_revisao: pRevisao || null,
        titular_funcionario_id: pTitular || null,
        observacoes: pObs || null,
      }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidarTudo(); setPlanoOpen(false); toast.success("Plano atualizado."); },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const excluir = useMutation({
    mutationFn: async ({ tipo, alvo }: { tipo: string; alvo: string }) => {
      const tabela =
        tipo === "item" ? "rh_sucessao_itens"
        : tipo === "candidato" ? "rh_sucessao_candidatos"
        : "rh_sucessao_planos";
      const { error } = await rhDb.from(tabela).delete().eq("id", alvo);
      if (error) throw error;
      return tipo;
    },
    onSuccess: (tipo) => {
      setConfirmDel(null);
      if (tipo === "plano") { qc.invalidateQueries({ queryKey: ["rh_sucessao_planos"] }); navigate("/sucessao"); }
      else { invalidarTudo(); toast.success("Removido."); }
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  // ---- handlers ------------------------------------------------------------
  const abrirCelula = (candidato: any, item: any) => {
    const a = avalMap.get(`${candidato.id}|${item.id}`);
    setCelula({
      candidatoId: candidato.id, itemId: item.id,
      candidatoNome: funcNome(candidato.funcionario_id),
      itemNome: itemTitulo(item), criterio: itemCriterio(item),
    });
    setCNivel(String(a?.nivel ?? 0));
    setCDataAlvo(a?.data_alvo ?? "");
    setCEvidencia(a?.evidencia ?? "");
    setCelulaOpen(true);
  };

  const abrirNovoItem = () => {
    setEditingItem(null);
    setICategoria("atividade"); setIAtividade(""); setITitulo("");
    setICriterio(""); setIAvaliador(""); setIPeso("1");
    setItemOpen(true);
  };

  const abrirEditItem = (i: any) => {
    setEditingItem(i);
    setICategoria(i.categoria);
    setIAtividade(i.atividade_id ?? "");
    setITitulo(i.titulo ?? "");
    setICriterio(i.criterio_override ?? "");
    setIAvaliador(i.avaliador_id ?? "");
    setIPeso(String(i.peso ?? 1));
    setItemOpen(true);
  };

  const abrirEditPlano = () => {
    if (!plano) return;
    setPSituacao(plano.situacao);
    setPImpacto(plano.impacto_vacancia);
    setPRisco(plano.risco_saida);
    setPRevisao(plano.data_proxima_revisao ?? "");
    setPTitular(plano.titular_funcionario_id ?? "");
    setPObs(plano.observacoes ?? "");
    setPlanoOpen(true);
  };

  const exportarExcel = () => {
    if (itensAtivos.length === 0) { toast.error("Plano sem itens."); return; }
    const rows = itensAtivos.map((i) => {
      const base: Record<string, any> = {
        "Grupo": itemGrupo(i),
        "Categoria": categoriaLabel(i.categoria),
        "Item": itemTitulo(i),
        "Critério": itemCriterio(i) ?? "",
        "Avaliador": funcNome(i.avaliador_id),
        "Peso": Number(i.peso ?? 1),
      };
      for (const c of candAtivos) {
        const a = avalMap.get(`${c.id}|${i.id}`);
        base[funcNome(c.funcionario_id)] = nivelLabel(a?.nivel ?? 0);
        base[`${funcNome(c.funcionario_id)} — data alvo`] = a?.data_alvo ?? "";
      }
      return base;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Plano");
    XLSX.writeFile(wb, `sucessao-${cargoNome(plano.cargo_id).toLowerCase().replace(/\s+/g, "-")}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  // ---- guards --------------------------------------------------------------
  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="font-medium">Acesso restrito</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;
  if (!plano) {
    return (
      <div className="space-y-3">
        <Button variant="outline" size="sm" asChild><Link to="/sucessao"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Link></Button>
        <p className="text-sm text-muted-foreground">Plano não encontrado.</p>
      </div>
    );
  }

  const atvOptions = (catalogo as any[])
    .map((a) => ({ value: a.id, label: `${a.grupo_nome} — ${a.nome}` }))
    .sort((x, y) => x.label.localeCompare(y.label, "pt-BR"));
  const funcOptions = (funcionarios as any[])
    .filter((f) => isActive(f.id))
    .map((f) => ({ value: f.id, label: f.nome_completo }));

  return (
    <div className="space-y-4">
      {/* ---------------- Cabeçalho ---------------- */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
            <Link to="/sucessao"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Planos de sucessão</Link>
          </Button>
          <h1 className="text-2xl font-bold tracking-tight">{cargoNome(plano.cargo_id)}</h1>
          <p className="text-sm text-muted-foreground">
            Titular: {funcNome(plano.titular_funcionario_id)}
            {plano.data_proxima_revisao && <> · revisão em {new Date(plano.data_proxima_revisao + "T12:00").toLocaleDateString("pt-BR")}</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={exportarExcel}>
            <FileDown className="mr-2 h-4 w-4" />Excel
          </Button>
          <Button variant="outline" size="sm" onClick={abrirEditPlano}>
            <Pencil className="mr-2 h-4 w-4" />Editar plano
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge variant={plano.situacao === "ativo" ? "default" : "secondary"}>
          {SITUACOES_PLANO.find((s) => s.value === plano.situacao)?.label}
        </Badge>
        <Badge variant="outline" className={riscoClasses(plano.impacto_vacancia)}>
          impacto da vacância: {plano.impacto_vacancia}
        </Badge>
        <Badge variant="outline" className={riscoClasses(plano.risco_saida)}>
          risco de saída: {plano.risco_saida}
        </Badge>
      </div>

      {/* ---------------- Fragilidades ---------------- */}
      {frags.length > 0 && (
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="p-3 space-y-1">
            {frags.map((f) => (
              <div
                key={f.tipo}
                className={`flex items-center gap-2 text-sm ${
                  f.severidade === "critica" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                }`}
              >
                <TriangleAlert className="h-3.5 w-3.5 shrink-0" />
                {f.mensagem}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ---------------- Candidatos ---------------- */}
      <Card>
        <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Candidatos</CardTitle>
          <Button size="sm" variant="outline" onClick={() => setCandOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" />Adicionar
          </Button>
        </CardHeader>
        <CardContent>
          {candAtivos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum candidato. Considere pelo menos um emergencial (cobre a vaga amanhã)
              e um de desenvolvimento (1–2 anos).
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {candAtivos.map((c, idx) => {
                const pct = prontidaoPor.get(c.id) ?? 0;
                return (
                  <div key={c.id} className="rounded-lg border p-3 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium truncate flex items-center gap-1.5">
                          <span
                            className="inline-block h-2 w-2 rounded-full shrink-0"
                            style={{ background: CORES_LINHA[idx % CORES_LINHA.length] }}
                          />
                          {funcNome(c.funcionario_id)}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {horizonteLabel(c.horizonte)}
                          {c.situacao === "pausado" && " · pausado"}
                        </p>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 shrink-0"
                        onClick={() => setConfirmDel({ tipo: "candidato", id: c.id, nome: funcNome(c.funcionario_id) })}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>

                    <div>
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Pronto</span>
                        <span className="font-semibold">{pct}%</span>
                      </div>
                      <Progress value={pct} className="h-1.5" />
                    </div>

                    <div className="flex items-center gap-2">
                      <Select
                        value={c.horizonte}
                        onValueChange={(v) => patchCandidato.mutate({ cid: c.id, patch: { horizonte: v } })}
                      >
                        <SelectTrigger className="h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {HORIZONTES.map((h) => (
                            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                          <Checkbox
                            checked={c.ciencia_candidato}
                            onCheckedChange={(v) => patchCandidato.mutate({ cid: c.id, patch: { ciencia_candidato: !!v } })}
                          />
                          {c.ciencia_candidato
                            ? <><Eye className="h-3 w-3" />já foi informado</>
                            : <><EyeOff className="h-3 w-3" />não sabe</>}
                        </label>
                      </TooltipTrigger>
                      <TooltipContent className="max-w-xs">
                        A pessoa já foi informada de que é candidata? Marque só depois da
                        conversa presencial — o sistema não notifica ninguém.
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ---------------- Matriz / Evolução ---------------- */}
      <Tabs defaultValue="matriz">
        <TabsList>
          <TabsTrigger value="matriz">Matriz de prontidão</TabsTrigger>
          <TabsTrigger value="evolucao">Evolução</TabsTrigger>
        </TabsList>

        <TabsContent value="matriz" className="space-y-3">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
              {NIVEIS.map((n) => (
                <span key={n.nivel} className={`px-1.5 py-0.5 rounded border ${nivelClasses(n.nivel)}`}>
                  {n.nivel > 0 && `${n.nivel} · `}{n.label}
                </span>
              ))}
            </div>
            <Button size="sm" onClick={abrirNovoItem}>
              <Plus className="mr-2 h-4 w-4" />Novo item
            </Button>
          </div>

          {itensAtivos.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center space-y-3">
                <GraduationCap className="h-6 w-6 mx-auto text-muted-foreground" />
                <p className="font-medium">Nenhum item mapeado</p>
                <p className="text-sm text-muted-foreground max-w-md mx-auto">
                  Adicione os grupos de atividade que o titular desempenha, e as
                  características que não são atividade (experiência, disponibilidade).
                </p>
                <Button variant="outline" onClick={abrirNovoItem}>
                  <Plus className="mr-2 h-4 w-4" />Adicionar item
                </Button>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0 overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="min-w-[280px]">Item</TableHead>
                      <TableHead className="min-w-[140px]">Avaliador</TableHead>
                      {candAtivos.map((c) => (
                        <TableHead key={c.id} className="text-center min-w-[130px]">
                          {funcNome(c.funcionario_id).split(" ")[0]}
                        </TableHead>
                      ))}
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {grupos.map(([grupo, linhas]) => (
                      <Fragment key={grupo}>
                        <TableRow className="bg-muted/50 hover:bg-muted/50">
                          <TableCell colSpan={candAtivos.length + 3} className="py-1.5 font-semibold text-xs uppercase tracking-wide">
                            {grupo}
                          </TableCell>
                        </TableRow>
                        {linhas.map((i) => {
                          const crit = itemCriterio(i);
                          return (
                            <TableRow key={i.id}>
                              <TableCell className="align-top">
                                <div className="flex items-start gap-1.5">
                                  <span className="text-sm">{itemTitulo(i)}</span>
                                  {crit ? (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0 text-muted-foreground" />
                                      </TooltipTrigger>
                                      <TooltipContent className="max-w-sm whitespace-pre-line">
                                        {crit}
                                      </TooltipContent>
                                    </Tooltip>
                                  ) : (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <TriangleAlert className="h-3.5 w-3.5 mt-0.5 shrink-0 text-amber-500" />
                                      </TooltipTrigger>
                                      <TooltipContent>
                                        Sem critério definido — não há régua para dizer se está pronto.
                                      </TooltipContent>
                                    </Tooltip>
                                  )}
                                </div>
                                {i.categoria !== "atividade" && (
                                  <Badge variant="outline" className="mt-1 text-[10px]">
                                    {categoriaLabel(i.categoria)}
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="align-top text-xs text-muted-foreground">
                                {funcNome(i.avaliador_id)}
                              </TableCell>
                              {candAtivos.map((c) => {
                                const a = avalMap.get(`${c.id}|${i.id}`);
                                const n = a?.nivel ?? 0;
                                return (
                                  <TableCell key={c.id} className="text-center align-top p-1.5">
                                    <button
                                      onClick={() => abrirCelula(c, i)}
                                      className={`w-full rounded border px-2 py-1 text-xs hover:ring-2 hover:ring-primary/40 transition ${nivelClasses(n)}`}
                                      title={`${nivelLabel(n)} — clique para alterar`}
                                    >
                                      {nivelLabel(n)}
                                      {a?.data_alvo && (
                                        <span className="block text-[10px] opacity-75">
                                          até {new Date(a.data_alvo + "T12:00").toLocaleDateString("pt-BR")}
                                        </span>
                                      )}
                                    </button>
                                  </TableCell>
                                );
                              })}
                              <TableCell className="align-top p-1">
                                <div className="flex flex-col gap-0.5">
                                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => abrirEditItem(i)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button
                                    variant="ghost" size="icon" className="h-6 w-6"
                                    onClick={() => setConfirmDel({ tipo: "item", id: i.id, nome: itemTitulo(i) })}
                                  >
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </Fragment>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="evolucao">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Curva de prontidão</CardTitle>
              <p className="text-xs text-muted-foreground">
                % de itens em nível “Atende” ou acima, a cada mudança registrada
              </p>
            </CardHeader>
            <CardContent>
              {curva.length < 2 ? (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  Ainda não há histórico suficiente. A curva aparece após algumas
                  avaliações registradas ao longo do tempo.
                </p>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={curva}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="dia" className="text-xs"
                      tickFormatter={(d) => new Date(d + "T12:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    />
                    <YAxis domain={[0, 100]} unit="%" className="text-xs" />
                    <RTooltip
                      formatter={(v: number, name: string) => [`${v}%`, funcNome((candAtivos.find((c) => c.id === name) as any)?.funcionario_id)]}
                      labelFormatter={(d) => new Date(d + "T12:00").toLocaleDateString("pt-BR")}
                    />
                    <Legend formatter={(name) => funcNome((candAtivos.find((c) => c.id === name) as any)?.funcionario_id)} />
                    {candAtivos.map((c, idx) => (
                      <Line
                        key={c.id} type="monotone" dataKey={c.id}
                        stroke={CORES_LINHA[idx % CORES_LINHA.length]}
                        strokeWidth={2} dot={{ r: 3 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ================= Dialogs ================= */}

      {/* Célula */}
      <Dialog open={celulaOpen} onOpenChange={setCelulaOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{celula?.itemNome}</DialogTitle>
            <DialogDescription>{celula?.candidatoNome}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {celula?.criterio && (
              <div className="rounded-md bg-muted p-3 text-sm">
                <p className="font-medium text-xs uppercase tracking-wide text-muted-foreground mb-1">
                  Critério
                </p>
                <p className="whitespace-pre-line">{celula.criterio}</p>
              </div>
            )}
            <div>
              <label className="text-sm">Nível</label>
              <Select value={cNivel} onValueChange={setCNivel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {NIVEIS.map((n) => (
                    <SelectItem key={n.nivel} value={String(n.nivel)}>
                      {n.nivel > 0 ? `${n.nivel} — ` : ""}{n.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground mt-1">
                {NIVEIS.find((n) => String(n.nivel) === cNivel)?.descricao}
              </p>
            </div>
            <div>
              <label className="text-sm">Data alvo</label>
              <Input type="date" value={cDataAlvo} onChange={(e) => setCDataAlvo(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Evidência</label>
              <Textarea
                rows={2} value={cEvidencia} onChange={(e) => setCEvidencia(e.target.value)}
                placeholder="O que sustenta esta avaliação (fato observado, treinamento, entrega)"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCelulaOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarCelula.mutate()} disabled={salvarCelula.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item */}
      <Dialog open={itemOpen} onOpenChange={setItemOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Editar item" : "Novo item"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Categoria</label>
              <Select value={iCategoria} onValueChange={setICategoria}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {iCategoria === "atividade" ? (
              <div>
                <label className="text-sm">Atividade do catálogo *</label>
                <Combobox
                  options={atvOptions} value={iAtividade} onValueChange={setIAtividade}
                  placeholder="Buscar atividade" emptyMessage="Nenhuma atividade"
                />
                {iAtividade && (
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {atvById(iAtividade)?.criterio_proficiencia
                      ? <>Critério do catálogo: “{atvById(iAtividade)?.criterio_proficiencia}”</>
                      : <span className="text-amber-600 dark:text-amber-400">
                          Esta atividade não tem critério de proficiência. Defina em
                          Auditorias → Atividades para reaproveitar em todos os planos.
                        </span>}
                  </p>
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm">Título *</label>
                <Input
                  value={iTitulo} onChange={(e) => setITitulo(e.target.value)}
                  placeholder="Ex.: Disponibilidade para mudança de cidade"
                />
              </div>
            )}

            <div>
              <label className="text-sm">
                Critério {iCategoria === "atividade" ? "(sobrescreve o do catálogo)" : "*"}
              </label>
              <Textarea
                rows={3} value={iCriterio} onChange={(e) => setICriterio(e.target.value)}
                placeholder="Está pronto quando…"
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                Escreva o fato observável, não o traço de personalidade — “já ficou 1 mês
                em obra fora da cidade” é verificável; “extrovertido” não é.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Avaliador</label>
                <Combobox options={funcOptions} value={iAvaliador} onValueChange={setIAvaliador}
                  placeholder="—" emptyMessage="—" />
              </div>
              <div>
                <label className="text-sm">Peso</label>
                <Input type="number" step="0.5" min="0" value={iPeso} onChange={(e) => setIPeso(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setItemOpen(false)}>Cancelar</Button>
            <Button
              onClick={() => salvarItem.mutate()}
              disabled={
                salvarItem.isPending ||
                (iCategoria === "atividade" ? !iAtividade : !iTitulo.trim())
              }
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Candidato */}
      <Dialog open={candOpen} onOpenChange={setCandOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Adicionar candidato</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Colaborador *</label>
              <Combobox options={funcOptions} value={kFunc} onValueChange={setKFunc}
                placeholder="Selecionar" emptyMessage="—" />
            </div>
            <div>
              <label className="text-sm">Horizonte</label>
              <Select value={kHorizonte} onValueChange={setKHorizonte}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {HORIZONTES.map((h) => (
                    <SelectItem key={h.value} value={h.value}>{h.label} — {h.descricao}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Separator />
            <p className="text-xs text-muted-foreground">
              O candidato não recebe nenhuma notificação e não vê este plano. Marque
              “já foi informado” apenas depois da conversa.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCandOpen(false)}>Cancelar</Button>
            <Button onClick={() => addCandidato.mutate()} disabled={!kFunc || addCandidato.isPending}>
              Adicionar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Plano */}
      <Dialog open={planoOpen} onOpenChange={setPlanoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Editar plano</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Titular atual</label>
              <Combobox options={funcOptions} value={pTitular} onValueChange={setPTitular}
                placeholder="—" emptyMessage="—" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-sm">Situação</label>
                <Select value={pSituacao} onValueChange={setPSituacao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SITUACOES_PLANO.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Impacto</label>
                <Select value={pImpacto} onValueChange={setPImpacto}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEIS_RISCO.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">Risco de saída</label>
                <Select value={pRisco} onValueChange={setPRisco}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {NIVEIS_RISCO.map((n) => (
                      <SelectItem key={n.value} value={n.value}>{n.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm">Próxima revisão</label>
              <Input type="date" value={pRevisao} onChange={(e) => setPRevisao(e.target.value)} />
            </div>
            <div>
              <label className="text-sm">Observações</label>
              <Textarea rows={3} value={pObs} onChange={(e) => setPObs(e.target.value)} />
            </div>
            <Separator />
            <Button
              variant="ghost" size="sm"
              className="text-destructive hover:text-destructive"
              onClick={() => { setPlanoOpen(false); setConfirmDel({ tipo: "plano", id: plano.id, nome: cargoNome(plano.cargo_id) }); }}
            >
              <Trash2 className="mr-2 h-4 w-4" />Excluir plano
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPlanoOpen(false)}>Cancelar</Button>
            <Button onClick={() => salvarPlano.mutate()} disabled={salvarPlano.isPending}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmar exclusão */}
      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {confirmDel?.nome}?</AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDel?.tipo === "plano"
                ? "O plano, seus itens, candidatos, avaliações e histórico serão apagados. Não há como desfazer."
                : confirmDel?.tipo === "candidato"
                  ? "As avaliações deste candidato serão apagadas. O histórico de evolução é preservado."
                  : "As avaliações deste item, em todos os candidatos, serão apagadas."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => confirmDel && excluir.mutate({ tipo: confirmDel.tipo, alvo: confirmDel.id })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
