// Mapa de sucessão: indicadores sobre a cobertura de cada POSIÇÃO (função +
// equipe). A cobertura de cada posição é calculada no banco
// (rh.rh_mapa_cobertura_calc) — tela e foto diária usam a mesma regra:
//   total      = há sucessor interno com cobertura total
//   parcial    = há interno parcial ou externo do Talents (Forte/alternativa)
//   descoberta = ninguém
// Aqui só se agregam as posições em indicadores.

export type CoberturaPosicao = "total" | "parcial" | "descoberta";

/** Peso de cada posição no índice: parcial vale meia cobertura. */
export const PESO_COBERTURA: Record<CoberturaPosicao, number> = { total: 1, parcial: 0.5, descoberta: 0 };

export const COBERTURA_POSICAO: Record<CoberturaPosicao, { label: string; card: string; dot: string; badge: string }> = {
  total: {
    label: "Cobertura total",
    card: "border-l-emerald-500 bg-emerald-50/70 dark:bg-emerald-950/25",
    dot: "bg-emerald-500",
    badge: "border-emerald-400 text-emerald-700 dark:text-emerald-300",
  },
  parcial: {
    label: "Cobertura parcial",
    card: "border-l-amber-500 bg-amber-50/70 dark:bg-amber-950/25",
    dot: "bg-amber-500",
    badge: "border-amber-400 text-amber-700 dark:text-amber-300",
  },
  descoberta: {
    label: "Descoberta",
    card: "border-l-red-500 bg-red-50/60 dark:bg-red-950/20",
    dot: "bg-red-500",
    badge: "border-red-400 text-red-700 dark:text-red-300",
  },
};

export interface PosicaoResumo {
  cobertura: CoberturaPosicao;
  headcount: number;
}

export interface Indicadores {
  posicoes: number;
  total: number;
  parcial: number;
  descoberta: number;
  /** Índice de cobertura (0–100): média dos pesos por posição. */
  indice: number;
  /** % de posições com alguém mapeado (total ou parcial). */
  mapeadas: number;
  /** Índice ponderado pelo nº de pessoas em cada posição (0–100). */
  porPessoas: number;
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

export function indicadores(posicoes: PosicaoResumo[]): Indicadores {
  const n = posicoes.length;
  const conta = (c: CoberturaPosicao) => posicoes.filter((p) => p.cobertura === c).length;
  const total = conta("total");
  const parcial = conta("parcial");
  const soma = posicoes.reduce((s, p) => s + PESO_COBERTURA[p.cobertura], 0);
  const pessoas = posicoes.reduce((s, p) => s + p.headcount, 0);
  const somaPessoas = posicoes.reduce((s, p) => s + PESO_COBERTURA[p.cobertura] * p.headcount, 0);
  return {
    posicoes: n,
    total,
    parcial,
    descoberta: n - total - parcial,
    indice: pct(soma, n),
    mapeadas: pct(total + parcial, n),
    porPessoas: pct(somaPessoas, pessoas),
  };
}

export interface FotoPosicao extends PosicaoResumo {
  data: string; // YYYY-MM-DD
}

export interface PontoSerie extends Indicadores {
  data: string;
}

/** Série histórica: um ponto por dia de foto, em ordem cronológica. */
export function serieHistorica(fotos: FotoPosicao[]): PontoSerie[] {
  const porDia = new Map<string, PosicaoResumo[]>();
  for (const f of fotos) {
    if (!porDia.has(f.data)) porDia.set(f.data, []);
    porDia.get(f.data)!.push({ cobertura: f.cobertura, headcount: f.headcount });
  }
  return [...porDia.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([data, ps]) => ({ data, ...indicadores(ps) }));
}
