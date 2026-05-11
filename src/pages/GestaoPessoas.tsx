import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Users } from "lucide-react";

const options = [
  {
    title: "Funcionários",
    description: "Gerencie os dados dos funcionários da empresa.",
    url: "/funcionarios",
    icon: Users,
  },
  {
    title: "Advertências",
    description: "Registre e acompanhe advertências verbais e formais dos funcionários.",
    url: "/gestao-pessoas/advertencias",
    icon: AlertTriangle,
  },
];

export default function GestaoPessoas() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Gestão de Pessoas</h1>
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
