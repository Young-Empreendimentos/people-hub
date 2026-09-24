import { describe, it, expect } from "vitest";
import { romano, sugerirNomeCargo, proximoNivel } from "./cargos";

describe("romano", () => {
  it("converte até X e cai para o número acima disso", () => {
    expect(romano(1)).toBe("I");
    expect(romano(4)).toBe("IV");
    expect(romano(7)).toBe("VII");
    expect(romano(10)).toBe("X");
    expect(romano(11)).toBe("11");
  });
});

describe("sugerirNomeCargo", () => {
  // Como estão os dados reais da função Comercial
  const comercial = [
    { nome: "Comercial I", nivel: 1 },
    { nome: "Comercial I", nivel: 1 }, // outro pacote salarial, mesmo nível
    { nome: "Comercial II", nivel: 2 },
    { nome: "Comercial VII", nivel: 7 },
  ];

  it("segue o romano quando a função já usa (Comercial)", () => {
    expect(sugerirNomeCargo("Comercial", comercial, 8)).toBe("Comercial VIII");
  });

  it("não inventa sufixo quando a função usa o nome puro", () => {
    const coord = [
      { nome: "Coordenador Administrativo", nivel: 1 },
      { nome: "Coordenador Administrativo", nivel: 5 },
    ];
    expect(sugerirNomeCargo("Coordenador Administrativo", coord, 8)).toBe("Coordenador Administrativo");
  });

  it("um único cargo fora do padrão desliga o romano", () => {
    const misto = [...comercial, { nome: "Comercial Sênior", nivel: 3 }];
    expect(sugerirNomeCargo("Comercial", misto, 8)).toBe("Comercial");
  });

  it("função sem cargos sugere o nome da própria função", () => {
    expect(sugerirNomeCargo("Gerente Administrativo", [], 1)).toBe("Gerente Administrativo");
  });

  it("o bug antigo não se repete: o nome nunca vem da trilha", () => {
    // A versão anterior gerava "trilha + romano": Administrativo + nível 5.
    const coord = [{ nome: "Coordenador Administrativo", nivel: 5 }];
    expect(sugerirNomeCargo("Coordenador Administrativo", coord, 5)).not.toBe("Administrativo V");
  });
});

describe("proximoNivel", () => {
  it("é o maior nível da função mais um", () => {
    expect(proximoNivel([{ nivel: 1 }, { nivel: 7 }, { nivel: 3 }])).toBe(8);
  });
  it("começa em 1 numa função nova", () => {
    expect(proximoNivel([])).toBe(1);
  });
});
