// Regras de cálculo da folha mensal / reembolsos, extraídas como funções puras
// para poderem ser testadas isoladamente (ver src/lib/folha.test.ts).
// Mantêm exatamente o comportamento que estava embutido em FolhaMensal.tsx e MeusKms.tsx.

const round2 = (n: number) => +n.toFixed(2);

/** Converte "HH:MM" (até 3 dígitos de hora) em horas decimais. Retorna NaN se inválido. */
export function hhmmToHours(s: string): number {
  const m = /^(\d{1,3}):(\d{2})$/.exec(s.trim());
  if (!m) return NaN;
  return parseInt(m[1], 10) + parseInt(m[2], 10) / 60;
}

/** Converte horas decimais em "HH:MM" (arredonda ao minuto). "00:00" se não-finito. */
export function hoursToHHMM(h: number): string {
  if (!isFinite(h)) return "00:00";
  const total = Math.round(h * 60);
  const hh = Math.floor(total / 60);
  const mm = total % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

/**
 * Desconto do plano de saúde na folha:
 * mensalidade (saúde + odonto) entra com 20% de coparticipação;
 * o uso do plano entra integral. Arredondado a 2 casas.
 */
export function calcDescontoPlanoSaude(
  valorSaude: number,
  valorOdonto: number,
  usoPlano: number,
): number {
  const mensalidade = (Number(valorSaude) || 0) + (Number(valorOdonto) || 0);
  const uso = Number(usoPlano) || 0;
  return round2(mensalidade * 0.2 + uso);
}

/** Auxílio-moradia = remuneração × (percentual / 100). */
export function calcAuxilioMoradia(remuneracao: number, percentual: number): number {
  const remun = Number(remuneracao) || 0;
  const perc = Number(percentual) || 0;
  return remun * (perc / 100);
}

/** Valor de um lançamento de KM = km × valor por km, arredondado a 2 casas. */
export function calcValorKm(km: number, valorKm: number): number {
  return round2((Number(km) || 0) * (Number(valorKm) || 0));
}

/** Soma o valor_total de uma lista de lançamentos de KM. */
export function somaKmTotal(lancamentos: Array<{ valor_total?: number | string | null }>): number {
  return round2(
    (lancamentos || []).reduce((s, l) => s + (Number(l?.valor_total) || 0), 0),
  );
}

/**
 * Dado o mês de referência "YYYY-MM" (folha), retorna o 1º dia do mês SEGUINTE
 * como "YYYY-MM-01" — usado para buscar o plano de saúde do mês seguinte.
 * Retorna null se a entrada for inválida.
 */
export function proximoMesPrimeiroDia(mesRef: string): string | null {
  const [y, m] = (mesRef || "").split("-").map(Number);
  if (!y || !m) return null;
  const next = new Date(y, m, 1); // m (1-12) com base 0-11 já aponta para o mês seguinte
  return `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}-01`;
}

/**
 * Período de apuração de KM: do dia 20 ao dia 19 do mês seguinte.
 * Se hoje >= dia 20, começa neste mês; senão começou no dia 20 do mês anterior.
 * Formata a partir dos componentes locais da data (estável em qualquer timezone).
 */
export function periodoKm(hoje: Date): { ini: string; fim: string } {
  const dia = hoje.getDate();
  const y = hoje.getFullYear();
  const m = hoje.getMonth(); // 0-11
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  let ini: Date, fim: Date;
  if (dia >= 20) {
    ini = new Date(y, m, 20);
    fim = new Date(y, m + 1, 19);
  } else {
    ini = new Date(y, m - 1, 20);
    fim = new Date(y, m, 19);
  }
  return { ini: iso(ini), fim: iso(fim) };
}

/**
 * Período de KM imediatamente anterior ao atual (o que "acabou de fechar").
 * Ex.: em 20/07 o período atual é 20/07–19/08 e o anterior é 20/06–19/07.
 * Usado quando o RH libera lançamento retroativo.
 */
export function periodoKmAnterior(hoje: Date): { ini: string; fim: string } {
  const atual = periodoKm(hoje);
  const [y, m] = atual.ini.split("-").map(Number); // ini = "YYYY-MM-20"
  const pad = (n: number) => String(n).padStart(2, "0");
  const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  // m é 1-based: mês do ini atual = índice (m-1); mês anterior = (m-2).
  const ini = new Date(y, m - 2, 20);
  const fim = new Date(y, m - 1, 19);
  return { ini: iso(ini), fim: iso(fim) };
}
