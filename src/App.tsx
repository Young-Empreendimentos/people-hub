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
import NotFound from "./pages/NotFound";

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
              <Route path="/organograma" element={<Organograma />} />
              <Route path="/aniversarios" element={<Aniversarios />} />
              <Route path="/treinamentos" element={<Treinamentos />} />
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
