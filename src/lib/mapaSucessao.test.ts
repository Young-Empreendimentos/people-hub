import { describe, it, expect } from "vitest";
import { indicadores, serieHistorica } from "./mapaSucessao";

describe("indicadores do mapa de sucessão", () => {
  it("parcial vale meia cobertura no índice", () => {
    const i = indicadores([
      { cobertura: "total", headcount: 1 },
      { cobertura: "parcial", headcount: 1 },
      { cobertura: "descoberta", headcount: 1 },
      { cobertura: "descoberta", headcount: 1 },
    ]);
    expect(i).toMatchObject({ posicoes: 4, total: 1, parcial: 1, descoberta: 2 });
    expect(i.indice).toBe(38); // (1 + 0,5) / 4 = 37,5%
    expect(i.mapeadas).toBe(50);
  });

  it("por pessoas pondera pelo tamanho da posição", () => {
    // 6 consultores cobertos pesam mais que 1 assistente descoberto
    const i = indicadores([
      { cobertura: "total", headcount: 6 },
      { cobertura: "descoberta", headcount: 1 },
    ]);
    expect(i.indice).toBe(50);
    expect(i.porPessoas).toBe(86); // 6/7
  });

  it("sem posições, tudo zero (sem dividir por zero)", () => {
    expect(indicadores([])).toMatchObject({ posicoes: 0, indice: 0, mapeadas: 0, porPessoas: 0 });
  });
});

describe("série histórica", () => {
  it("agrupa por dia e ordena", () => {
    const s = serieHistorica([
      { data: "2026-10-02", cobertura: "total", headcount: 1 },
      { data: "2026-10-01", cobertura: "descoberta", headcount: 1 },
      { data: "2026-10-02", cobertura: "descoberta", headcount: 1 },
    ]);
    expect(s.map((p) => [p.data, p.indice])).toEqual([["2026-10-01", 0], ["2026-10-02", 50]]);
  });
});
