import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Combobox } from "@/components/ui/combobox";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, ExternalLink, Users } from "lucide-react";

const statusLabel: Record<string, { label: string; variant: any }> = {
  em_andamento: { label: "Em andamento", variant: "secondary" },
  finalizada: { label: "Aguardando aprovação", variant: "default" },
  aprovada: { label: "Aprovada", variant: "default" },
  rejeitada: { label: "Rejeitada", variant: "destructive" },
};

export default function Auditorias() {
  const qc = useQueryClient();
  const { user, isAuditor, canConfig } = useAuth();
  const podeCriar = isAuditor || canConfig;

  const { data: auditorias = [], isLoading } = useQuery({
    queryKey: ["rh_auditorias"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_auditorias")
        .select("*, rh_equipes(nome)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: equipes = [] } = useQuery({
    queryKey: ["rh_equipes"],
    queryFn: async () => (await supabase.from("rh_equipes").select("id, nome").order("nome")).data ?? [],
  });

  const { data: minhasEquipes = [] } = useQuery({
    queryKey: ["rh_auditor_equipes", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase.from("rh_auditor_equipes").select("equipe_id").eq("user_id", user!.id);
      return data ?? [];
    },
  });

  const equipesPermitidas = canConfig
    ? (equipes as any[])
    : (equipes as any[]).filter((e) => minhasEquipes.some((m: any) => m.equipe_id === e.id));

  const [open, setOpen] = useState(false);
  const [titulo, setTitulo] = useState("");
  const [equipeId, setEquipeId] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));

  const criar = useMutation({
    mutationFn: async () => {
      const { data: id, error } = await supabase.rpc("rh_criar_auditoria", {
        p_titulo: titulo, p_equipe_id: equipeId || (null as any), p_data_referencia: data,
      });
      if (error) throw error;
      return id as unknown as string;
    },
    onSuccess: (id) => {
      qc.invalidateQueries({ queryKey: ["rh_auditorias"] });
      toast.success("Auditoria criada.");
      setOpen(false); setTitulo(""); setEquipeId("");
      window.location.assign(`/auditorias/${id}`);
    },
    onError: (e: any) => toast.error("Erro: " + e.message),
  });

  const equipeNome = (id: string | null) =>
    id ? (equipes as any[]).find((e) => e.id === id)?.nome ?? "—" : "—";

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Auditorias</h1>
          <p className="text-sm text-muted-foreground">Execução, finalização e histórico de auditorias.</p>
        </div>
        {podeCriar && (
          <Button onClick={() => setOpen(true)}><Plus className="mr-2 h-4 w-4" />Nova auditoria</Button>
        )}
      </div>

      <Card>
        <CardContent className="pt-4">
          {isLoading ? <p className="text-muted-foreground">Carregando…</p> : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Equipe</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>%</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {auditorias.map((a) => {
                  const s = statusLabel[a.status] ?? { label: a.status, variant: "outline" };
                  return (
                    <TableRow key={a.id}>
                      <TableCell className="font-medium">{a.titulo}</TableCell>
                      <TableCell>{equipeNome(a.equipe_id)}</TableCell>
                      <TableCell>{a.data_referencia ? new Date(a.data_referencia).toLocaleDateString("pt-BR") : "—"}</TableCell>
                      <TableCell><Badge variant={s.variant}>{s.label}</Badge></TableCell>
                      <TableCell>{a.percentual_final != null ? `${(Number(a.percentual_final) * 100).toFixed(1)}%` : "—"}</TableCell>
                      <TableCell>
                        <Button asChild size="sm" variant="ghost">
                          <Link to={`/auditorias/${a.id}`}><ExternalLink className="h-4 w-4" /></Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {auditorias.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Nenhuma auditoria.</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Nova auditoria</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="text-sm">Título</label><Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Ex.: Auditoria Licenciamento - Out/2026" /></div>
            <div><label className="text-sm">Equipe</label>
              <Combobox
                options={equipesPermitidas.map((e: any) => ({ value: e.id, label: e.nome }))}
                value={equipeId} onValueChange={setEquipeId}
                placeholder={canConfig ? "Selecionar equipe (opcional)" : "Selecionar equipe"}
                emptyMessage={canConfig ? "—" : "Nenhuma equipe vinculada a você"}
              />
              {!canConfig && equipesPermitidas.length === 0 && (
                <p className="text-xs text-amber-700 mt-1">Você não está vinculado a nenhuma equipe. Solicite o vínculo ao admin.</p>
              )}
            </div>
            <div><label className="text-sm">Data de referência</label><Input type="date" value={data} onChange={(e) => setData(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button>
            <Button onClick={() => criar.mutate()} disabled={!titulo || criar.isPending}>Criar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
