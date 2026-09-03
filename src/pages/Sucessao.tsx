import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rhDb } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Combobox } from "@/components/ui/combobox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Plus, ShieldAlert, ShieldCheck, TriangleAlert, CalendarClock, Users,
  Target, Lock, ArrowRight,
} from "lucide-react";
import { toast } from "sonner";
import {
  SITUACOES_PLANO, NIVEIS_RISCO, riscoClasses,
  prontidao, fragilidades, prioridade, type Fragilidade,
} from "@/lib/sucessao";

type Plano = {
  id: string; cargo_id: string; titular_funcionario_id: string | null;
  titulo: string; situacao: string;
  impacto_vacancia: string; risco_saida: string;
  data_proxima_revisao: string | null; observacoes: string | null;
  created_at: string;
};

export default function Sucessao() {
  const { isAdmin } = useAuth();
  const qc = useQueryClient();
  const { funcionarios, isActive } = useActiveEmployees();

  const [novoOpen, setNovoOpen] = useState(false);
  const [nCargo, setNCargo] = useState("");
  const [nTitular, setNTitular] = useState("");
  const [nTitulo, setNTitulo] = useState("");
  const [nImpacto, setNImpacto] = useState("alto");
  const [nRisco, setNRisco] = useState("medio");
  const [nRevisao, setNRevisao] = useState("");
  const [nObs, setNObs] = useState("");
  const [filtroSituacao, setFiltroSituacao] = useState("ativos");

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["rh_sucessao_planos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_planos")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Plano[];
    },
  });

  const { data: cargos = [] } = useQuery({
    queryKey: ["rh_cargos_lite"],
    enabled: isAdmin,
    queryFn: async () =>
      (await rhDb.from("rh_cargos").select("id, nome, nivel").order("nome")).data ?? [],
  });

  const { data: itens = [] } = useQuery({
    queryKey: ["rh_sucessao_itens_todos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_itens")
        .select("id, plano_id, peso, ativo, categoria, atividade_id, titulo, criterio_override");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: candidatos = [] } = useQuery({
    queryKey: ["rh_sucessao_candidatos_todos"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_candidatos")
        .select("id, plano_id, funcionario_id, horizonte, situacao");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const { data: avaliacoes = [] } = useQuery({
    queryKey: ["rh_sucessao_avaliacoes_todas"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_avaliacoes")
        .select("candidato_id, item_id, nivel");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  // Critério do catálogo — para apontar itens de atividade sem régua definida
  const { data: criterios = [] } = useQuery({
    queryKey: ["rh_atividades_criterios"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await rhDb
        .from("rh_atividades_auditoria")
        .select("id, criterio_proficiencia");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const cargoNome = (id: string) => (cargos as any[]).find((c) => c.id === id)?.nome ?? "—";
  const funcNome = (id: string | null) =>
    id ? (funcionarios as any[]).find((f) => f.id === id)?.nome_completo ?? "—" : "—";

  /** Agrega tudo o que o dashboard precisa, um registro por plano. */
  const resumos = useMemo(() => {
    const criterioMap = new Map(
      (criterios as any[]).map((a) => [a.id, a.criterio_proficiencia]),
    );

    return (planos as Plano[]).map((p) => {
      const meusItens = (itens as any[]).filter((i) => i.plano_id === p.id);
      const itensAtivos = meusItens.filter((i) => i.ativo);
      const meusCand = (candidatos as any[]).filter((c) => c.plano_id === p.id);
      const candAtivos = meusCand.filter((c) => c.situacao === "ativo");

      const porCandidato = candAtivos.map((c) => {
        const avals = (avaliacoes as any[]).filter((a) => a.candidato_id === c.id);
        return {
          ...c,
          nome: funcNome(c.funcionario_id),
          prontidao: prontidao(itensAtivos, avals),
        };
      });

      const melhorProntidao = porCandidato.length
        ? Math.max(...porCandidato.map((c) => c.prontidao))
        : 0;

      const emergenciais = porCandidato.filter((c) => c.horizonte === "emergencial");

      const itensSemCriterio = itensAtivos.filter((i) => {
        if (i.criterio_override && i.criterio_override.trim()) return false;
        if (i.categoria === "atividade") {
          const g = criterioMap.get(i.atividade_id);
          return !g || !String(g).trim();
        }
        return true; // item de texto livre sem override = sem régua
      }).length;

      const frags = fragilidades({
        itensAtivos: itensAtivos.length,
        itensSemCriterio,
        candidatosAtivos: candAtivos.length,
        temEmergencial: emergenciais.length > 0,
        melhorProntidao,
        dataProximaRevisao: p.data_proxima_revisao,
      });

      return {
        plano: p,
        cargo: cargoNome(p.cargo_id),
        titular: funcNome(p.titular_funcionario_id),
        itensAtivos: itensAtivos.length,
        candidatos: porCandidato,
        candidatosAtivos: candAtivos.length,
        melhorProntidao,
        frags,
        criticas: frags.filter((f) => f.severidade === "critica").length,
        prio: prioridade(p.impacto_vacancia, p.risco_saida),
      };
    });
  }, [planos, itens, candidatos, avaliacoes, criterios, cargos, funcionarios]);

  const visiveis = useMemo(() => {
    const base = filtroSituacao === "ativos"
      ? resumos.filter((r) => ["rascunho", "ativo"].includes(r.plano.situacao))
      : filtroSituacao === "todos"
        ? resumos
        : resumos.filter((r) => r.plano.situacao === filtroSituacao);
    return [...base].sort(
      (a, b) => b.criticas - a.criticas || b.prio - a.prio || a.cargo.localeCompare(b.cargo, "pt-BR"),
    );
  }, [resumos, filtroSituacao]);

  // ---- KPIs -----------------------------------------------------------------
  const kpis = useMemo(() => {
    const ativos = resumos.filter((r) => ["rascunho", "ativo"].includes(r.plano.situacao));
    const cargosComPlano = new Set(ativos.map((r) => r.plano.cargo_id)).size;
    const comEmergencial = ativos.filter(
      (r) => !r.frags.some((f) => f.tipo === "sem_emergencial") && r.candidatosAtivos > 0,
    ).length;
    const criticos = ativos.filter((r) => r.criticas > 0).length;
    const revisaoVencida = ativos.filter(
      (r) => r.frags.some((f) => f.tipo === "revisao_vencida"),
    ).length;
    const prontosMedia = ativos.length
      ? Math.round(ativos.reduce((s, r) => s + r.melhorProntidao, 0) / ativos.length)
      : 0;
    return { total: ativos.length, cargosComPlano, comEmergencial, criticos, revisaoVencida, prontosMedia };
  }, [resumos]);

  const dadosGrafico = useMemo(
    () =>
      [...resumos]
        .filter((r) => ["rascunho", "ativo"].includes(r.plano.situacao))
        .sort((a, b) => a.melhorProntidao - b.melhorProntidao)
        .map((r) => ({
          nome: r.cargo.length > 24 ? r.cargo.slice(0, 23) + "…" : r.cargo,
          prontidao: r.melhorProntidao,
          id: r.plano.id,
        })),
    [resumos],
  );

  const barColor = (v: number) =>
    v >= 80 ? "hsl(142 71% 45%)" : v >= 50 ? "hsl(38 92% 50%)" : "hsl(0 72% 51%)";

  // Matriz impacto × risco — prioridade de onde investir treinamento
  const matriz = useMemo(() => {
    const níveis = ["alto", "medio", "baixo"];
    return níveis.map((imp) => ({
      impacto: imp,
      celulas: níveis.map((ris) => ({
        risco: ris,
        planos: resumos.filter(
          (r) =>
            ["rascunho", "ativo"].includes(r.plano.situacao) &&
            r.plano.impacto_vacancia === imp &&
            r.plano.risco_saida === ris,
        ),
      })),
    }));
  }, [resumos]);

  const cargosSemPlano = useMemo(() => {
    const comPlano = new Set(
      resumos
        .filter((r) => ["rascunho", "ativo"].includes(r.plano.situacao))
        .map((r) => r.plano.cargo_id),
    );
    // Só cargos que têm alguém ativo ocupando — cargo vazio no catálogo não é risco
    const ocupados = new Set(
      (funcionarios as any[]).filter((f) => f.cargo_id && isActive(f.id)).map((f) => f.cargo_id),
    );
    return (cargos as any[])
      .filter((c) => ocupados.has(c.id) && !comPlano.has(c.id))
      .sort((a, b) => (b.nivel ?? 0) - (a.nivel ?? 0));
  }, [cargos, resumos, funcionarios, isActive]);

  // ---- Criar plano ----------------------------------------------------------
  const criar = useMutation({
    mutationFn: async () => {
      const { data, error } = await rhDb
        .from("rh_sucessao_planos")
        .insert({
          cargo_id: nCargo,
          titular_funcionario_id: nTitular || null,
          titulo: nTitulo || `Sucessão — ${cargoNome(nCargo)}`,
          impacto_vacancia: nImpacto,
          risco_saida: nRisco,
          data_proxima_revisao: nRevisao || null,
          observacoes: nObs || null,
        })
        .select("id")
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["rh_sucessao_planos"] });
      toast.success("Plano criado.");
      setNovoOpen(false);
      setNCargo(""); setNTitular(""); setNTitulo(""); setNImpacto("alto");
      setNRisco("medio"); setNRevisao(""); setNObs("");
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="p-8 text-center space-y-2">
          <Lock className="h-6 w-6 mx-auto text-muted-foreground" />
          <p className="font-medium">Acesso restrito</p>
          <p className="text-sm text-muted-foreground">
            Planos de sucessão são visíveis apenas à diretoria e usuários autorizados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const cargoOptions = (cargos as any[]).map((c) => ({ value: c.id, label: c.nome }));
  const funcOptions = (funcionarios as any[])
    .filter((f) => isActive(f.id))
    .map((f) => ({ value: f.id, label: f.nome_completo }));

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Planos de Sucessão</h1>
          <p className="text-sm text-muted-foreground">
            Quem está pronto para assumir os cargos-chave — e o que falta treinar.
          </p>
        </div>
        <Button onClick={() => setNovoOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Novo plano
        </Button>
      </div>

      {/* ---------------- KPIs ---------------- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <KpiCard icon={Target} label="Planos ativos" valor={String(kpis.total)}
          hint={`${kpis.cargosComPlano} cargo(s) coberto(s)`} />
        <KpiCard icon={ShieldCheck} label="Com cobertura emergencial"
          valor={`${kpis.comEmergencial}/${kpis.total}`}
          hint="alguém assume amanhã"
          tone={kpis.total > 0 && kpis.comEmergencial < kpis.total ? "warn" : "ok"} />
        <KpiCard icon={ShieldAlert} label="Com fragilidade crítica" valor={String(kpis.criticos)}
          hint="exigem ação" tone={kpis.criticos > 0 ? "bad" : "ok"} />
        <KpiCard icon={CalendarClock} label="Revisão vencida" valor={String(kpis.revisaoVencida)}
          hint="plano desatualizado" tone={kpis.revisaoVencida > 0 ? "warn" : "ok"} />
        <KpiCard icon={Users} label="Prontidão média" valor={`${kpis.prontosMedia}%`}
          hint="melhor candidato por plano" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* ---------------- Prontidão por cargo ---------------- */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Prontidão do melhor candidato, por cargo</CardTitle>
            <p className="text-xs text-muted-foreground">
              % do peso dos itens já em nível “Atende” ou acima
            </p>
          </CardHeader>
          <CardContent>
            {dadosGrafico.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                Nenhum plano ativo ainda.
              </p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(180, dadosGrafico.length * 34)}>
                <BarChart data={dadosGrafico} layout="vertical" margin={{ left: 8, right: 24 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} className="stroke-border" />
                  <XAxis type="number" domain={[0, 100]} unit="%" className="text-xs" />
                  <YAxis type="category" dataKey="nome" width={150} className="text-xs" />
                  <RTooltip formatter={(v: number) => [`${v}%`, "Pronto"]} />
                  <Bar dataKey="prontidao" radius={[0, 4, 4, 0]} barSize={18}>
                    {dadosGrafico.map((d) => (
                      <Cell key={d.id} fill={barColor(d.prontidao)} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* ---------------- Matriz impacto × risco ---------------- */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Onde investir primeiro</CardTitle>
            <p className="text-xs text-muted-foreground">
              Impacto da vacância × risco de saída
            </p>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-1 text-[11px]">
              <div />
              {NIVEIS_RISCO.map((r) => (
                <div key={r.value} className="text-center text-muted-foreground pb-1">
                  {r.label}
                </div>
              ))}
              {matriz.map((linha) => (
                <div key={linha.impacto} className="contents">
                  <div className="flex items-center pr-1 text-muted-foreground">
                    {NIVEIS_RISCO.find((n) => n.value === linha.impacto)?.label}
                  </div>
                  {linha.celulas.map((cel) => {
                    const urgente = linha.impacto === "alto" && cel.risco === "alto";
                    const quente = prioridade(linha.impacto, cel.risco) >= 6;
                    return (
                      <div
                        key={cel.risco}
                        className={`min-h-[52px] rounded border p-1 space-y-0.5 ${
                          urgente
                            ? "border-red-400 bg-red-50 dark:bg-red-950/40"
                            : quente
                              ? "border-amber-300 bg-amber-50 dark:bg-amber-950/30"
                              : "border-border bg-muted/30"
                        }`}
                      >
                        {cel.planos.map((r) => (
                          <Link
                            key={r.plano.id}
                            to={`/sucessao/${r.plano.id}`}
                            className="block truncate hover:underline"
                            title={`${r.cargo} — ${r.melhorProntidao}% pronto`}
                          >
                            {r.cargo}
                          </Link>
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="text-[11px] text-muted-foreground mt-2">
              Linha = impacto · coluna = risco. O canto superior esquerdo é a prioridade.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ---------------- Cargos-chave sem plano ---------------- */}
      {cargosSemPlano.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TriangleAlert className="h-4 w-4 text-amber-500" />
              Cargos ocupados sem plano ({cargosSemPlano.length})
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              Nem todo cargo precisa de plano — mas decida quais precisam de propósito, não por esquecimento.
            </p>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-1.5">
            {cargosSemPlano.map((c: any) => (
              <Badge
                key={c.id}
                variant="outline"
                className="cursor-pointer hover:border-primary"
                onClick={() => { setNCargo(c.id); setNTitulo(`Sucessão — ${c.nome}`); setNovoOpen(true); }}
              >
                {c.nome}
                <Plus className="ml-1 h-3 w-3" />
              </Badge>
            ))}
          </CardContent>
        </Card>
      )}

      {/* ---------------- Lista de planos ---------------- */}
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Planos</h2>
        <Select value={filtroSituacao} onValueChange={setFiltroSituacao}>
          <SelectTrigger className="w-[190px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativos">Rascunho + Ativo</SelectItem>
            <SelectItem value="todos">Todos</SelectItem>
            {SITUACOES_PLANO.map((s) => (
              <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Carregando…</p>
      ) : visiveis.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-3">
            <Target className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhum plano neste filtro</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Comece pelos cargos cuja ausência pararia a operação em 30 dias — não
              necessariamente os mais seniores.
            </p>
            <Button variant="outline" onClick={() => setNovoOpen(true)}>
              <Plus className="mr-2 h-4 w-4" /> Criar o primeiro
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {visiveis.map((r) => (
            <Link key={r.plano.id} to={`/sucessao/${r.plano.id}`}>
              <Card className="h-full hover:border-primary transition-colors">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{r.cargo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        Titular: {r.titular}
                      </p>
                    </div>
                    <Badge variant={r.plano.situacao === "ativo" ? "default" : "secondary"}>
                      {SITUACOES_PLANO.find((s) => s.value === r.plano.situacao)?.label}
                    </Badge>
                  </div>

                  <div>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-muted-foreground">
                        Melhor candidato
                        {r.candidatos.length > 0 && (
                          <> · {r.candidatos.reduce((m, c) => (c.prontidao >= m.prontidao ? c : m), r.candidatos[0]).nome}</>
                        )}
                      </span>
                      <span className="font-medium">{r.melhorProntidao}%</span>
                    </div>
                    <Progress value={r.melhorProntidao} className="h-1.5" />
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                    <Badge variant="outline" className={riscoClasses(r.plano.impacto_vacancia)}>
                      impacto {r.plano.impacto_vacancia}
                    </Badge>
                    <Badge variant="outline" className={riscoClasses(r.plano.risco_saida)}>
                      risco {r.plano.risco_saida}
                    </Badge>
                    <Badge variant="secondary">{r.candidatosAtivos} cand.</Badge>
                    <Badge variant="secondary">{r.itensAtivos} itens</Badge>
                  </div>

                  {r.frags.length > 0 && (
                    <div className="space-y-1 pt-1 border-t">
                      {r.frags.slice(0, 3).map((f: Fragilidade) => (
                        <div
                          key={f.tipo}
                          className={`flex items-center gap-1.5 text-[11px] ${
                            f.severidade === "critica" ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"
                          }`}
                        >
                          <TriangleAlert className="h-3 w-3 shrink-0" />
                          <span className="truncate">{f.mensagem}</span>
                        </div>
                      ))}
                      {r.frags.length > 3 && (
                        <p className="text-[11px] text-muted-foreground">
                          +{r.frags.length - 3} outra(s)
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex items-center justify-end text-xs text-primary">
                    Abrir <ArrowRight className="ml-1 h-3 w-3" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* ---------------- Dialog novo plano ---------------- */}
      <Dialog open={novoOpen} onOpenChange={setNovoOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Novo plano de sucessão</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm">Cargo *</label>
              <Combobox
                options={cargoOptions}
                value={nCargo}
                onValueChange={(v) => {
                  setNCargo(v);
                  if (!nTitulo) setNTitulo(`Sucessão — ${cargoNome(v)}`);
                }}
                placeholder="Selecionar cargo"
                emptyMessage="—"
              />
            </div>
            <div>
              <label className="text-sm">Titular atual</label>
              <Combobox options={funcOptions} value={nTitular} onValueChange={setNTitular}
                placeholder="—" emptyMessage="—" />
            </div>
            <div>
              <label className="text-sm">Título</label>
              <Input value={nTitulo} onChange={(e) => setNTitulo(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm">Impacto da vacância</label>
                <Select value={nImpacto} onValueChange={setNImpacto}>
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
                <Select value={nRisco} onValueChange={setNRisco}>
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
              <Input type="date" value={nRevisao} onChange={(e) => setNRevisao(e.target.value)} />
              <p className="text-[11px] text-muted-foreground mt-1">
                Trimestral costuma bastar. Sem data, o plano não avisa quando envelhecer.
              </p>
            </div>
            <div>
              <label className="text-sm">Observações</label>
              <Textarea rows={2} value={nObs} onChange={(e) => setNObs(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNovoOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={!nCargo || criar.isPending}>
              Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, valor, hint, tone = "neutral",
}: {
  icon: any; label: string; valor: string; hint?: string;
  tone?: "neutral" | "ok" | "warn" | "bad";
}) {
  const toneClass =
    tone === "bad" ? "text-red-600 dark:text-red-400"
    : tone === "warn" ? "text-amber-600 dark:text-amber-400"
    : tone === "ok" ? "text-emerald-600 dark:text-emerald-400"
    : "text-foreground";
  return (
    <Card>
      <CardContent className="p-3">
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Icon className="h-3.5 w-3.5" />
          <span className="truncate">{label}</span>
        </div>
        <p className={`text-2xl font-bold mt-1 ${toneClass}`}>{valor}</p>
        {hint && <p className="text-[11px] text-muted-foreground truncate">{hint}</p>}
      </CardContent>
    </Card>
  );
}
