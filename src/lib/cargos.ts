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
 * Sugere o nome de um cargo novo seguindo a convenção que a própria função já
 * usa. Na função Comercial os cargos levam o nível em romano (Comercial I, II…);
 * nas demais, o nome é só a função e o nível fica na sua coluna.
 *
 * A convenção só é "romano" se TODOS os cargos existentes da função a seguem —
 * um único cargo fora do padrão basta para não inventar sufixo.
 */
export function sugerirNomeCargo(
  nomeFuncao: string,
  cargosDaFuncao: { nome: string; nivel: number }[],
  nivel: number,
): string {
  const usaRomano =
    cargosDaFuncao.length > 0 &&
    cargosDaFuncao.every((c) => c.nome === `${nomeFuncao} ${romano(c.nivel)}`);
  return usaRomano ? `${nomeFuncao} ${romano(nivel)}` : nomeFuncao;
}

/** Próximo nível livre dentro de uma função. */
export function proximoNivel(cargosDaFuncao: { nivel: number }[]): number {
  return cargosDaFuncao.length > 0 ? Math.max(...cargosDaFuncao.map((c) => c.nivel)) + 1 : 1;
}
