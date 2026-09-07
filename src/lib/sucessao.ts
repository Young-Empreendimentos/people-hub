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

// ---------------------------------------------------------------------------
// Validade da aprovação
// ---------------------------------------------------------------------------

/** Uma aprovação vale 6 meses; depois disso o plano precisa ser reavaliado. */
export const MESES_VALIDADE_APROVACAO = 6;

/**
 * Concluir um plano significa "há candidato apto". Isso não é definitivo: vale 6
 * meses, depois dos quais a aptidão precisa ser reconfirmada.
 */
export const MESES_VALIDADE_APTIDAO = 6;

/**
 * Soma meses a uma data ISO (yyyy-mm-dd). Null para data ausente ou inválida.
 *
 * Soma a partir do dia 1º e só depois reposiciona o dia, limitado ao último dia
 * do mês de destino — senão 31/08 + 6 meses cairia em 03/03 (o transbordo de
 * fevereiro) em vez de 28/02.
 */
export function somaMeses(dataIso: string | null | undefined, meses: number): Date | null {
  if (!dataIso) return null;
  const base = new Date(dataIso + "T12:00:00");
  if (Number.isNaN(base.getTime())) return null;

  const dia = base.getDate();
  const alvo = new Date(base);
  alvo.setDate(1);
  alvo.setMonth(alvo.getMonth() + meses);
  const ultimoDiaDoMes = new Date(alvo.getFullYear(), alvo.getMonth() + 1, 0).getDate();
  alvo.setDate(Math.min(dia, ultimoDiaDoMes));
  return alvo;
}

/** Data em que a aprovação vence. Null quando o plano nunca foi aprovado. */
export const vencimentoAprovacao = (dataAprovacao: string | null | undefined) =>
  somaMeses(dataAprovacao, MESES_VALIDADE_APROVACAO);

/** A aprovação já passou da validade? Plano nunca aprovado não conta como vencido. */
export function aprovacaoVencida(
  dataAprovacao: string | null | undefined,
  hoje: Date = new Date(),
): boolean {
  const venc = vencimentoAprovacao(dataAprovacao);
  return venc ? venc < hoje : false;
}

/** Data em que a aptidão do candidato vence. */
export const vencimentoAptidao = (dataConclusao: string | null | undefined) =>
  somaMeses(dataConclusao, MESES_VALIDADE_APTIDAO);

/** A aptidão passou dos 6 meses? Sem data de conclusão, não há aptidão a vencer. */
export function aptidaoVencida(
  dataConclusao: string | null | undefined,
  hoje: Date = new Date(),
): boolean {
  const venc = vencimentoAptidao(dataConclusao);
  return venc ? venc < hoje : false;
}

// ---------------------------------------------------------------------------
// Cobertura do cargo
// ---------------------------------------------------------------------------

/**
 * Situações em que o plano ainda cobre o cargo e portanto entra nas contas do
 * dashboard. "concluido" está aqui porque concluir não encerra o plano: significa
 * que existe candidato apto, e o cargo segue coberto. Só arquivar (ou excluir)
 * tira a cobertura — e aí o cargo volta a aparecer como em aberto.
 */
export const SITUACOES_COBERTURA = ["rascunho", "ativo", "concluido"] as const;

export const cobreCargo = (situacao: string | null | undefined) =>
  (SITUACOES_COBERTURA as readonly string[]).includes(situacao ?? "");

/** Há candidato apto e dentro da validade? */
export function temAptoValido(
  situacao: string | null | undefined,
  dataConclusao: string | null | undefined,
  hoje: Date = new Date(),
): boolean {
  return situacao === "concluido" && !aptidaoVencida(dataConclusao, hoje);
}

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
  tipo: "sem_candidato" | "sem_emergencial" | "sem_itens" | "aprovacao_vencida" | "baixa_prontidao" | "sem_criterio" | "candidato_unico" | "aptidao_vencida";
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
  dataAprovacao: string | null;
  situacao?: string | null;
  dataConclusao?: string | null;
}): Fragilidade[] {
  const f: Fragilidade[] = [];
  const {
    itensAtivos, itensSemCriterio, candidatosAtivos,
    temEmergencial, melhorProntidao, dataAprovacao,
    situacao, dataConclusao,
  } = args;

  // Plano concluído = há candidato apto. Enquanto a aptidão está válida, cobrar
  // "cobertura emergencial" ou "baixa prontidão" seria contraditório: alguém já
  // foi declarado pronto. Vencida a aptidão, as cobranças voltam a valer.
  const aptoValido = temAptoValido(situacao, dataConclusao);

  if (candidatosAtivos === 0) {
    f.push({ tipo: "sem_candidato", severidade: "critica", mensagem: "Nenhum candidato ativo" });
  } else if (candidatosAtivos === 1) {
    f.push({ tipo: "candidato_unico", severidade: "atencao", mensagem: "Só 1 candidato — sem margem se essa pessoa sair" });
  }

  if (candidatosAtivos > 0 && !temEmergencial && !aptoValido) {
    f.push({ tipo: "sem_emergencial", severidade: "critica", mensagem: "Sem cobertura emergencial" });
  }

  if (itensAtivos === 0) {
    f.push({ tipo: "sem_itens", severidade: "critica", mensagem: "Plano sem itens mapeados" });
  }

  if (aprovacaoVencida(dataAprovacao)) {
    f.push({
      tipo: "aprovacao_vencida",
      severidade: "atencao",
      mensagem: `Aprovação vencida — reavaliar (vale ${MESES_VALIDADE_APROVACAO} meses)`,
    });
  }

  if (candidatosAtivos > 0 && itensAtivos > 0 && melhorProntidao < 50 && !aptoValido) {
    f.push({ tipo: "baixa_prontidao", severidade: "atencao", mensagem: `Melhor candidato em ${melhorProntidao}%` });
  }

  if (situacao === "concluido" && aptidaoVencida(dataConclusao)) {
    f.push({
      tipo: "aptidao_vencida",
      severidade: "atencao",
      mensagem: `Aptidão vencida — reconfirmar (vale ${MESES_VALIDADE_APTIDAO} meses)`,
    });
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
