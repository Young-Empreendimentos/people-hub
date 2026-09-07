import { describe, it, expect } from "vitest";
import {
  MESES_VALIDADE_APROVACAO,
  MESES_VALIDADE_APTIDAO,
  vencimentoAprovacao,
  aprovacaoVencida,
  vencimentoAptidao,
  aptidaoVencida,
  cobreCargo,
  temAptoValido,
  fragilidades,
  prontidao,
} from "./sucessao";

const iso = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : null);

describe("vencimentoAprovacao", () => {
  it("soma 6 meses", () => {
    expect(MESES_VALIDADE_APROVACAO).toBe(6);
    expect(iso(vencimentoAprovacao("2026-03-10"))).toBe("2026-09-10");
  });

  it("vira o ano", () => {
    expect(iso(vencimentoAprovacao("2026-10-15"))).toBe("2027-04-15");
  });

  it("não transborda quando o mês de destino é mais curto", () => {
    // 31/08 + 6 meses = fevereiro, que não tem dia 31: prende no último dia.
    expect(iso(vencimentoAprovacao("2026-08-31"))).toBe("2027-02-28");
    // 2028 é bissexto
    expect(iso(vencimentoAprovacao("2027-08-31"))).toBe("2028-02-29");
  });

  it("é nulo sem data ou com data inválida", () => {
    expect(vencimentoAprovacao(null)).toBeNull();
    expect(vencimentoAprovacao(undefined)).toBeNull();
    expect(vencimentoAprovacao("")).toBeNull();
    expect(vencimentoAprovacao("nao-e-data")).toBeNull();
  });
});

describe("aprovacaoVencida", () => {
  it("vence só depois dos 6 meses", () => {
    const hoje = new Date("2026-09-03T12:00:00");
    expect(aprovacaoVencida("2026-06-01", hoje)).toBe(false); // vence 01/12
    expect(aprovacaoVencida("2026-01-01", hoje)).toBe(true); // venceu 01/07
  });

  it("plano nunca aprovado não conta como vencido", () => {
    expect(aprovacaoVencida(null, new Date("2026-09-03T12:00:00"))).toBe(false);
  });
});

describe("fragilidades", () => {
  const base = {
    itensAtivos: 10,
    itensSemCriterio: 0,
    candidatosAtivos: 2,
    temEmergencial: true,
    melhorProntidao: 80,
    dataAprovacao: null as string | null,
  };

  it("acusa aprovação vencida", () => {
    const f = fragilidades({ ...base, dataAprovacao: "2020-01-01" });
    expect(f.map((x) => x.tipo)).toContain("aprovacao_vencida");
  });

  it("não acusa nada quando o plano está saudável e recém-aprovado", () => {
    const recente = new Date();
    recente.setMonth(recente.getMonth() - 1);
    const f = fragilidades({ ...base, dataAprovacao: recente.toISOString().slice(0, 10) });
    expect(f).toHaveLength(0);
  });

  it("candidato único é atenção, nenhum candidato é crítico", () => {
    expect(fragilidades({ ...base, candidatosAtivos: 1 }).find((x) => x.tipo === "candidato_unico")?.severidade)
      .toBe("atencao");
    expect(fragilidades({ ...base, candidatosAtivos: 0, temEmergencial: false }).find((x) => x.tipo === "sem_candidato")?.severidade)
      .toBe("critica");
  });
});

describe("cobertura do cargo", () => {
  it("rascunho, ativo e concluído cobrem o cargo; arquivado não", () => {
    expect(cobreCargo("rascunho")).toBe(true);
    expect(cobreCargo("ativo")).toBe(true);
    // concluído = há candidato apto: o cargo segue coberto
    expect(cobreCargo("concluido")).toBe(true);
    // arquivar tira a cobertura, e o cargo volta a aparecer como em aberto
    expect(cobreCargo("arquivado")).toBe(false);
    expect(cobreCargo(null)).toBe(false);
  });
});

describe("aptidão do candidato", () => {
  it("vale 6 meses a contar da conclusão", () => {
    expect(MESES_VALIDADE_APTIDAO).toBe(6);
    expect(iso(vencimentoAptidao("2026-09-07"))).toBe("2027-03-07");
  });

  it("não transborda mês curto, como a aprovação", () => {
    expect(iso(vencimentoAptidao("2026-08-31"))).toBe("2027-02-28");
  });

  it("vence só depois dos 6 meses", () => {
    const hoje = new Date("2026-09-07T12:00:00");
    expect(aptidaoVencida("2026-06-01", hoje)).toBe(false);
    expect(aptidaoVencida("2026-01-01", hoje)).toBe(true);
    expect(aptidaoVencida(null, hoje)).toBe(false);
  });

  it("só é apto válido quando concluído e dentro do prazo", () => {
    const hoje = new Date("2026-09-07T12:00:00");
    expect(temAptoValido("concluido", "2026-08-01", hoje)).toBe(true);
    expect(temAptoValido("concluido", "2026-01-01", hoje)).toBe(false); // vencida
    expect(temAptoValido("ativo", "2026-08-01", hoje)).toBe(false); // não concluído
    expect(temAptoValido("arquivado", "2026-08-01", hoje)).toBe(false);
  });
});

describe("fragilidades de plano concluído", () => {
  const recente = () => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().slice(0, 10);
  };
  const base = {
    itensAtivos: 10,
    itensSemCriterio: 0,
    candidatosAtivos: 1,
    temEmergencial: false,
    melhorProntidao: 20,
    dataAprovacao: null as string | null,
  };

  it("com apto válido, não cobra cobertura emergencial nem baixa prontidão", () => {
    const f = fragilidades({ ...base, situacao: "concluido", dataConclusao: recente() });
    const tipos = f.map((x) => x.tipo);
    expect(tipos).not.toContain("sem_emergencial");
    expect(tipos).not.toContain("baixa_prontidao");
    expect(tipos).not.toContain("aptidao_vencida");
  });

  it("com aptidão vencida, acusa e volta a cobrar o resto", () => {
    const f = fragilidades({ ...base, situacao: "concluido", dataConclusao: "2020-01-01" });
    const tipos = f.map((x) => x.tipo);
    expect(tipos).toContain("aptidao_vencida");
    expect(tipos).toContain("sem_emergencial");
    expect(tipos).toContain("baixa_prontidao");
  });

  it("plano ativo segue cobrando normalmente", () => {
    const f = fragilidades({ ...base, situacao: "ativo", dataConclusao: null });
    const tipos = f.map((x) => x.tipo);
    expect(tipos).toContain("sem_emergencial");
    expect(tipos).toContain("baixa_prontidao");
    expect(tipos).not.toContain("aptidao_vencida");
  });
});

describe("prontidao", () => {
  it("pondera pelo peso e considera pronto a partir do nível 3", () => {
    const itens = [
      { id: "a", peso: 3, ativo: true },
      { id: "b", peso: 1, ativo: true },
      { id: "c", peso: 5, ativo: false }, // inativo não entra na conta
    ];
    const avals = [
      { item_id: "a", nivel: 3 },
      { item_id: "b", nivel: 2 },
    ];
    expect(prontidao(itens, avals)).toBe(75); // 3 de 4
  });

  it("reproduz o percentual da planilha da Suelen (24 de 28 prontos)", () => {
    const itens = Array.from({ length: 28 }, (_, i) => ({ id: String(i), peso: 1, ativo: true }));
    const avals = itens.map((it, i) => ({ item_id: it.id, nivel: i < 24 ? 3 : 1 }));
    expect(prontidao(itens, avals)).toBe(86); // 85,71% arredondado
  });
});
