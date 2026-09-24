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

  it("segue o romano quando os cargos da função já usam", () => {
    expect(sugerirNomeCargo("Comercial", comercial, 8)).toBe("Comercial VIII");
  });

  it("lê a convenção dos cargos, não do nome da função", () => {
    // Caso real: a função se chama "Consultor Comercial", mas os cargos são
    // "Comercial I…VII". O nível novo tem de seguir os cargos.
    expect(sugerirNomeCargo("Consultor Comercial", comercial, 8)).toBe("Comercial VIII");
  });

  it("prefixos diferentes desligam o romano", () => {
    const mistos = [
      { nome: "Comercial I", nivel: 1 },
      { nome: "Vendas II", nivel: 2 },
    ];
    expect(sugerirNomeCargo("Consultor Comercial", mistos, 3)).toBe("Consultor Comercial");
  });

  it("romano que não bate com o nível desliga o romano", () => {
    // "Comercial II" gravado no nível 3 não é a convenção.
    const errado = [{ nome: "Comercial II", nivel: 3 }];
    expect(sugerirNomeCargo("Consultor Comercial", errado, 4)).toBe("Consultor Comercial");
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
    expect(sugerirNomeCargo("Consultor Comercial", misto, 8)).toBe("Consultor Comercial");
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
