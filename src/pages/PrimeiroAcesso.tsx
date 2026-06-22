import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Combobox } from "@/components/ui/combobox";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { toast } from "sonner";

const maskCpf = (cpf?: string | null) => {
  if (!cpf) return "";
  const d = cpf.replace(/\D/g, "");
  if (d.length < 11) return cpf;
  return `***.${d.slice(3, 6)}.${d.slice(6, 9)}-**`;
};

export default function PrimeiroAcesso() {
  const navigate = useNavigate();
  const { user, signOut, refreshRole } = useAuth();
  const [funcId, setFuncId] = useState("");

  const { data: funcionarios = [], isLoading } = useQuery({
    queryKey: ["funcionarios_primeiro_acesso"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("rh_funcionarios")
        .select("id, nome_completo, cpf")
        .order("nome_completo");
      if (error) throw error;
      return data || [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user || !funcId) throw new Error("Selecione seu nome.");
      const func = (funcionarios as any[]).find((f) => f.id === funcId);
      const { error } = await supabase.from("rh_user_roles").insert({
        user_id: user.id,
        role: "colaborador" as any,
        status: "pendente" as any,
        funcionario_id: funcId,
        nome: func?.nome_completo ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: async () => {
      toast.success("Solicitação enviada! Aguarde a aprovação do RH.");
      await refreshRole();
      navigate("/meus-kms", { replace: true });
    },
    onError: (e: any) => toast.error(e.message || "Erro ao enviar solicitação."),
  });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Bem-vindo(a) ao Pilares</CardTitle>
          <CardDescription>
            Olá, <span className="font-medium">{user?.email}</span>. Para concluir seu cadastro, selecione seu nome na lista de funcionários. O RH precisará aprovar antes de liberar o acesso.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Selecione seu nome</label>
            <Combobox
              options={(funcionarios as any[]).map((f) => ({
                value: f.id,
                label: `${f.nome_completo}${f.cpf ? ` — ${maskCpf(f.cpf)}` : ""}`,
              }))}
              value={funcId}
              onValueChange={setFuncId}
              placeholder={isLoading ? "Carregando..." : "Procurar pelo seu nome"}
            />
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
            <Button
              className="flex-1"
              disabled={!funcId || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? "Enviando..." : "Solicitar acesso"}
            </Button>
          </div>
          <p className="text-xs text-muted-foreground text-center">
            Não encontrou seu nome? Peça ao RH para cadastrá-lo primeiro.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
