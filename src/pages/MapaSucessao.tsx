import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rhDb, supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { toast } from "sonner";
import {
  CheckCircle2, Clock, ExternalLink, Eye, HelpCircle, History, Network, RefreshCw, Settings2, Target, Trash2, UserPlus, Users,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  COBERTURA_POSICAO, indicadores, serieHistorica, type CoberturaPosicao,
} from "@/lib/mapaSucessao";
import { cobreCargo, MESES_VALIDADE_APROVACAO, vencimentoAprovacao } from "@/lib/sucessao";

const TALENTS_URL = "https://talents.youngempreendimentos.com.br";

type Aprovacao = "pendente" | "aprovada" | "vencida";

interface Sucessor {
  id: string;
  funcionario_id: string;
  nome: string;
  cobertura: "total" | "parcial";
  observacoes: string | null;
  ativo: boolean;
  aprovacao: Aprovacao;
  aprovado_em: string | null;
  aprovado_por_nome: string | null;
  indicado_por_nome: string | null;
  indicado_por: string | null;
  /** Ativo e com aprovação válida: entra no indicador. */
  conta: boolean;
}

interface ExternoMapa {
  mapping_id: string;
  candidate_id: string;
  nome: string | null;
  nivel: "interessante" | "forte";
  generico: boolean;
  qualquer_cidade: boolean;
  especificacao: string | null;
  conta: boolean;
  /** Só vem para admin. */
  alternativa?: boolean;
}

export interface Posicao {
  posicao: string;
  funcao_id: string;
  funcao: string;
  trilha: string | null;
  equipe_id: string;
  equipe: string;
  cidade_ibge: number | null;
  cidade: string | null;
  titular_id: string | null;
  titular: string | null;
  vaga: boolean;
  exige: boolean;
  ocupantes: { id: string; nome: string; individual: boolean }[];
  sucessores: Sucessor[];
  externos: ExternoMapa[];
  n_total: number;
  n_parcial: number;
  n_externos: number;
  cobertura: CoberturaPosicao;
}

const fmtDia = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const fmtData = (iso: string) => new Date(iso).toLocaleDateString("pt-BR");
export const primeiroNome = (nome: string) =>
  nome.toLowerCase().split(" ")[0].replace(/^\p{L}/u, (c) => c.toUpperCase());
const cidadeCurta = (c: string | null) => (c ? c.replace(/\/RS$/, "") : "cidade não definida");

const EVENTO: Record<string, string> = {
  indicado: "Indicado",
  aprovado: "Aprovado",
  revalidado: "Revalidado",
  cobertura: "Cobertura alterada",
  removido: "Removido",
};

const APROVACAO: Record<Aprovacao, { label: string; classes: string }> = {
  aprovada: { label: "aprovada", classes: "border-emerald-400 text-emerald-700 dark:text-emerald-300" },
  pendente: { label: "aguardando aprovação", classes: "border-amber-400 text-amber-700 dark:text-amber-300" },
  vencida: { label: "aprovação vencida", classes: "border-red-400 text-red-700 dark:text-red-300" },
};

/**
 * Mapa de sucessão: cada posição (função + equipe + cidade, ou individual) do
 * quadro atual e a cobertura dela pelo mapeamento simplificado — internos
 * indicados aqui (contam depois de aprovados por admin, por 6 meses) e externos
 * do Talents. Admin e coordenador veem e indicam; só admin aprova e configura.
 * Os planos de sucessão completos aparecem só para admin e não mudam a cor.
 */
export default function MapaSucessao() {
  const { isAdmin } = useAuth();
  const [filtro, setFiltro] = useState<"todas" | CoberturaPosicao | "pendentes">("todas");
  const [cidadeFiltro, setCidadeFiltro] = useState<string>("todas");
  const [abertaKey, setAbertaKey] = useState<string | null>(null);

  const { data: todas = [], isLoading, error } = useQuery({
    queryKey: ["rh_mapa_cobertura"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_mapa_cobertura" as any);
      if (error) throw error;
      return (data ?? []) as unknown as Posicao[];
    },
  });
  // Posições que o admin marcou como "não exige mapeamento" ficam fora.
  const posicoes = useMemo(() => todas.filter((p) => p.exige), [todas]);

  const { data: fotos = [] } = useQuery({
    queryKey: ["rh_mapa_cobertura_historico"],
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_mapa_cobertura_historico" as any)
        .select("data, cobertura, headcount")
        .order("data");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Planos completos: só admin. Entram na posição do titular.
  const { data: planos = [] } = useQuery({
    queryKey: ["rh_sucessao_planos_mapa"],
    enabled: isAdmin,
    queryFn: async () => {
      const [ps, fs] = await Promise.all([
        rhDb.from("rh_sucessao_planos").select("id, funcao_id, titular_funcionario_id, situacao"),
        rhDb.from("rh_funcoes").select("id, nome"),
      ]);
      if (ps.error) throw ps.error;
      const nomes = new Map(((fs.data ?? []) as any[]).map((f) => [f.id, f.nome]));
      return ((ps.data ?? []) as any[])
        .filter((p) => cobreCargo(p.situacao))
        .map((p) => ({ ...p, funcaoNome: nomes.get(p.funcao_id) ?? "Plano" }));
    },
  });

  const planosPorPosicao = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const pos of posicoes) {
      const ids = new Set(pos.ocupantes.map((o) => o.id));
      const ps = planos.filter((p: any) => p.titular_funcionario_id && ids.has(p.titular_funcionario_id));
      if (ps.length) m.set(pos.posicao, ps);
    }
    return m;
  }, [posicoes, planos]);

  const kpis = useMemo(
    () => indicadores(posicoes.map((p) => ({ cobertura: p.cobertura, headcount: p.ocupantes.length }))),
    [posicoes],
  );
  const pendentes = useMemo(
    () => posicoes.reduce((s, p) => s + p.sucessores.filter((x) => x.aprovacao !== "aprovada" && x.ativo).length, 0),
    [posicoes],
  );

  // A foto de hoje é gravada às 23h55; até lá, o ponto de hoje é o ao vivo.
  const serie = useMemo(() => {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const pontos = serieHistorica(fotos).filter((p) => p.data !== hoje);
    if (posicoes.length) pontos.push({ data: hoje, ...kpis });
    return pontos;
  }, [fotos, kpis, posicoes.length]);

  const cidades = useMemo(
    () => [...new Set(posicoes.map((p) => p.cidade ?? ""))].sort((a, b) => a.localeCompare(b, "pt-BR")),
    [posicoes],
  );

  const porEquipe = useMemo(() => {
    const m = new Map<string, Posicao[]>();
    for (const p of posicoes) {
      if (!m.has(p.equipe)) m.set(p.equipe, []);
      m.get(p.equipe)!.push(p);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [posicoes]);

  const passaFiltro = (p: Posicao) =>
    (cidadeFiltro === "todas" || (p.cidade ?? "") === cidadeFiltro)
    && (filtro === "todas"
      || (filtro === "pendentes" ? p.sucessores.some((s) => s.aprovacao !== "aprovada" && s.ativo) : p.cobertura === filtro));

  const aberta = posicoes.find((p) => p.posicao === abertaKey) ?? null;

  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-destructive">
          Não foi possível carregar o mapa: {(error as any).message}
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Network className="h-6 w-6 text-primary" /> Mapa de sucessão
          </h1>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5">
            Cada posição do quadro atual e quem poderia cobri-la. <AjudaPosicao />
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={cidadeFiltro} onValueChange={setCidadeFiltro}>
            <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as cidades</SelectItem>
              {cidades.map((c) => <SelectItem key={c || "_"} value={c}>{cidadeCurta(c || null)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
            <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas as posições</SelectItem>
              <SelectItem value="descoberta">Só descobertas</SelectItem>
              <SelectItem value="parcial">Só parciais</SelectItem>
              <SelectItem value="total">Só com cobertura total</SelectItem>
              <SelectItem value="pendentes">Com indicação a aprovar</SelectItem>
            </SelectContent>
          </Select>
          {isAdmin && (
            <Button variant="outline" asChild>
              <Link to="/mapa-sucessao/configuracao"><Settings2 className="mr-2 h-4 w-4" />Configurar</Link>
            </Button>
          )}
        </div>
      </div>

      {/* ---------------- Indicadores ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Índice de cobertura" valor={`${kpis.indice}%`} hint="parcial vale meia cobertura" destaque />
        <Kpi label="Cobertura total" valor={`${kpis.total}/${kpis.posicoes}`} hint="posições" dot="bg-emerald-500" />
        <Kpi label="Cobertura parcial" valor={String(kpis.parcial)} hint="posições" dot="bg-amber-500" />
        <Kpi label="Descobertas" valor={String(kpis.descoberta)} hint="posições" dot="bg-red-500" />
        <Kpi label="Cobertura por pessoas" valor={`${kpis.porPessoas}%`} hint="ponderada pelo tamanho da posição" />
      </div>

      {pendentes > 0 && (
        <button
          onClick={() => setFiltro("pendentes")}
          className="w-full text-left rounded-md border border-amber-300 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-sm text-amber-800 dark:text-amber-200 flex items-center gap-2"
        >
          <Clock className="h-4 w-4 shrink-0" />
          {pendentes} {pendentes === 1 ? "indicação aguarda" : "indicações aguardam"} aprovação ou revalidação
          {isAdmin ? " — clique para ver." : " de um administrador."} Só contam no indicador depois de aprovadas.
        </button>
      )}

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uma foto por dia, às 23h55.{" "}
            {serie.length <= 1
              ? `A série começou em ${serie[0] ? fmtData(serie[0].data + "T12:00") : "—"}; o gráfico ganha forma conforme as fotos acumulam.`
              : `Desde ${fmtData(serie[0].data + "T12:00")}.`}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={serie} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="data" tickFormatter={fmtDia} className="text-xs" />
              <YAxis domain={[0, 100]} unit="%" className="text-xs" />
              <RTooltip
                labelFormatter={(d: string) => fmtData(d + "T12:00")}
                formatter={(v: number, nome: string) => [`${v}%`, nome]}
              />
              <Legend />
              <Line type="monotone" dataKey="indice" name="Índice de cobertura" stroke="hsl(var(--primary))" strokeWidth={2} dot={serie.length < 40} />
              <Line type="monotone" dataKey="porPessoas" name="Por pessoas" stroke="hsl(142 71% 40%)" strokeWidth={2} strokeDasharray="5 3" dot={serie.length < 40} />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* ---------------- Quadro por equipe ---------------- */}
      <div className="flex items-center gap-4 flex-wrap text-xs text-muted-foreground">
        {(Object.keys(COBERTURA_POSICAO) as CoberturaPosicao[]).map((c) => (
          <span key={c} className="inline-flex items-center gap-1.5">
            <span className={`h-2.5 w-2.5 rounded-full ${COBERTURA_POSICAO[c].dot}`} />{COBERTURA_POSICAO[c].label}
          </span>
        ))}
        <span>· Externos "Interessante" e indicações não aprovadas aparecem, mas não contam.</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {porEquipe.map(([equipe, lista]) => {
            const visiveis = lista.filter(passaFiltro);
            if (!visiveis.length) return null;
            const ie = indicadores(lista.map((p) => ({ cobertura: p.cobertura, headcount: p.ocupantes.length })));
            const pessoas = lista.reduce((s, p) => s + p.ocupantes.length, 0);
            return (
              <Card key={equipe}>
                <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
                  <CardTitle className="text-sm">{equipe}</CardTitle>
                  <span className="text-xs text-muted-foreground">
                    {pessoas} {pessoas === 1 ? "pessoa" : "pessoas"} · índice {ie.indice}%
                  </span>
                </CardHeader>
                <CardContent className="space-y-2">
                  {visiveis.map((p) => (
                    <PosicaoCard key={p.posicao} p={p} temPlano={planosPorPosicao.has(p.posicao)} onClick={() => setAbertaKey(p.posicao)} />
                  ))}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {aberta && (
        <PosicaoDialog
          posicao={aberta}
          planos={planosPorPosicao.get(aberta.posicao) ?? []}
          onClose={() => setAbertaKey(null)}
        />
      )}
    </div>
  );
}

/**
 * (?) com a definição de posição e de cobertura. Abre ao passar o mouse e
 * também ao tocar (tooltip puro não abre no celular).
 */
export function AjudaPosicao() {
  const [aberto, setAberto] = useState(false);
  return (
    <Tooltip open={aberto} onOpenChange={setAberto}>
      <TooltipTrigger asChild>
        <button type="button" onClick={() => setAberto((v) => !v)} aria-label="O que é uma posição?"
          className="inline-flex text-muted-foreground hover:text-foreground align-middle">
          <HelpCircle className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom" align="start" className="max-w-sm space-y-1.5 text-xs leading-relaxed">
        <p><strong>Posição = função + equipe + cidade de atuação.</strong></p>
        <p>
          Ex.: os 2 Consultores Comerciais de Bagé são uma posição; os de Cruz Alta, outra. Quem está na mesma
          posição compartilha o mapeamento (um sucessor cobre o grupo), a menos que o admin marque
          "mapeamento próprio" para alguém.
        </p>
        <p>
          <strong>Total:</strong> há sucessor interno aprovado que cobre total.{" "}
          <strong>Parcial:</strong> interno aprovado que cobre parcial, ou externo do Talents (Forte ou
          Alternativa externa). Indicações contam depois de aprovadas, por {MESES_VALIDADE_APROVACAO} meses.
        </p>
        <p>Índice: total vale 1, parcial vale ½, descoberta vale 0.</p>
      </TooltipContent>
    </Tooltip>
  );
}

function PosicaoCard({ p, temPlano, onClick }: { p: Posicao; temPlano: boolean; onClick: () => void }) {
  const internosTotal = p.sucessores.filter((s) => s.conta && s.cobertura === "total").length;
  const internosParcial = p.sucessores.filter((s) => s.conta && s.cobertura === "parcial").length;
  const aAprovar = p.sucessores.filter((s) => s.ativo && s.aprovacao === "pendente").length;
  const vencidas = p.sucessores.filter((s) => s.ativo && s.aprovacao === "vencida").length;
  const externosConta = p.externos.filter((e) => e.conta).length;
  const interessantes = p.externos.length - externosConta;
  return (
    <button
      onClick={onClick}
      className={`w-full text-left rounded-md border border-l-4 p-2.5 transition-shadow hover:shadow-md ${COBERTURA_POSICAO[p.cobertura].card}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium leading-tight">
            {p.funcao}
            {p.titular && <span className="font-normal text-muted-foreground"> · {primeiroNome(p.titular)}</span>}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {cidadeCurta(p.cidade)}
            {p.vaga
              ? " · sem ocupante"
              : ` · ${p.ocupantes.length} · ${p.ocupantes.map((o) => primeiroNome(o.nome)).join(", ")}`}
          </p>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {p.vaga && <Badge variant="outline" className="text-[10px]">vaga</Badge>}
          {p.titular && <Badge variant="outline" className="text-[10px]" title="Exige mapeamento próprio">individual</Badge>}
          {temPlano && (
            <Badge variant="outline" className="text-[10px] gap-1" title="Tem plano de sucessão completo (só admin vê)">
              <Target className="h-3 w-3" />plano
            </Badge>
          )}
        </div>
      </div>
      <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
        {internosTotal > 0 && <Chip cor="bg-emerald-500">{internosTotal} interno{internosTotal > 1 ? "s" : ""} total</Chip>}
        {internosParcial > 0 && <Chip cor="bg-amber-500">{internosParcial} interno{internosParcial > 1 ? "s" : ""} parcial</Chip>}
        {externosConta > 0 && <Chip cor="bg-violet-500">{externosConta} externo{externosConta > 1 ? "s" : ""}</Chip>}
        {aAprovar > 0 && <Chip cor="bg-amber-300">{aAprovar} a aprovar</Chip>}
        {vencidas > 0 && <Chip cor="bg-red-400">{vencidas} aprovação vencida{vencidas > 1 ? "s" : ""}</Chip>}
        {interessantes > 0 && <Chip cor="bg-slate-400">{interessantes} interessante{interessantes > 1 ? "s" : ""}</Chip>}
        {p.cobertura === "descoberta" && interessantes === 0 && aAprovar === 0 && vencidas === 0 && (
          <span className="text-red-700 dark:text-red-300">ninguém mapeado</span>
        )}
      </div>
    </button>
  );
}

function Kpi({ label, valor, hint, dot, destaque }: { label: string; valor: string; hint: string; dot?: string; destaque?: boolean }) {
  return (
    <Card className={destaque ? "border-primary/40" : undefined}>
      <CardContent className="p-3">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          {dot && <span className={`h-2 w-2 rounded-full ${dot}`} />}{label}
        </p>
        <p className={`font-bold tabular-nums ${destaque ? "text-3xl text-primary" : "text-2xl"}`}>{valor}</p>
        <p className="text-[11px] text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function Chip({ cor, children }: { cor: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background/80 border px-1.5 py-0.5">
      <span className={`h-1.5 w-1.5 rounded-full ${cor}`} />{children}
    </span>
  );
}

function PosicaoDialog({ posicao: p, planos, onClose }: { posicao: Posicao; planos: any[]; onClose: () => void }) {
  const qc = useQueryClient();
  const { isAdmin, role, user } = useAuth();
  const podeIndicar = isAdmin || role === "coordenador";
  const { funcionarios, isActive } = useActiveEmployees();
  const [novo, setNovo] = useState<{ funcionarioId: string; cobertura: "total" | "parcial"; obs: string }>({
    funcionarioId: "", cobertura: "parcial", obs: "",
  });

  const invalidar = () => {
    qc.invalidateQueries({ queryKey: ["rh_mapa_cobertura"] });
    qc.invalidateQueries({ queryKey: ["rh_mapa_sucessores_hist", p.posicao] });
  };

  // Histórico da posição: sobrevive à remoção da indicação, para ninguém
  // "esquecer" um bom candidato cuja aprovação venceu ou que foi tirado.
  const { data: historico = [] } = useQuery({
    queryKey: ["rh_mapa_sucessores_hist", p.posicao],
    queryFn: async () => {
      let q = rhDb.from("rh_mapa_sucessores_hist" as any).select("*")
        .eq("funcao_id", p.funcao_id).eq("equipe_id", p.equipe_id);
      q = p.cidade_ibge == null ? q.is("cidade_ibge", null) : q.eq("cidade_ibge", p.cidade_ibge);
      q = p.titular_id == null ? q.is("titular_funcionario_id", null) : q.eq("titular_funcionario_id", p.titular_id);
      const { data, error } = await q.order("em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Quem já foi indicado aqui e não está mais na lista (removido).
  const anteriores = useMemo(() => {
    const atuais = new Set(p.sucessores.map((s) => s.funcionario_id));
    const vistos = new Map<string, any>();
    for (const h of historico) {
      if (atuais.has(h.funcionario_id) || vistos.has(h.funcionario_id)) continue;
      vistos.set(h.funcionario_id, {
        ...h,
        aprovacoes: historico.filter((x) => x.funcionario_id === h.funcionario_id && (x.evento === "aprovado" || x.evento === "revalidado")).length,
      });
    }
    return [...vistos.values()];
  }, [historico, p.sucessores]);

  const jaTeveHistorico = !!novo.funcionarioId && historico.some((h) => h.funcionario_id === novo.funcionarioId);

  // Candidatos internos: ativos, fora da própria posição e ainda não indicados.
  const opcoes = useMemo(() => {
    const fora = new Set([...p.ocupantes.map((o) => o.id), ...p.sucessores.map((s) => s.funcionario_id)]);
    return (funcionarios as any[])
      .filter((f) => isActive(f.id) && !fora.has(f.id))
      .map((f) => ({ value: f.id, label: `${f.nome_completo}${f.rh_equipes?.nome ? ` — ${f.rh_equipes.nome}` : ""}` }));
  }, [funcionarios, isActive, p]);

  const adicionar = useMutation({
    mutationFn: async () => {
      const { error } = await rhDb.from("rh_mapa_sucessores" as any).insert({
        funcao_id: p.funcao_id, equipe_id: p.equipe_id, cidade_ibge: p.cidade_ibge,
        titular_funcionario_id: p.titular_id, funcionario_id: novo.funcionarioId,
        cobertura: novo.cobertura, observacoes: novo.obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidar();
      setNovo({ funcionarioId: "", cobertura: "parcial", obs: "" });
      toast.success(isAdmin ? "Sucessor indicado e aprovado." : "Indicação enviada — conta no indicador depois que um administrador aprovar.");
    },
    onError: () => toast.error("Erro ao indicar sucessor."),
  });

  const mudar = useMutation({
    mutationFn: async ({ id, cobertura }: { id: string; cobertura: string }) => {
      const { error } = await rhDb.from("rh_mapa_sucessores" as any).update({ cobertura }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidar,
    onError: () => toast.error("Erro ao atualizar."),
  });

  const aprovar = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("rh_mapa_aprovar_sucessor" as any, { p_id: id });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Indicação aprovada."); },
    onError: () => toast.error("Erro ao aprovar."),
  });

  const remover = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rhDb.from("rh_mapa_sucessores" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); toast.success("Indicação removida."); },
    onError: () => toast.error("Erro ao remover."),
  });

  const nivelExterno = (e: ExternoMapa) =>
    e.alternativa ? "Alternativa externa" : e.nivel === "forte" ? "Forte" : "Interessante — não conta";

  // Mesma régua do banco (+6 meses, prendendo no fim do mês curto).
  const vence = (iso: string) => vencimentoAprovacao(iso.slice(0, 10))?.toLocaleDateString("pt-BR") ?? "—";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {p.funcao} · {p.equipe}
            {p.titular && <span className="font-normal"> · {p.titular}</span>}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={COBERTURA_POSICAO[p.cobertura].badge}>{COBERTURA_POSICAO[p.cobertura].label}</Badge>
            <span>{cidadeCurta(p.cidade)}</span>
            {p.vaga ? <Badge variant="outline">vaga — sem ocupante</Badge> : <span>· {p.ocupantes.map((o) => o.nome).join(", ")}</span>}
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Sucessores internos
          </h3>
          {p.sucessores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém indicado.</p>
          ) : (
            p.sucessores.map((s) => {
              const minhaPendente = !isAdmin && s.aprovacao === "pendente" && s.indicado_por === user?.id;
              return (
                <div key={s.id} className={`rounded-md border p-2 ${s.conta ? "" : "opacity-80"}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {s.nome}
                        {!s.ativo && <span className="ml-1 text-xs text-destructive">(desligado — não conta)</span>}
                      </p>
                      <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                        <Badge variant="outline" className={`text-[10px] ${APROVACAO[s.aprovacao].classes}`}>
                          {APROVACAO[s.aprovacao].label}
                          {s.aprovacao === "aprovada" && s.aprovado_em && ` até ${vence(s.aprovado_em)}`}
                        </Badge>
                        <span className="text-[11px] text-muted-foreground">
                          {s.indicado_por_nome ? `indicado por ${s.indicado_por_nome}` : ""}
                          {s.aprovado_por_nome && s.aprovacao !== "pendente" ? ` · aprovado por ${s.aprovado_por_nome}` : ""}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      {isAdmin ? (
                        <Select value={s.cobertura} onValueChange={(v) => mudar.mutate({ id: s.id, cobertura: v })}>
                          <SelectTrigger className="h-7 w-[100px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="total">Total</SelectItem>
                            <SelectItem value="parcial">Parcial</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Badge variant="outline" className={COBERTURA_POSICAO[s.cobertura].badge}>{s.cobertura === "total" ? "Total" : "Parcial"}</Badge>
                      )}
                      {(isAdmin || minhaPendente) && (
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover indicação"
                          onClick={() => window.confirm(`Remover ${s.nome} desta posição?`) && remover.mutate(s.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>
                  {s.observacoes && <p className="text-xs text-muted-foreground mt-1">{s.observacoes}</p>}
                  {isAdmin && s.aprovacao !== "aprovada" && s.ativo && (
                    <Button size="sm" variant="outline" className="mt-2" onClick={() => aprovar.mutate(s.id)} disabled={aprovar.isPending}>
                      {s.aprovacao === "pendente"
                        ? <><CheckCircle2 className="mr-1 h-3.5 w-3.5" />Aprovar</>
                        : <><RefreshCw className="mr-1 h-3.5 w-3.5" />Revalidar</>}
                    </Button>
                  )}
                </div>
              );
            })
          )}

          {podeIndicar && (
            <div className="rounded-md border border-dashed p-2 space-y-2">
              <Combobox
                options={opcoes}
                value={novo.funcionarioId}
                onValueChange={(v) => setNovo((n) => ({ ...n, funcionarioId: v }))}
                placeholder="Indicar funcionário..."
                searchPlaceholder="Buscar funcionário..."
                emptyMessage="Nenhum funcionário disponível."
              />
              <div className="flex gap-2">
                <Select value={novo.cobertura} onValueChange={(v) => setNovo((n) => ({ ...n, cobertura: v as any }))}>
                  <SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="total">Cobre total</SelectItem>
                    <SelectItem value="parcial">Cobre parcial</SelectItem>
                  </SelectContent>
                </Select>
                <Button className="flex-1" onClick={() => adicionar.mutate()} disabled={!novo.funcionarioId || adicionar.isPending}>
                  <UserPlus className="mr-2 h-4 w-4" />Indicar
                </Button>
              </div>
              <Textarea rows={2} placeholder="Observação (opcional)" value={novo.obs}
                onChange={(e) => setNovo((n) => ({ ...n, obs: e.target.value }))} />
              {jaTeveHistorico && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300">
                  Esta pessoa já foi indicada para esta posição antes — veja o histórico abaixo.
                </p>
              )}
              {!isAdmin && (
                <p className="text-[11px] text-muted-foreground">
                  A indicação conta no indicador depois de aprovada por um administrador, e a aprovação vale {MESES_VALIDADE_APROVACAO} meses.
                </p>
              )}
            </div>
          )}
        </section>

        {anteriores.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Indicados anteriormente
            </h3>
            {anteriores.map((a) => {
              const ativo = isActive(a.funcionario_id);
              return (
                <div key={a.funcionario_id} className="flex items-start justify-between gap-2 rounded-md border border-dashed p-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">
                      {a.funcionario_nome ?? "(sem nome)"}
                      {!ativo && <span className="ml-1 text-xs text-muted-foreground">(desligado)</span>}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      removido em {fmtData(a.em)}{a.por_nome ? ` por ${a.por_nome}` : ""}
                      {a.detalhe ? ` · ${a.detalhe}` : ""}
                      {a.aprovacoes > 0 ? ` · aprovado ${a.aprovacoes}×` : ""}
                    </p>
                  </div>
                  {podeIndicar && ativo && (
                    <Button size="sm" variant="outline" className="shrink-0"
                      onClick={() => setNovo({ funcionarioId: a.funcionario_id, cobertura: (a.cobertura as any) || "parcial", obs: "" })}>
                      Indicar de novo
                    </Button>
                  )}
                </div>
              );
            })}
          </section>
        )}

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> Externos (Talents)
          </h3>
          {p.externos.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém mapeado no Talents para {p.funcao}.</p>
          ) : (
            p.externos.map((e) => (
              <div key={e.mapping_id} className={`flex items-start justify-between gap-2 rounded-md border p-2 ${e.conta ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <a href={`${TALENTS_URL}/candidate/${e.candidate_id}`} target="_blank" rel="noreferrer"
                    className="text-sm font-medium hover:underline inline-flex items-center gap-1">
                    {e.nome ?? "(sem nome)"}<ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {[e.especificacao, e.generico ? "qualquer equipe" : null, e.qualquer_cidade ? "qualquer cidade" : null]
                      .filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{nivelExterno(e)}</Badge>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground">
            Externos entram mapeando no Talents com esta função (equipe e cidade, ou "qualquer"). Forte e
            alternativa externa cobrem parcialmente.
          </p>
        </section>

        {historico.length > 0 && (
          <details className="rounded-md border px-3 py-2">
            <summary className="cursor-pointer text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <History className="h-3.5 w-3.5" /> Histórico de indicações ({historico.length})
            </summary>
            <ol className="mt-2 space-y-1.5">
              {historico.map((h) => (
                <li key={h.id} className="text-xs">
                  <span className="text-muted-foreground tabular-nums">{fmtData(h.em)}</span>{" "}
                  <span className="font-medium">{EVENTO[h.evento] ?? h.evento}</span>{" "}
                  — {h.funcionario_nome ?? "(sem nome)"}
                  {h.cobertura && h.evento !== "cobertura" ? ` (${h.cobertura})` : ""}
                  {h.por_nome ? <span className="text-muted-foreground"> · por {h.por_nome}</span> : null}
                  {h.detalhe ? <span className="block text-muted-foreground pl-4">{h.detalhe}</span> : null}
                </li>
              ))}
            </ol>
          </details>
        )}

        {isAdmin && (
          <section className="space-y-2 border-t pt-3">
            <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5" /> Plano de sucessão completo <span className="normal-case font-normal">(só admin)</span>
            </h3>
            {planos.length ? (
              planos.map((pl) => (
                <Button key={pl.id} variant="outline" size="sm" asChild>
                  <Link to={`/sucessao/${pl.id}`}><Eye className="mr-2 h-4 w-4" />Abrir plano — {pl.funcaoNome}</Link>
                </Button>
              ))
            ) : (
              <p className="text-xs text-muted-foreground">
                Sem plano. Para posições críticas, abra um em <Link to="/sucessao" className="underline">Sucessão</Link>.
                O plano não altera a cor desta posição — ela segue o mapeamento simplificado.
              </p>
            )}
          </section>
        )}
      </DialogContent>
    </Dialog>
  );
}
