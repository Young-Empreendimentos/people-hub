import { describe, it, expect } from "vitest";
import {
  hhmmToHours,
  hoursToHHMM,
  calcDescontoPlanoSaude,
  calcAuxilioMoradia,
  calcValorKm,
  somaKmTotal,
  proximoMesPrimeiroDia,
  periodoKm,
} from "./folha";

describe("hhmmToHours", () => {
  it("converte HH:MM em horas decimais", () => {
    expect(hhmmToHours("21:00")).toBe(21);
    expect(hhmmToHours("01:30")).toBe(1.5);
    expect(hhmmToHours("00:15")).toBe(0.25);
    expect(hhmmToHours("08:45")).toBe(8.75);
  });
  it("aceita até 3 dígitos de hora e faz trim", () => {
    expect(hhmmToHours("100:00")).toBe(100);
    expect(hhmmToHours("  8:45  ")).toBe(8.75);
  });
  it("retorna NaN para formato inválido", () => {
    expect(hhmmToHours("abc")).toBeNaN();
    expect(hhmmToHours("1:5")).toBeNaN(); // minutos precisam de 2 dígitos
    expect(hhmmToHours("")).toBeNaN();
    expect(hhmmToHours("12")).toBeNaN();
  });
});

describe("hoursToHHMM", () => {
  it("converte horas decimais em HH:MM", () => {
    expect(hoursToHHMM(21)).toBe("21:00");
    expect(hoursToHHMM(1.5)).toBe("01:30");
    expect(hoursToHHMM(0.25)).toBe("00:15");
    expect(hoursToHHMM(8.75)).toBe("08:45");
  });
  it("arredonda ao minuto, com carry", () => {
    expect(hoursToHHMM(0.9991666667)).toBe("01:00"); // ~59.95 min -> 60
  });
  it("retorna 00:00 para valores não-finitos", () => {
    expect(hoursToHHMM(NaN)).toBe("00:00");
    expect(hoursToHHMM(Infinity)).toBe("00:00");
  });
  it("é inverso de hhmmToHours em valores válidos", () => {
    expect(hoursToHHMM(hhmmToHours("07:38"))).toBe("07:38");
    expect(hoursToHHMM(hhmmToHours("13:07"))).toBe("13:07");
  });
});

describe("calcDescontoPlanoSaude", () => {
  it("aplica 20% sobre a mensalidade (saúde + odonto) e soma o uso integral", () => {
    expect(calcDescontoPlanoSaude(200, 50, 30)).toBe(80); // 250*0.2 + 30
    expect(calcDescontoPlanoSaude(100, 0, 0)).toBe(20);
    expect(calcDescontoPlanoSaude(0, 0, 0)).toBe(0);
  });
  it("arredonda a 2 casas", () => {
    expect(calcDescontoPlanoSaude(33.33, 0, 0)).toBe(6.67); // 6.666 -> 6.67
  });
  it("trata valores ausentes como zero", () => {
    expect(calcDescontoPlanoSaude(undefined as unknown as number, null as unknown as number, 40)).toBe(40);
  });
});

describe("calcAuxilioMoradia", () => {
  it("aplica o percentual sobre a remuneração", () => {
    expect(calcAuxilioMoradia(5000, 25)).toBe(1250);
    expect(calcAuxilioMoradia(3000, 0)).toBe(0);
    expect(calcAuxilioMoradia(1234.56, 10)).toBeCloseTo(123.456, 3);
  });
  it("trata valores ausentes como zero", () => {
    expect(calcAuxilioMoradia(undefined as unknown as number, 25)).toBe(0);
  });
});

describe("calcValorKm", () => {
  it("multiplica km pelo valor por km e arredonda a 2 casas", () => {
    expect(calcValorKm(100, 1.5)).toBe(150);
    expect(calcValorKm(33, 0.75)).toBe(24.75);
    expect(calcValorKm(1, 0.1)).toBe(0.1);
  });
  it("trata valores ausentes como zero", () => {
    expect(calcValorKm(null as unknown as number, 1.5)).toBe(0);
    expect(calcValorKm(10, undefined as unknown as number)).toBe(0);
  });
});

describe("somaKmTotal", () => {
  it("soma valor_total ignorando nulos e strings", () => {
    expect(somaKmTotal([{ valor_total: 10 }, { valor_total: "20.5" }, { valor_total: null }, {}])).toBe(30.5);
    expect(somaKmTotal([])).toBe(0);
  });
});

describe("proximoMesPrimeiroDia", () => {
  it("retorna o 1º dia do mês seguinte", () => {
    expect(proximoMesPrimeiroDia("2026-06")).toBe("2026-07-01");
    expect(proximoMesPrimeiroDia("2026-01")).toBe("2026-02-01");
  });
  it("vira o ano em dezembro", () => {
    expect(proximoMesPrimeiroDia("2026-12")).toBe("2027-01-01");
  });
  it("retorna null para entrada inválida", () => {
    expect(proximoMesPrimeiroDia("")).toBeNull();
    expect(proximoMesPrimeiroDia("abc")).toBeNull();
  });
});

describe("periodoKm (ciclo dia 20 → 19)", () => {
  it("a partir do dia 20 começa no mês corrente", () => {
    expect(periodoKm(new Date(2026, 5, 25))).toEqual({ ini: "2026-06-20", fim: "2026-07-19" });
  });
  it("antes do dia 20 começou no mês anterior", () => {
    expect(periodoKm(new Date(2026, 5, 10))).toEqual({ ini: "2026-05-20", fim: "2026-06-19" });
  });
  it("trata as bordas do dia 19 e 20", () => {
    expect(periodoKm(new Date(2026, 5, 20))).toEqual({ ini: "2026-06-20", fim: "2026-07-19" });
    expect(periodoKm(new Date(2026, 5, 19))).toEqual({ ini: "2026-05-20", fim: "2026-06-19" });
  });
  it("vira o ano nas pontas (dez/jan)", () => {
    expect(periodoKm(new Date(2026, 11, 25))).toEqual({ ini: "2026-12-20", fim: "2027-01-19" });
    expect(periodoKm(new Date(2026, 0, 10))).toEqual({ ini: "2025-12-20", fim: "2026-01-19" });
  });
});
