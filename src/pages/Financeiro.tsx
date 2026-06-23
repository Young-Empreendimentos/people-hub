import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { DollarSign, Receipt, HandCoins, Car } from "lucide-react";

const options = [
  {
    title: "Adiantamentos",
    description: "Gerencie os adiantamentos salariais dos funcionários.",
    url: "/adiantamentos",
    icon: DollarSign,
  },
  {
    title: "Descontos",
    description: "Veja por mês os descontos lançados nas folhas.",
    url: "/descontos",
    icon: Receipt,
  },
  {
    title: "Reembolsos",
    description: "Histórico de reembolsos e gratificações lançados nas folhas.",
    url: "/reembolsos",
    icon: HandCoins,
  },
  {
    title: "Aprovações de KM",
    description: "Aprove ou rejeite as solicitações de quilometragem dos funcionários.",
    url: "/aprovacoes-km",
    icon: Car,
  },
];

export default function Financeiro() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Financeiro</h1>
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
