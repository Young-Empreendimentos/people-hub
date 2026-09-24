// Regras de nome de cargo.
//
// Modelo: trilha = área; função = o papel dentro da área; cargo = função + nível +
// pacote de remuneração. O nome do cargo é do cargo — não é mais gerado a partir
// da trilha, que era o que fazia uma edição de salário renomear
// "Coordenador Administrativo" para "Administrativo V".

const ROMANOS = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X"];

/** Nível em algarismo romano; acima de X, o número mesmo. */
export const romano = (nivel: number): string => ROMANOS[nivel - 1] ?? String(nivel);

/**
 * Sugere o nome de um cargo novo seguindo a convenção que os cargos da função já
 * usam. Na função Consultor Comercial os cargos levam o nível em romano no nome
 * (Comercial I, II…); nas demais, o nome é só a função e o nível fica na sua
 * coluna.
 *
 * A convenção é lida dos NOMES DOS CARGOS, não do nome da função: todos têm de
 * terminar com o romano do próprio nível e compartilhar o mesmo prefixo. É o que
 * permite a função se chamar "Consultor Comercial" e o nível novo ainda sair
 * "Comercial VIII". Um único cargo fora do padrão basta para não inventar sufixo.
 */
export function sugerirNomeCargo(
  nomeFuncao: string,
  cargosDaFuncao: { nome: string; nivel: number }[],
  nivel: number,
): string {
  if (cargosDaFuncao.length === 0) return nomeFuncao;

  const prefixos = cargosDaFuncao.map((c) => {
    const sufixo = ` ${romano(c.nivel)}`;
    return c.nome.endsWith(sufixo) ? c.nome.slice(0, -sufixo.length) : null;
  });
  const prefixo = prefixos[0];
  const usaRomano = !!prefixo && prefixos.every((p) => p === prefixo);

  return usaRomano ? `${prefixo} ${romano(nivel)}` : nomeFuncao;
}

/** Próximo nível livre dentro de uma função. */
export function proximoNivel(cargosDaFuncao: { nivel: number }[]): number {
  return cargosDaFuncao.length > 0 ? Math.max(...cargosDaFuncao.map((c) => c.nivel)) + 1 : 1;
}
