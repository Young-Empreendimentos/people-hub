import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/hooks/useAuth";
import { AppLayout } from "@/components/AppLayout";
import Login from "./pages/Login";
import Index from "./pages/Index";
import Funcionarios from "./pages/Funcionarios";
import FuncionarioDetalhes from "./pages/FuncionarioDetalhes";
import Equipes from "./pages/Equipes";
import Empresas from "./pages/Empresas";
import Cargos from "./pages/Cargos";
import Admissoes from "./pages/Admissoes";
import Aditivos from "./pages/Aditivos";
import Adiantamentos from "./pages/Adiantamentos";
import Avaliacoes from "./pages/Avaliacoes";
import FolhaMensal from "./pages/FolhaMensal";
import Atividades from "./pages/Atividades";
import Organograma from "./pages/Organograma";
import Aniversarios from "./pages/Aniversarios";
import Treinamentos from "./pages/Treinamentos";
import Configuracoes from "./pages/Configuracoes";
import GestaoPessoas from "./pages/GestaoPessoas";
import Estrutura from "./pages/Estrutura";
import Financeiro from "./pages/Financeiro";
import Descontos from "./pages/Descontos";
import DescontosDetalhes from "./pages/DescontosDetalhes";
import Reembolsos from "./pages/Reembolsos";
import ReembolsosDetalhes from "./pages/ReembolsosDetalhes";
import Advertencias from "./pages/Advertencias";
import BeneficiosMoradia from "./pages/BeneficiosMoradia";
import Absenteismo from "./pages/Absenteismo";
import PlanoSaude from "./pages/PlanoSaude";
import Uniformes from "./pages/Uniformes";
import NotFound from "./pages/NotFound";
import PrimeiroAcesso from "./pages/PrimeiroAcesso";
import MeusKms from "./pages/MeusKms";
import AprovacoesKm from "./pages/AprovacoesKm";
import AtividadesAuditoria from "./pages/AtividadesAuditoria";
import Auditorias from "./pages/Auditorias";
import AuditoriaExecutar from "./pages/AuditoriaExecutar";
import AuditoriasHub from "./pages/AuditoriasHub";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route element={<AppLayout />}>
              <Route path="/primeiro-acesso" element={<PrimeiroAcesso />} />
              <Route path="/meus-kms" element={<MeusKms />} />
              <Route path="/aprovacoes-km" element={<AprovacoesKm />} />
              <Route path="/" element={<Index />} />
              <Route path="/funcionarios" element={<Funcionarios />} />
              <Route path="/funcionarios/:id" element={<FuncionarioDetalhes />} />
              <Route path="/equipes" element={<Equipes />} />
              <Route path="/empresas" element={<Empresas />} />
              <Route path="/cargos" element={<Cargos />} />
              <Route path="/admissoes" element={<Admissoes />} />
              <Route path="/aditivos" element={<Aditivos />} />
              <Route path="/adiantamentos" element={<Adiantamentos />} />
              <Route path="/avaliacoes" element={<Avaliacoes />} />
              <Route path="/folha" element={<FolhaMensal />} />
              <Route path="/atividades" element={<Atividades />} />
              <Route path="/atividades-auditoria" element={<AtividadesAuditoria />} />
              <Route path="/auditorias" element={<AuditoriasHub />} />
              <Route path="/auditorias/lista" element={<Auditorias />} />
              <Route path="/auditorias/:id" element={<AuditoriaExecutar />} />
              <Route path="/organograma" element={<Organograma />} />
              <Route path="/aniversarios" element={<Aniversarios />} />
              <Route path="/treinamentos" element={<Treinamentos />} />
              <Route path="/estrutura" element={<Estrutura />} />
              <Route path="/financeiro" element={<Financeiro />} />
              <Route path="/descontos" element={<Descontos />} />
              <Route path="/descontos/:mes" element={<DescontosDetalhes />} />
              <Route path="/reembolsos" element={<Reembolsos />} />
              <Route path="/reembolsos/:mes" element={<ReembolsosDetalhes />} />
              <Route path="/gestao-pessoas" element={<GestaoPessoas />} />
              <Route path="/gestao-pessoas/advertencias" element={<Advertencias />} />
              <Route path="/gestao-pessoas/beneficios-moradia" element={<BeneficiosMoradia />} />
              <Route path="/gestao-pessoas/absenteismo" element={<Absenteismo />} />
              <Route path="/gestao-pessoas/plano-saude" element={<PlanoSaude />} />
              <Route path="/gestao-pessoas/uniformes" element={<Uniformes />} />
              <Route path="/configuracoes" element={<Configuracoes />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
