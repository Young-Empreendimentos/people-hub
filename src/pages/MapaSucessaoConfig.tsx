import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { rhDb, supabase } from "@/integrations/supabase/client";
import { useActiveEmployees } from "@/hooks/useActiveEmployees";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Combobox } from "@/components/ui/combobox";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { CidadeSelect } from "@/components/CidadeSelect";
import { AjudaPosicao, type Posicao } from "@/pages/MapaSucessao";

const cidadeCurta = (c: string | null) => (c ? c.replace(/\/RS$/, "") : "cidade não definida");
const baseKey = (p: { funcao_id: string; equipe_id: string; cidade_ibge: number | null }) =>
  `${p.funcao_id}|${p.equipe_id}|${p.cidade_ibge ?? ""}`;

/**
 * Configuração do mapa de cobertura (só admin). Por padrão a posição é função +
 * equipe + cidade de atuação e todas exigem mapeamento. Aqui o admin:
 *   - revisa a cidade de atuação (pré-preenchida com a da empresa);
 *   - separa quem exige mapeamento próprio numa posição compartilhada;
 *   - tira do mapa posições que não precisam de mapeamento;
 *   - inclui posições sem ocupante (vagas).
 */
export default function MapaSucessaoConfig() {
  const qc = useQueryClient();
  const { funcionarios, isActive } = useActiveEmployees();
  const recarregar = () => {
    qc.invalidateQueries({ queryKey: ["rh_mapa_cobertura"] });
    qc.invalidateQueries({ queryKey: ["rh_mapa_config"] });
  };

  const { data: posicoes = [] } = useQuery({
    queryKey: ["rh_mapa_cobertura"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_mapa_cobertura" as any);
      if (error) throw error;
      return (data ?? []) as unknown as Posicao[];
    },
  });

  const { data: config } = useQuery({
    queryKey: ["rh_mapa_config"],
    queryFn: async () => {
      const [ind, exc, man, fun, eqp, emp] = await Promise.all([
        rhDb.from("rh_mapa_individuais" as any).select("funcionario_id"),
        rhDb.from("rh_mapa_exclusoes" as any).select("id, funcao_id, equipe_id, cidade_ibge"),
        rhDb.from("rh_mapa_posicoes_manuais" as any).select("id, funcao_id, equipe_id, cidade_ibge, observacoes"),
        rhDb.from("rh_funcoes").select("id, nome").order("nome"),
        rhDb.from("rh_equipes").select("id, nome").order("nome"),
        rhDb.from("rh_empresas").select("id, nome, cidade_ibge"),
      ]);
      for (const r of [ind, exc, man]) if (r.error) throw r.error;
      return {
        individuais: new Set(((ind.data ?? []) as any[]).map((r) => r.funcionario_id as string)),
        exclusoes: (exc.data ?? []) as any[],
        manuais: (man.data ?? []) as any[],
        funcoes: (fun.data ?? []) as any[],
        equipes: (eqp.data ?? []) as any[],
        empresas: new Map(((emp.data ?? []) as any[]).map((e) => [e.id, e])),
      };
    },
  });

  // Posição "base" (função + equipe + cidade) de cada funcionário ativo, a partir do cálculo do banco.
  const posicaoDe = useMemo(() => {
    const m = new Map<string, Posicao>();
    for (const p of posicoes) for (const o of p.ocupantes) m.set(o.id, p);
    return m;
  }, [posicoes]);

  // Agrupa as posições individuais de volta na base para mostrar a sobreposição.
  const grupos = useMemo(() => {
    const m = new Map<string, { p: Posicao; pessoas: { id: string; nome: string; individual: boolean }[] }>();
    for (const p of posicoes) {
      if (p.vaga) continue;
      const k = baseKey(p);
      if (!m.has(k)) m.set(k, { p, pessoas: [] });
      m.get(k)!.pessoas.push(...p.ocupantes);
    }
    return [...m.values()].sort((a, b) =>
      a.p.equipe.localeCompare(b.p.equipe, "pt-BR") || a.p.funcao.localeCompare(b.p.funcao, "pt-BR")
      || (a.p.cidade ?? "").localeCompare(b.p.cidade ?? "", "pt-BR"));
  }, [posicoes]);
  const sobrepostas = grupos.filter((g) => g.pessoas.length > 1);

  const excluida = (p: { funcao_id: string; equipe_id: string; cidade_ibge: number | null }) =>
    config?.exclusoes.find((x) => x.funcao_id === p.funcao_id && x.equipe_id === p.equipe_id && (x.cidade_ibge ?? null) === (p.cidade_ibge ?? null));

  // ---- mutations -------------------------------------------------------------
  const salvarCidade = useMutation({
    mutationFn: async ({ id, cidade }: { id: string; cidade: number }) => {
      const { error } = await rhDb.from("rh_funcionarios").update({ cidade_ibge: cidade } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); qc.invalidateQueries({ queryKey: ["rh_funcionarios"] }); toast.success("Cidade atualizada."); },
    onError: () => toast.error("Erro ao salvar a cidade."),
  });

  const alternarIndividual = useMutation({
    mutationFn: async ({ id, ligar }: { id: string; ligar: boolean }) => {
      const r = ligar
        ? await rhDb.from("rh_mapa_individuais" as any).insert({ funcionario_id: id })
        : await rhDb.from("rh_mapa_individuais" as any).delete().eq("funcionario_id", id);
      if (r.error) throw r.error;
    },
    onSuccess: recarregar,
    onError: () => toast.error("Erro ao salvar."),
  });

  const alternarExige = useMutation({
    mutationFn: async ({ p, exige }: { p: Posicao; exige: boolean }) => {
      if (exige) {
        const x = excluida(p);
        if (x) {
          const { error } = await rhDb.from("rh_mapa_exclusoes" as any).delete().eq("id", x.id);
          if (error) throw error;
        }
      } else {
        const { error } = await rhDb.from("rh_mapa_exclusoes" as any)
          .insert({ funcao_id: p.funcao_id, equipe_id: p.equipe_id, cidade_ibge: p.cidade_ibge });
        if (error) throw error;
      }
    },
    onSuccess: recarregar,
    onError: () => toast.error("Erro ao salvar."),
  });

  const [nova, setNova] = useState<{ funcaoId: string; equipeId: string; cidade: number | null; obs: string }>({
    funcaoId: "", equipeId: "", cidade: null, obs: "",
  });
  const adicionarVaga = useMutation({
    mutationFn: async () => {
      const { error } = await rhDb.from("rh_mapa_posicoes_manuais" as any).insert({
        funcao_id: nova.funcaoId, equipe_id: nova.equipeId, cidade_ibge: nova.cidade, observacoes: nova.obs.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); setNova({ funcaoId: "", equipeId: "", cidade: null, obs: "" }); toast.success("Posição incluída."); },
    onError: (e: any) => toast.error(e?.code === "23505" ? "Essa posição já foi incluída." : "Erro ao incluir posição."),
  });
  const removerVaga = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await rhDb.from("rh_mapa_posicoes_manuais" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { recarregar(); toast.success("Posição removida."); },
    onError: () => toast.error("Erro ao remover."),
  });

  const [buscaPessoa, setBuscaPessoa] = useState("");
  const ativos = useMemo(() => {
    const q = buscaPessoa.trim().toLowerCase();
    return (funcionarios as any[])
      .filter((f) => isActive(f.id) && (!q || f.nome_completo.toLowerCase().includes(q)))
      .sort((a, b) => Number(!!a.cidade_ibge) - Number(!!b.cidade_ibge) || a.nome_completo.localeCompare(b.nome_completo, "pt-BR"));
  }, [funcionarios, isActive, buscaPessoa]);
  const semCidade = (funcionarios as any[]).filter((f) => isActive(f.id) && !f.cidade_ibge).length;

  const nomeFuncao = (id: string) => config?.funcoes.find((f) => f.id === id)?.nome ?? "—";
  const nomeEquipe = (id: string) => config?.equipes.find((e) => e.id === id)?.nome ?? "—";
  const vagaNoMapa = (m: any) => posicoes.find((p) => p.vaga && p.funcao_id === m.funcao_id && p.equipe_id === m.equipe_id && (p.cidade_ibge ?? null) === (m.cidade_ibge ?? null));

  return (
    <div className="space-y-5">
      <div>
        <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
          <Link to="/mapa-cobertura"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Mapa de cobertura</Link>
        </Button>
        <h1 className="text-2xl font-bold tracking-tight">Configurar o mapa</h1>
        <p className="text-sm text-muted-foreground flex items-center gap-1.5">
          Por padrão, a posição é função + equipe + cidade de atuação, e todas exigem mapeamento. <AjudaPosicao />
        </p>
      </div>

      <Accordion type="multiple" defaultValue={["sobrepostas", ...(semCidade ? ["cidades"] : [])]} className="space-y-3">
        {/* ---------------- Pessoas na mesma posição ---------------- */}
        <AccordionItem value="sobrepostas" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <p className="font-semibold">Pessoas na mesma posição <span className="text-muted-foreground font-normal">({sobrepostas.length})</span></p>
              <p className="text-xs text-muted-foreground font-normal">
                Um sucessor cobre o grupo. Ligue "mapeamento próprio" para quem precisa de sucessor só seu — vira uma posição à parte no índice.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {sobrepostas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma posição com mais de uma pessoa.</p>
            ) : sobrepostas.map((g) => (
              <div key={baseKey(g.p)} className="rounded-md border p-3">
                <p className="text-sm font-medium">{g.p.funcao} · {g.p.equipe} · {cidadeCurta(g.p.cidade)}</p>
                <div className="mt-2 divide-y">
                  {g.pessoas.map((o) => (
                    <label key={o.id} className="flex items-center justify-between gap-3 py-1.5 cursor-pointer">
                      <span className="text-sm">{o.nome}</span>
                      <span className="flex items-center gap-2 text-xs text-muted-foreground">
                        mapeamento próprio
                        <Switch
                          checked={!!config?.individuais.has(o.id)}
                          disabled={alternarIndividual.isPending}
                          onCheckedChange={(v) => {
                            if (!v && !window.confirm("Ela volta para a posição do grupo. Sucessores indicados só para ela deixam de aparecer. Continuar?")) return;
                            alternarIndividual.mutate({ id: o.id, ligar: v });
                          }}
                        />
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </AccordionContent>
        </AccordionItem>

        {/* ---------------- Posições do mapa ---------------- */}
        <AccordionItem value="posicoes" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <p className="font-semibold">Posições do mapa <span className="text-muted-foreground font-normal">({grupos.length})</span></p>
              <p className="text-xs text-muted-foreground font-normal">
                Desligue as que não precisam de mapeamento (ex.: estágio). Saem do mapa e do índice.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="divide-y">
              {grupos.map((g) => (
                <label key={baseKey(g.p)} className="flex items-center justify-between gap-3 py-2 cursor-pointer">
                  <span className="min-w-0">
                    <span className="text-sm">{g.p.funcao} · {g.p.equipe}</span>
                    <span className="block text-xs text-muted-foreground">
                      {cidadeCurta(g.p.cidade)} · {g.pessoas.length} {g.pessoas.length === 1 ? "pessoa" : "pessoas"}
                    </span>
                  </span>
                  <span className="flex items-center gap-2 text-xs text-muted-foreground shrink-0">
                    exige mapeamento
                    <Switch
                      checked={!excluida(g.p)}
                      disabled={alternarExige.isPending}
                      onCheckedChange={(v) => alternarExige.mutate({ p: g.p, exige: v })}
                    />
                  </span>
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ---------------- Vagas ---------------- */}
        <AccordionItem value="vagas" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <p className="font-semibold">Posições sem ocupante (vagas) <span className="text-muted-foreground font-normal">({config?.manuais.length ?? 0})</span></p>
              <p className="text-xs text-muted-foreground font-normal">Inclua posições que ninguém ocupa hoje. Entram no índice, marcadas como vaga.</p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-3 pb-4">
            {(config?.manuais ?? []).map((m) => {
              const noMapa = vagaNoMapa(m);
              return (
                <div key={m.id} className="flex items-center justify-between gap-2 rounded-md border p-2">
                  <div className="min-w-0">
                    <p className="text-sm">{nomeFuncao(m.funcao_id)} · {nomeEquipe(m.equipe_id)}</p>
                    <p className="text-xs text-muted-foreground">
                      {noMapa ? cidadeCurta(noMapa.cidade) : "já ocupada — aparece como posição normal"}
                      {m.observacoes ? ` · ${m.observacoes}` : ""}
                    </p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" title="Remover"
                    onClick={() => window.confirm("Remover esta posição do mapa?") && removerVaga.mutate(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
            <div className="rounded-md border border-dashed p-3 space-y-2">
              <div className="grid gap-2 sm:grid-cols-3">
                <Combobox
                  options={(config?.funcoes ?? []).map((f) => ({ value: f.id, label: f.nome }))}
                  value={nova.funcaoId} onValueChange={(v) => setNova((n) => ({ ...n, funcaoId: v }))}
                  placeholder="Função" searchPlaceholder="Buscar função..."
                />
                <Combobox
                  options={(config?.equipes ?? []).map((e) => ({ value: e.id, label: e.nome }))}
                  value={nova.equipeId} onValueChange={(v) => setNova((n) => ({ ...n, equipeId: v }))}
                  placeholder="Equipe" searchPlaceholder="Buscar equipe..."
                />
                <CidadeSelect value={nova.cidade} onChange={(c) => setNova((n) => ({ ...n, cidade: c }))} placeholder="Cidade" />
              </div>
              <div className="flex gap-2">
                <Input placeholder="Observação (opcional)" value={nova.obs} onChange={(e) => setNova((n) => ({ ...n, obs: e.target.value }))} />
                <Button onClick={() => adicionarVaga.mutate()} disabled={!nova.funcaoId || !nova.equipeId || !nova.cidade || adicionarVaga.isPending}>
                  <Plus className="mr-2 h-4 w-4" />Incluir
                </Button>
              </div>
            </div>
          </AccordionContent>
        </AccordionItem>

        {/* ---------------- Cidade de atuação ---------------- */}
        <AccordionItem value="cidades" className="border rounded-lg px-4">
          <AccordionTrigger className="hover:no-underline">
            <div className="text-left">
              <p className="font-semibold">
                Cidade de atuação
                {semCidade > 0 && <Badge variant="outline" className="ml-2 border-amber-400 text-amber-700">{semCidade} sem cidade</Badge>}
              </p>
              <p className="text-xs text-muted-foreground font-normal">
                Onde cada pessoa trabalha. Veio pré-preenchida com a cidade da empresa — confira quem atua em outra cidade.
              </p>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-2 pb-4">
            <Input placeholder="Buscar pessoa..." value={buscaPessoa} onChange={(e) => setBuscaPessoa(e.target.value)} className="max-w-xs" />
            <div className="divide-y">
              {ativos.map((f) => {
                const emp = config?.empresas.get(f.empresa_id);
                const p = posicaoDe.get(f.id);
                const igualEmpresa = !!f.cidade_ibge && emp?.cidade_ibge === f.cidade_ibge;
                return (
                  <div key={f.id} className="grid gap-2 py-2 sm:grid-cols-[1fr_260px] sm:items-center">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{f.nome_completo}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {p ? `${p.funcao} · ${p.equipe}` : "sem cargo/equipe — fora do mapa"}
                        {emp ? ` · ${emp.nome}` : ""}
                      </p>
                    </div>
                    <div className="space-y-0.5">
                      <CidadeSelect value={f.cidade_ibge ?? null} onChange={(c) => c && salvarCidade.mutate({ id: f.id, cidade: c })} />
                      {igualEmpresa && <p className="text-[11px] text-muted-foreground">= cidade da empresa (pré-preenchida)</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  );
}
