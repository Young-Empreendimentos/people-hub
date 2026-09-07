// Visão do DESTINATÁRIO de um plano publicado (não-admin).
//
// Toda leitura passa pelas funções rh_sucessao_plano_publicado /
// rh_sucessao_meus_planos_publicados: o não-admin não tem acesso às tabelas de
// sucessão, então não há como ele alcançar risco de saída, impacto de vacância,
// nem os demais candidatos — nem pela API.

import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, GraduationCap, TriangleAlert } from "lucide-react";
import { PlanoPublicadoView, type PlanoPublicado } from "@/components/sucessao/PlanoPublicadoView";

/** Lista dos planos disponibilizados para o usuário atual. */
export function SucessaoPublicadaLista() {
  const { data, isLoading } = useQuery({
    queryKey: ["rh_sucessao_meus_publicados"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_sucessao_meus_planos_publicados" as any);
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  const planos = data ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold tracking-tight">Meu plano de desenvolvimento</h1>
        <p className="text-sm text-muted-foreground">
          O que foi mapeado para você evoluir no cargo, com o critério de cada item.
        </p>
      </div>

      {planos.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <GraduationCap className="h-6 w-6 mx-auto text-muted-foreground" />
            <p className="font-medium">Nenhum plano disponibilizado</p>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Quando a diretoria disponibilizar um plano para você, ele aparece aqui.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {planos.map((p) => (
            <Card key={p.plano_id} className="hover:bg-muted/40 transition">
              <CardContent className="p-4">
                <Link to={`/sucessao/${p.plano_id}`} className="block">
                  <p className="font-medium">{p.cargo ?? p.titulo}</p>
                  <p className="text-xs text-muted-foreground">
                    {p.titular && <>Titular atual: {p.titular}</>}
                    {p.publicado_em && (
                      <>
                        {p.titular ? " · " : ""}
                        disponibilizado em {new Date(p.publicado_em).toLocaleDateString("pt-BR")}
                      </>
                    )}
                  </p>
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/** Detalhe de um plano publicado. */
export function SucessaoPublicadoDetalhe() {
  const { id } = useParams<{ id: string }>();

  const { data, isLoading, error } = useQuery({
    queryKey: ["rh_sucessao_publicado", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("rh_sucessao_plano_publicado" as any, {
        p_plano_id: id,
      });
      if (error) throw error;
      return data as PlanoPublicado;
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Carregando…</p>;

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
          <Link to="/sucessao"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Voltar</Link>
        </Button>
        <Card className="border-amber-300 dark:border-amber-800">
          <CardContent className="p-6 text-center space-y-2">
            <TriangleAlert className="h-6 w-6 mx-auto text-amber-500" />
            <p className="font-medium">Plano indisponível</p>
            <p className="text-sm text-muted-foreground">
              Este plano não está disponibilizado para você.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" className="-ml-2 h-7" asChild>
        <Link to="/sucessao"><ArrowLeft className="mr-1.5 h-3.5 w-3.5" />Meus planos</Link>
      </Button>
      <PlanoPublicadoView dados={data} />
    </div>
  );
}
