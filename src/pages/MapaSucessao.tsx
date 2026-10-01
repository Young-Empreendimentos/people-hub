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
import { ExternalLink, Eye, Network, Target, Trash2, UserPlus, Users } from "lucide-react";
import {
  COBERTURA_POSICAO, indicadores, serieHistorica, type CoberturaPosicao,
} from "@/lib/mapaSucessao";
import { cobreCargo } from "@/lib/sucessao";

const TALENTS_URL = "https://talents.youngempreendimentos.com.br";

interface Sucessor {
  id: string;
  funcionario_id: string;
  nome: string;
  cobertura: "total" | "parcial";
  observacoes: string | null;
  ativo: boolean;
}

interface ExternoMapa {
  mapping_id: string;
  candidate_id: string;
  nome: string | null;
  nivel: "interessante" | "forte";
  generico: boolean;
  especificacao: string | null;
  conta: boolean;
  /** Só vem para admin. */
  alternativa?: boolean;
}

interface Posicao {
  funcao_id: string;
  funcao: string;
  trilha: string | null;
  equipe_id: string;
  equipe: string;
  ocupantes: { id: string; nome: string }[];
  sucessores: Sucessor[];
  externos: ExternoMapa[];
  n_total: number;
  n_parcial: number;
  n_externos: number;
  cobertura: CoberturaPosicao;
}

const chave = (p: { funcao_id: string; equipe_id: string }) => `${p.funcao_id}|${p.equipe_id}`;
const fmtDia = (iso: string) => {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
};
const primeiroNome = (nome: string) =>
  nome.toLowerCase().split(" ")[0].replace(/^\p{L}/u, (c) => c.toUpperCase());

/**
 * Mapa de sucessão: todas as posições (função + equipe) do quadro atual e a
 * cobertura de cada uma pelo mapeamento simplificado (internos indicados aqui;
 * externos vindos do Talents). Admin e coordenador veem; só admin edita. Os
 * planos de sucessão completos aparecem só para admin e não mudam a cor.
 */
export default function MapaSucessao() {
  const { isAdmin } = useAuth();
  const [filtro, setFiltro] = useState<"todas" | CoberturaPosicao>("todas");
  const [abertaKey, setAbertaKey] = useState<string | null>(null);

  const { data: posicoes = [], isLoading, error } = useQuery({
    queryKey: ["rh_mapa_cobertura"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_mapa_cobertura" as any);
      if (error) throw error;
      return (data ?? []) as unknown as Posicao[];
    },
  });

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

  // Planos completos: só admin. Entram na posição do titular (função do cargo
  // dele + equipe), que pode diferir da função do plano.
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
      if (ps.length) m.set(chave(pos), ps);
    }
    return m;
  }, [posicoes, planos]);

  const kpis = useMemo(
    () => indicadores(posicoes.map((p) => ({ cobertura: p.cobertura, headcount: p.ocupantes.length }))),
    [posicoes],
  );

  // A foto de hoje é gravada às 23h55; até lá, o ponto de hoje é o ao vivo.
  const serie = useMemo(() => {
    const hoje = new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
    const pontos = serieHistorica(fotos).filter((p) => p.data !== hoje);
    if (posicoes.length) pontos.push({ data: hoje, ...kpis });
    return pontos;
  }, [fotos, kpis, posicoes.length]);

  const porEquipe = useMemo(() => {
    const m = new Map<string, Posicao[]>();
    for (const p of posicoes) {
      if (!m.has(p.equipe)) m.set(p.equipe, []);
      m.get(p.equipe)!.push(p);
    }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));
  }, [posicoes]);

  const aberta = posicoes.find((p) => chave(p) === abertaKey) ?? null;

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
          <p className="text-sm text-muted-foreground">
            Cada posição (função + equipe) do quadro atual e quem poderia cobri-la.
            {!isAdmin && " Somente leitura."}
          </p>
        </div>
        <Select value={filtro} onValueChange={(v) => setFiltro(v as any)}>
          <SelectTrigger className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas as posições</SelectItem>
            <SelectItem value="descoberta">Só descobertas</SelectItem>
            <SelectItem value="parcial">Só parciais</SelectItem>
            <SelectItem value="total">Só com cobertura total</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ---------------- Indicadores ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Kpi label="Índice de cobertura" valor={`${kpis.indice}%`} hint="parcial vale meia cobertura" destaque />
        <Kpi label="Cobertura total" valor={`${kpis.total}/${kpis.posicoes}`} hint="posições" dot="bg-emerald-500" />
        <Kpi label="Cobertura parcial" valor={String(kpis.parcial)} hint="posições" dot="bg-amber-500" />
        <Kpi label="Descobertas" valor={String(kpis.descoberta)} hint="posições" dot="bg-red-500" />
        <Kpi label="Cobertura por pessoas" valor={`${kpis.porPessoas}%`} hint="ponderada pelo tamanho da posição" />
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Evolução</CardTitle>
          <p className="text-xs text-muted-foreground">
            Uma foto por dia, às 23h55.{" "}
            {serie.length <= 1
              ? `A série começou em ${serie[0] ? new Date(serie[0].data + "T12:00").toLocaleDateString("pt-BR") : "—"}; o gráfico ganha forma conforme as fotos acumulam.`
              : `Desde ${new Date(serie[0].data + "T12:00").toLocaleDateString("pt-BR")}.`}
          </p>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={serie} margin={{ left: -16, right: 12, top: 8 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="data" tickFormatter={fmtDia} className="text-xs" />
              <YAxis domain={[0, 100]} unit="%" className="text-xs" />
              <RTooltip
                labelFormatter={(d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR")}
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
        <span>· Externos "Interessante" aparecem, mas não contam.</span>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {porEquipe.map(([equipe, lista]) => {
            const visiveis = lista.filter((p) => filtro === "todas" || p.cobertura === filtro);
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
                  {visiveis.map((p) => {
                    const externosConta = p.externos.filter((e) => e.conta).length;
                    const interessantes = p.externos.length - externosConta;
                    const temPlano = planosPorPosicao.has(chave(p));
                    return (
                      <button
                        key={chave(p)}
                        onClick={() => setAbertaKey(chave(p))}
                        className={`w-full text-left rounded-md border border-l-4 p-2.5 transition-shadow hover:shadow-md ${COBERTURA_POSICAO[p.cobertura].card}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium leading-tight">{p.funcao}</p>
                            <p className="text-xs text-muted-foreground truncate">
                              {p.ocupantes.length} · {p.ocupantes.map((o) => primeiroNome(o.nome)).join(", ")}
                            </p>
                          </div>
                          {temPlano && (
                            <Badge variant="outline" className="shrink-0 text-[10px] gap-1" title="Tem plano de sucessão completo (só admin vê)">
                              <Target className="h-3 w-3" />plano
                            </Badge>
                          )}
                        </div>
                        <div className="mt-1.5 flex flex-wrap gap-1 text-[10px]">
                          {p.n_total > 0 && <Chip cor="bg-emerald-500">{p.n_total} interno{p.n_total > 1 ? "s" : ""} total</Chip>}
                          {p.n_parcial > 0 && <Chip cor="bg-amber-500">{p.n_parcial} interno{p.n_parcial > 1 ? "s" : ""} parcial</Chip>}
                          {externosConta > 0 && <Chip cor="bg-violet-500">{externosConta} externo{externosConta > 1 ? "s" : ""}</Chip>}
                          {interessantes > 0 && <Chip cor="bg-slate-400">{interessantes} interessante{interessantes > 1 ? "s" : ""}</Chip>}
                          {p.cobertura === "descoberta" && interessantes === 0 && (
                            <span className="text-red-700 dark:text-red-300">ninguém mapeado</span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {aberta && (
        <PosicaoDialog
          posicao={aberta}
          planos={planosPorPosicao.get(chave(aberta)) ?? []}
          isAdmin={isAdmin}
          onClose={() => setAbertaKey(null)}
        />
      )}
    </div>
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

function PosicaoDialog({ posicao: p, planos, isAdmin, onClose }: {
  posicao: Posicao; planos: any[]; isAdmin: boolean; onClose: () => void;
}) {
  const qc = useQueryClient();
  const { funcionarios, isActive } = useActiveEmployees();
  const [novo, setNovo] = useState<{ funcionarioId: string; cobertura: "total" | "parcial"; obs: string }>({
    funcionarioId: "", cobertura: "parcial", obs: "",
  });

  const invalidar = () => qc.invalidateQueries({ queryKey: ["rh_mapa_cobertura"] });

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
        funcao_id: p.funcao_id, equipe_id: p.equipe_id, funcionario_id: novo.funcionarioId,
        cobertura: novo.cobertura, observacoes: novo.obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { invalidar(); setNovo({ funcionarioId: "", cobertura: "parcial", obs: "" }); toast.success("Sucessor indicado."); },
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

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{p.funcao} · {p.equipe}</DialogTitle>
          <DialogDescription className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={COBERTURA_POSICAO[p.cobertura].badge}>{COBERTURA_POSICAO[p.cobertura].label}</Badge>
            <span>{p.ocupantes.map((o) => o.nome).join(", ")}</span>
          </DialogDescription>
        </DialogHeader>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" /> Sucessores internos
          </h3>
          {p.sucessores.length === 0 ? (
            <p className="text-sm text-muted-foreground">Ninguém indicado.</p>
          ) : (
            p.sucessores.map((s) => (
              <div key={s.id} className={`rounded-md border p-2 ${s.ativo ? "" : "opacity-60"}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-medium">
                    {s.nome}
                    {!s.ativo && <span className="ml-1 text-xs text-destructive">(desligado — não conta)</span>}
                  </span>
                  {isAdmin ? (
                    <div className="flex items-center gap-1">
                      <Select value={s.cobertura} onValueChange={(v) => mudar.mutate({ id: s.id, cobertura: v })}>
                        <SelectTrigger className="h-7 w-[110px] text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="total">Total</SelectItem>
                          <SelectItem value="parcial">Parcial</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" title="Remover indicação"
                        onClick={() => window.confirm(`Remover ${s.nome} desta posição?`) && remover.mutate(s.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Badge variant="outline" className={COBERTURA_POSICAO[s.cobertura].badge}>{s.cobertura === "total" ? "Total" : "Parcial"}</Badge>
                  )}
                </div>
                {s.observacoes && <p className="text-xs text-muted-foreground mt-1">{s.observacoes}</p>}
              </div>
            ))
          )}

          {isAdmin && (
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
            </div>
          )}
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
            <ExternalLink className="h-3.5 w-3.5" /> Externos (Talents)
          </h3>
          {p.externos.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Ninguém mapeado no Talents para {p.funcao}.
            </p>
          ) : (
            p.externos.map((e) => (
              <div key={e.mapping_id} className={`flex items-start justify-between gap-2 rounded-md border p-2 ${e.conta ? "" : "opacity-60"}`}>
                <div className="min-w-0">
                  <a href={`${TALENTS_URL}/candidate/${e.candidate_id}`} target="_blank" rel="noreferrer"
                    className="text-sm font-medium hover:underline inline-flex items-center gap-1">
                    {e.nome ?? "(sem nome)"}<ExternalLink className="h-3 w-3 opacity-60" />
                  </a>
                  <p className="text-xs text-muted-foreground">
                    {[e.especificacao, e.generico ? "qualquer equipe" : null].filter(Boolean).join(" · ") || "—"}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[10px]">{nivelExterno(e)}</Badge>
              </div>
            ))
          )}
          <p className="text-[11px] text-muted-foreground">
            Externos entram mapeando no Talents com esta função (e equipe, ou "qualquer equipe"). Forte e
            alternativa externa cobrem parcialmente.
          </p>
        </section>

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
