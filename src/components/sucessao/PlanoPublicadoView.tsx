// Visualização de um plano de sucessão publicado.
//
// O mesmo componente serve ao destinatário e ao preview do admin: o que o admin
// vê no preview é, literalmente, o que a pessoa vê — os dois recebem o payload
// da mesma função do banco (rh_sucessao_plano_publicado).
//
// Nada aqui filtra campo: o banco já devolve só o que foi liberado. Se uma chave
// não veio, ela não existe no objeto — então basta checar presença.

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { GraduationCap, Target, CalendarClock } from "lucide-react";
import { nivelLabel, nivelClasses, categoriaLabel } from "@/lib/sucessao";

export type PlanoPublicado = {
  plano: {
    id: string;
    titulo: string | null;
    cargo: string | null;
    titular: string | null;
    publicado: boolean;
    publicado_em: string | null;
  };
  campos: Record<string, boolean>;
  eu: { funcionario_id: string; nome: string | null; e_candidato: boolean; e_titular: boolean };
  prontidao: number | null;
  preview: boolean;
  itens: {
    id: string;
    categoria: string;
    titulo: string;
    grupo?: string | null;
    criterio?: string | null;
    plano_treinamento?: string | null;
    peso?: number;
    nivel?: number | null;
    data_alvo?: string | null;
    evidencia?: string | null;
  }[];
};

const dataBr = (d: string) => new Date(d + "T12:00").toLocaleDateString("pt-BR");

export function PlanoPublicadoView({ dados }: { dados: PlanoPublicado }) {
  const { plano, campos, eu, itens } = dados;

  // Agrupa como na matriz: grupo da atividade, ou a categoria para texto livre.
  const grupos = new Map<string, PlanoPublicado["itens"]>();
  for (const i of itens) {
    const g = i.grupo || categoriaLabel(i.categoria);
    if (!grupos.has(g)) grupos.set(g, []);
    grupos.get(g)!.push(i);
  }
  const ordenados = [...grupos.entries()].sort((a, b) => a[0].localeCompare(b[0], "pt-BR"));

  const mostraNivel = itens.some((i) => i.nivel !== undefined);

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">{plano.cargo ?? plano.titulo}</h1>
        <p className="text-sm text-muted-foreground">
          Plano de desenvolvimento de {eu.nome ?? "—"}
          {plano.titular && <> · titular atual: {plano.titular}</>}
          {plano.publicado_em && (
            <> · disponibilizado em {new Date(plano.publicado_em).toLocaleDateString("pt-BR")}</>
          )}
        </p>
      </div>

      {dados.prontidao !== null && dados.prontidao !== undefined && (
        <Card>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-medium">Prontidão</span>
              <span className="text-2xl font-bold tabular-nums">{dados.prontidao}%</span>
            </div>
            <Progress value={dados.prontidao} />
            <p className="text-xs text-muted-foreground">
              Percentual dos itens em que você já está no nível “Atende” ou acima.
            </p>
          </CardContent>
        </Card>
      )}

      {itens.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-sm text-muted-foreground">
            Este plano ainda não tem itens mapeados.
          </CardContent>
        </Card>
      ) : (
        ordenados.map(([grupo, linhas]) => (
          <Card key={grupo}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm uppercase tracking-wide text-muted-foreground">
                {grupo}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {linhas.map((i) => (
                <div key={i.id} className="rounded border p-3 space-y-2">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <p className="text-sm font-medium min-w-0">{i.titulo}</p>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {i.peso !== undefined && Number(i.peso) !== 1 && (
                        <Badge variant="outline" className="text-[10px]">peso {Number(i.peso)}</Badge>
                      )}
                      {i.nivel !== undefined && (
                        <Badge variant="outline" className={`text-[11px] ${nivelClasses(i.nivel)}`}>
                          {nivelLabel(i.nivel)}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {i.criterio && (
                    <p className="text-xs text-muted-foreground flex gap-1.5">
                      <Target className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-medium">Está pronto quando:</span> {i.criterio}</span>
                    </p>
                  )}

                  {i.plano_treinamento && (
                    <p className="text-xs flex gap-1.5 rounded bg-muted/60 p-2">
                      <GraduationCap className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span><span className="font-medium">Plano de treinamento:</span> {i.plano_treinamento}</span>
                    </p>
                  )}

                  {(i.data_alvo || i.evidencia) && (
                    <p className="text-xs text-muted-foreground flex gap-1.5">
                      <CalendarClock className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        {i.data_alvo && <>Data-alvo: {dataBr(i.data_alvo)}</>}
                        {i.data_alvo && i.evidencia && " · "}
                        {i.evidencia && <>Evidência: {i.evidencia}</>}
                      </span>
                    </p>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {!eu.e_candidato && mostraNivel && (
        <p className="text-xs text-muted-foreground">
          Você recebeu este plano como titular do cargo. Os níveis mostrados são
          por candidato, e você não é candidato neste plano — por isso aparecem vazios.
        </p>
      )}
    </div>
  );
}
