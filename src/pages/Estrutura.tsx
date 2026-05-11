import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Building2, Briefcase, Network, Factory } from "lucide-react";

const options = [
  {
    title: "Empresas",
    description: "Cadastre e gerencie as empresas do grupo.",
    url: "/empresas",
    icon: Factory,
  },
  {
    title: "Equipes",
    description: "Organize as equipes e seus integrantes.",
    url: "/equipes",
    icon: Building2,
  },
  {
    title: "Cargos",
    description: "Gerencie os cargos disponíveis na organização.",
    url: "/cargos",
    icon: Briefcase,
  },
  {
    title: "Organograma",
    description: "Visualize a hierarquia organizacional.",
    url: "/organograma",
    icon: Network,
  },
];

export default function Estrutura() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Estrutura</h1>
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
