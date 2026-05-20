import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Download } from "lucide-react";
import { useRef, useState } from "react";
import BeneficiosMoradiaTab from "@/components/funcionario/BeneficiosMoradiaTab";

export default function FuncionarioDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDelete, role } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTipo, setUploadTipo] = useState<string>("documento");

  const { data: func } = useQuery({
    queryKey: ["rh_funcionario", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("*, rh_empresas(nome), rh_equipes(nome), rh_cargos(nome, nivel, remuneracao, rh_trilhas_cargo(nome))")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: anexos = [] } = useQuery({
    queryKey: ["rh_funcionario_anexos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionario_anexos")
        .select("*")
        .eq("funcionario_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["rh_admissoes_desligamentos", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_admissoes_desligamentos")
        .select("*")
        .eq("funcionario_id", id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: aditivos = [] } = useQuery({
    queryKey: ["rh_aditivos_funcionario", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_aditivos")
        .select("*, rh_tipos_aditivo(nome), rh_empresas(nome), rh_cargos(nome, remuneracao), rh_equipes(nome)")
        .eq("funcionario_id", id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Efetivo: aditivo é fonte de verdade; cai pro cadastro quando não há.
  const efetivo = (() => {
    const f: any = func || {};
    let empresa = { id: f.empresa_id, nome: f.rh_empresas?.nome };
    let equipe = { id: f.equipe_id, nome: f.rh_equipes?.nome };
    let cargo = {
      id: f.cargo_id,
      nome: f.rh_cargos?.nome,
      remuneracao: f.rh_cargos?.remuneracao ?? null,
    };
    // aditivos vem ordenado data DESC; pega o primeiro valor não-nulo de cada campo
    for (const a of aditivos as any[]) {
      if (!cargo.id && a.cargo_final_id) cargo = { id: a.cargo_final_id, nome: a.rh_cargos?.nome, remuneracao: null };
      if (!empresa.id && a.empresa_final_id) empresa = { id: a.empresa_final_id, nome: a.rh_empresas?.nome };
      if (!equipe.id && a.equipe_final_id) equipe = { id: a.equipe_final_id, nome: a.rh_equipes?.nome };
    }
    // Sobrescreve com o mais recente (já que aditivos[0] é o último, percorre de baixo p/ cima)
    const cargoLatest = (aditivos as any[]).find((a) => a.cargo_final_id);
    const empresaLatest = (aditivos as any[]).find((a) => a.empresa_final_id);
    const equipeLatest = (aditivos as any[]).find((a) => a.equipe_final_id);
    if (cargoLatest) cargo = { id: cargoLatest.cargo_final_id, nome: cargoLatest.rh_cargos?.nome, remuneracao: cargoLatest.rh_cargos?.remuneracao ?? null };
    if (empresaLatest) empresa = { id: empresaLatest.empresa_final_id, nome: empresaLatest.rh_empresas?.nome };
    if (equipeLatest) equipe = { id: equipeLatest.equipe_final_id, nome: equipeLatest.rh_equipes?.nome };
    return { empresa, equipe, cargo };
  })();

  const { data: treinamentos = [] } = useQuery({
    queryKey: ["rh_treinamentos_funcionario", id],
    queryFn: async () => {
      const { data: partRows, error: pErr } = await supabase
        .from("rh_treinamento_participantes")
        .select("treinamento_id")
        .eq("funcionario_id", id!);
      if (pErr) throw pErr;
      if (!partRows || partRows.length === 0) return [];
      const ids = partRows.map((r) => r.treinamento_id);
      const { data, error } = await supabase
        .from("rh_treinamentos")
        .select("*, rh_tipos_treinamento(nome)")
        .in("id", ids)
        .order("data", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const path = `funcionarios/${id}/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("rh-anexos")
        .upload(path, file);
      if (uploadError) throw uploadError;

      const { error } = await supabase.from("rh_funcionario_anexos").insert({
        funcionario_id: id!,
        tipo: uploadTipo,
        file_path: path,
        file_name: file.name,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionario_anexos", id] });
      toast.success("Anexo enviado.");
    },
    onError: () => toast.error("Erro ao enviar anexo."),
  });

  const deleteAnexoMutation = useMutation({
    mutationFn: async (anexo: { id: string; file_path: string }) => {
      await supabase.storage.from("rh-anexos").remove([anexo.file_path]);
      const { error } = await supabase.from("rh_funcionario_anexos").delete().eq("id", anexo.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionario_anexos", id] });
      toast.success("Anexo excluído.");
    },
    onError: () => toast.error("Erro ao excluir anexo."),
  });

  const canUncheck = role === "admin" || role === "coordenador";

  const toggleFieldMutation = useMutation({
    mutationFn: async ({ field, value }: { field: "seguro_vida" | "kit_onboarding"; value: boolean }) => {
      const { error } = await supabase
        .from("rh_funcionarios")
        .update({ [field]: value })
        .eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rh_funcionario", id] });
    },
    onError: () => toast.error("Erro ao atualizar."),
  });

  const handleToggle = (field: "seguro_vida" | "kit_onboarding", current: boolean) => {
    const newValue = !current;
    if (!newValue && !canUncheck) {
      toast.error("Apenas coordenadores ou administradores podem desmarcar esta opção.");
      return;
    }
    toggleFieldMutation.mutate({ field, value: newValue });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
    e.target.value = "";
  };

  const downloadAnexo = async (filePath: string, fileName: string) => {
    const { data, error } = await supabase.storage.from("rh-anexos").download(filePath);
    if (error) { toast.error("Erro ao baixar arquivo."); return; }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url; a.download = fileName; a.click();
    URL.revokeObjectURL(url);
  };

  const lastEvent = historico[0];
  const status = lastEvent?.tipo === "desligamento" ? "Desligado" : lastEvent?.tipo === "admissao" ? "Ativo" : "Sem registro";
  const dataAdmissao = [...historico].reverse().find((h) => h.tipo === "admissao")?.data || null;

  const tipoAnexoLabels: Record<string, string> = {
    documento: "Documento",
    comprovante: "Comprovante de Residência",
    contrato: "Contrato de Trabalho",
  };

  const fmtDate = (d?: string | null) => {
    if (!d) return "—";
    const s = String(d).slice(0, 10);
    const m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return m ? `${m[3]}/${m[2]}/${m[1]}` : d;
  };

  if (!func) return <p className="text-muted-foreground p-6">Carregando...</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/funcionarios")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{(func as any).nome_completo}</h1>
          <div className="flex items-center gap-2 mt-1">
            <Badge className={status === "Ativo" ? "bg-emerald-600" : status === "Desligado" ? "bg-destructive" : ""} variant={status === "Sem registro" ? "secondary" : "default"}>
              {status}
            </Badge>
            {(func as any).rh_equipes?.nome && <span className="text-sm text-muted-foreground">{(func as any).rh_equipes.nome}</span>}
            {(func as any).rh_cargos?.nome && <span className="text-sm text-muted-foreground">• {(func as any).rh_cargos.nome}</span>}
          </div>
        </div>
      </div>

      <Tabs defaultValue="dados">
        <TabsList>
          <TabsTrigger value="dados">Dados Pessoais</TabsTrigger>
          <TabsTrigger value="anexos">Anexos ({anexos.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({historico.length})</TabsTrigger>
          <TabsTrigger value="aditivos">Aditivos ({aditivos.length})</TabsTrigger>
          <TabsTrigger value="treinamentos">Treinamentos ({treinamentos.length})</TabsTrigger>
          <TabsTrigger value="moradia">Benefícios de Moradia</TabsTrigger>
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-muted-foreground">RG:</span> {(func as any).rg || "—"}</div>
              <div><span className="font-medium text-muted-foreground">CPF:</span> {(func as any).cpf || "—"}</div>
              <div className="col-span-2"><span className="font-medium text-muted-foreground">Endereço:</span> {(func as any).endereco || "—"}</div>
              <div className="col-span-2"><span className="font-medium text-muted-foreground">Telefone:</span> {(func as any).telefone || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Aniversário:</span> {fmtDate((func as any).aniversario)}</div>
              <div><span className="font-medium text-muted-foreground">Data de Admissão:</span> {fmtDate(dataAdmissao)}</div>
              <div><span className="font-medium text-muted-foreground">Data Contrato:</span> {fmtDate((func as any).data_contrato_vigente)}</div>
              <div><span className="font-medium text-muted-foreground">Empresa:</span> {(func as any).rh_empresas?.nome || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Equipe:</span> {(func as any).rh_equipes?.nome || "—"}</div>
              <div className="col-span-2 border-t pt-4 mt-2 flex gap-8">
                <label className="flex items-center gap-2 cursor-pointer">
                  <Switch
                    checked={!!(func as any).kit_onboarding}
                    onCheckedChange={() => handleToggle("kit_onboarding", !!(func as any).kit_onboarding)}
                  />
                  <span className="font-medium text-sm">Kit Onboarding</span>
                </label>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="anexos">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Anexos</CardTitle>
                <div className="flex items-center gap-2">
                  <select
                    className="text-sm border rounded px-2 py-1 bg-background"
                    value={uploadTipo}
                    onChange={(e) => setUploadTipo(e.target.value)}
                  >
                    <option value="documento">Documento</option>
                    <option value="comprovante">Comprovante</option>
                    <option value="contrato">Contrato</option>
                  </select>
                  <Button size="sm" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="mr-1 h-3 w-3" /> Enviar
                  </Button>
                  <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {anexos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum anexo.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Arquivo</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead className="w-24 text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {anexos.map((a) => (
                      <TableRow key={a.id}>
                        <TableCell>{a.file_name}</TableCell>
                        <TableCell>{tipoAnexoLabels[a.tipo] || a.tipo}</TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="icon" onClick={() => downloadAnexo(a.file_path, a.file_name)}>
                              <Download className="h-4 w-4" />
                            </Button>
                            {canDelete && (
                              <Button variant="ghost" size="icon" className="text-destructive" onClick={() => deleteAnexoMutation.mutate(a)}>
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico">
          <Card>
            <CardContent className="pt-6">
              {historico.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum registro.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historico.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell>{fmtDate(h.data)}</TableCell>
                        <TableCell>
                          <Badge variant={h.tipo === "admissao" ? "default" : "destructive"}>
                            {h.tipo === "admissao" ? "Admissão" : "Desligamento"}
                          </Badge>
                        </TableCell>
                        <TableCell>{h.observacoes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="aditivos">
          <Card>
            <CardContent className="pt-6">
              {aditivos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum aditivo.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Empresa Final</TableHead>
                      <TableHead>Cargo Final</TableHead>
                      <TableHead>Equipe Final</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {aditivos.map((a: any) => (
                      <TableRow key={a.id}>
                        <TableCell>{fmtDate(a.data)}</TableCell>
                        <TableCell>{a.rh_tipos_aditivo?.nome || "—"}</TableCell>
                        <TableCell>{a.rh_empresas?.nome || "—"}</TableCell>
                        <TableCell>{a.rh_cargos?.nome || "—"}</TableCell>
                        <TableCell>{a.rh_equipes?.nome || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="treinamentos">
          <Card>
            <CardContent className="pt-6">
              {treinamentos.length === 0 ? (
                <p className="text-muted-foreground text-sm">Nenhum treinamento registrado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Treinamento</TableHead>
                      <TableHead>Observações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {treinamentos.map((t: any) => (
                      <TableRow key={t.id}>
                        <TableCell>{fmtDate(t.data)}</TableCell>
                        <TableCell className="font-medium">{(t.rh_tipos_treinamento as any)?.nome || "—"}</TableCell>
                        <TableCell className="text-muted-foreground">{t.observacoes || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="moradia">
          <BeneficiosMoradiaTab
            funcionarioId={id!}
            remuneracaoCargo={(func as any).rh_cargos?.remuneracao ?? null}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
