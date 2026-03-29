import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { ArrowLeft, Upload, Trash2, Download } from "lucide-react";
import { useRef, useState } from "react";

export default function FuncionarioDetalhes() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canDelete } = useAuth();
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
        .select("*, rh_tipos_aditivo(nome), rh_empresas(nome), rh_cargos(nome), rh_equipes(nome)")
        .eq("funcionario_id", id!)
        .order("data", { ascending: false });
      if (error) throw error;
      return data;
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

  const tipoAnexoLabels: Record<string, string> = {
    documento: "Documento",
    comprovante: "Comprovante de Residência",
    contrato: "Contrato de Trabalho",
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
        </TabsList>

        <TabsContent value="dados">
          <Card>
            <CardContent className="pt-6 grid grid-cols-2 gap-4 text-sm">
              <div><span className="font-medium text-muted-foreground">RG:</span> {(func as any).rg || "—"}</div>
              <div><span className="font-medium text-muted-foreground">CPF:</span> {(func as any).cpf || "—"}</div>
              <div className="col-span-2"><span className="font-medium text-muted-foreground">Endereço:</span> {(func as any).endereco || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Aniversário:</span> {(func as any).aniversario || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Data Contrato:</span> {(func as any).data_contrato_vigente || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Empresa:</span> {(func as any).rh_empresas?.nome || "—"}</div>
              <div><span className="font-medium text-muted-foreground">Equipe:</span> {(func as any).rh_equipes?.nome || "—"}</div>
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
                        <TableCell>{h.data}</TableCell>
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
                        <TableCell>{a.data}</TableCell>
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
      </Tabs>
    </div>
  );
}
