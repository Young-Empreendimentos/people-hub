// Regras e rótulos dos planos de sucessão.
//
// Escala de proficiência 0..4. "Pronto" é nivel >= NIVEL_PRONTO — a leitura de
// topo continua binária (% pronto), mas os níveis intermediários dão sinal de
// progresso entre checkpoints, o que um Realizada/Não Realizada não dá.

export const NIVEL_PRONTO = 3;

export type Nivel = 0 | 1 | 2 | 3 | 4;

export const NIVEIS: { nivel: Nivel; label: string; curto: string; descricao: string }[] = [
  { nivel: 0, label: "Não avaliado", curto: "—", descricao: "Ainda não avaliamos este item." },
  { nivel: 1, label: "Não atende", curto: "1", descricao: "Não executa a atividade." },
  { nivel: 2, label: "Em desenvolvimento", curto: "2", descricao: "Executa com supervisão." },
  { nivel: 3, label: "Atende", curto: "3", descricao: "Executa sozinho — pronto neste item." },
  { nivel: 4, label: "Referência", curto: "4", descricao: "Executa e ensina outras pessoas." },
];

export const nivelLabel = (n: number | null | undefined) =>
  NIVEIS.find((x) => x.nivel === (n ?? 0))?.label ?? "Não avaliado";

/** Classes de cor por nível (usadas na célula da matriz). */
export const nivelClasses = (n: number | null | undefined): string => {
  switch (n ?? 0) {
    case 4: return "bg-emerald-600 text-white border-emerald-700";
    case 3: return "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-950 dark:text-emerald-200 dark:border-emerald-800";
    case 2: return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800";
    case 1: return "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800";
    default: return "bg-muted text-muted-foreground border-border";
  }
};

export const HORIZONTES = [
  { value: "emergencial", label: "Emergencial", descricao: "Cobre a vaga amanhã, se necessário." },
  { value: "1_2_anos", label: "1–2 anos", descricao: "Sucessor em desenvolvimento." },
  { value: "3_mais_anos", label: "3+ anos", descricao: "Aposta de longo prazo." },
] as const;

export const horizonteLabel = (h: string | null | undefined) =>
  HORIZONTES.find((x) => x.value === h)?.label ?? "—";

export const CATEGORIAS = [
  { value: "atividade", label: "Atividade" },
  { value: "caracteristica", label: "Característica" },
  { value: "experiencia", label: "Experiência" },
  { value: "disponibilidade", label: "Disponibilidade" },
] as const;

export const categoriaLabel = (c: string | null | undefined) =>
  CATEGORIAS.find((x) => x.value === c)?.label ?? "—";

export const SITUACOES_PLANO = [
  { value: "rascunho", label: "Rascunho" },
  { value: "ativo", label: "Ativo" },
  { value: "concluido", label: "Concluído" },
  { value: "arquivado", label: "Arquivado" },
] as const;

export const NIVEIS_RISCO = [
  { value: "alto", label: "Alto" },
  { value: "medio", label: "Médio" },
  { value: "baixo", label: "Baixo" },
] as const;

export const riscoClasses = (v: string | null | undefined): string => {
  switch (v) {
    case "alto": return "bg-red-100 text-red-900 border-red-300 dark:bg-red-950 dark:text-red-200 dark:border-red-800";
    case "medio": return "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950 dark:text-amber-200 dark:border-amber-800";
    default: return "bg-muted text-muted-foreground";
  }
};

// ---------------------------------------------------------------------------
// Cálculos
// ---------------------------------------------------------------------------

export type ItemLite = { id: string; peso: number; ativo: boolean };
export type AvaliacaoLite = { item_id: string; nivel: number };

/**
 * Prontidão de um candidato: soma do peso dos itens em nível >= 3 sobre o peso
 * total dos itens ativos. Ponderado, porque nem todo item vale o mesmo — um
 * plano com 20 itens triviais e 2 críticos não deve marcar 90% pronto.
 */
export function prontidao(itens: ItemLite[], avaliacoes: AvaliacaoLite[]): number {
  const ativos = itens.filter((i) => i.ativo);
  const total = ativos.reduce((s, i) => s + (Number(i.peso) || 0), 0);
  if (total <= 0) return 0;
  const mapa = new Map(avaliacoes.map((a) => [a.item_id, a.nivel]));
  const pronto = ativos.reduce(
    (s, i) => s + ((mapa.get(i.id) ?? 0) >= NIVEL_PRONTO ? Number(i.peso) || 0 : 0),
    0,
  );
  return Math.round((pronto / total) * 100);
}

/** Itens ativos que ainda não chegaram a "Atende" — as lacunas a treinar. */
export function lacunas<T extends ItemLite>(itens: T[], avaliacoes: AvaliacaoLite[]): T[] {
  const mapa = new Map(avaliacoes.map((a) => [a.item_id, a.nivel]));
  return itens.filter((i) => i.ativo && (mapa.get(i.id) ?? 0) < NIVEL_PRONTO);
}

export type Fragilidade = {
  tipo: "sem_candidato" | "sem_emergencial" | "sem_itens" | "revisao_vencida" | "baixa_prontidao" | "sem_criterio" | "candidato_unico";
  severidade: "critica" | "atencao";
  mensagem: string;
};

/**
 * Fragilidades de um plano. É o coração do dashboard: um plano que existe mas
 * não protege contra nada é pior que nenhum plano, porque dá falsa segurança.
 */
export function fragilidades(args: {
  itensAtivos: number;
  itensSemCriterio: number;
  candidatosAtivos: number;
  temEmergencial: boolean;
  melhorProntidao: number;
  dataProximaRevisao: string | null;
}): Fragilidade[] {
  const f: Fragilidade[] = [];
  const {
    itensAtivos, itensSemCriterio, candidatosAtivos,
    temEmergencial, melhorProntidao, dataProximaRevisao,
  } = args;

  if (candidatosAtivos === 0) {
    f.push({ tipo: "sem_candidato", severidade: "critica", mensagem: "Nenhum candidato ativo" });
  } else if (candidatosAtivos === 1) {
    f.push({ tipo: "candidato_unico", severidade: "atencao", mensagem: "Só 1 candidato — sem margem se essa pessoa sair" });
  }

  if (candidatosAtivos > 0 && !temEmergencial) {
    f.push({ tipo: "sem_emergencial", severidade: "critica", mensagem: "Sem cobertura emergencial" });
  }

  if (itensAtivos === 0) {
    f.push({ tipo: "sem_itens", severidade: "critica", mensagem: "Plano sem itens mapeados" });
  }

  if (dataProximaRevisao && new Date(dataProximaRevisao + "T23:59:59") < new Date()) {
    f.push({ tipo: "revisao_vencida", severidade: "atencao", mensagem: "Revisão vencida" });
  }

  if (candidatosAtivos > 0 && itensAtivos > 0 && melhorProntidao < 50) {
    f.push({ tipo: "baixa_prontidao", severidade: "atencao", mensagem: `Melhor candidato em ${melhorProntidao}%` });
  }

  if (itensSemCriterio > 0) {
    f.push({
      tipo: "sem_criterio",
      severidade: "atencao",
      mensagem: `${itensSemCriterio} ${itensSemCriterio === 1 ? "item sem critério" : "itens sem critério"}`,
    });
  }

  return f;
}

/** Ordem de prioridade: impacto da vacância × risco de saída. */
export function prioridade(impacto: string, risco: string): number {
  const p = (v: string) => (v === "alto" ? 3 : v === "medio" ? 2 : 1);
  return p(impacto) * p(risco);
}
