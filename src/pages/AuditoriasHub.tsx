import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { ClipboardList, FileCheck2 } from "lucide-react";

const options = [
  {
    title: "Atividades de Auditoria",
    description: "Cadastre grupos, atividades, pesos e métodos de auditoria.",
    url: "/atividades-auditoria",
    icon: ClipboardList,
  },
  {
    title: "Gestão de Auditorias",
    description: "Crie, execute e acompanhe as auditorias das equipes.",
    url: "/auditorias",
    icon: FileCheck2,
  },
];

export default function AuditoriasHub() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Auditorias</h1>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {options.map((o) => (
          <Link key={o.url} to={o.url}>
            <Card className="hover:border-primary transition-colors cursor-pointer h-full">
              <CardContent className="p-5 space-y-2">
                <div className="flex items-center gap-2">
                  <o.icon className="h-5 w-5 text-primary" />
                  <h2 className="font-semibold">{o.title}</h2>
                </div>
                <p className="text-sm text-muted-foreground">{o.description}</p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
