import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

type RhRole = "admin" | "coordenador" | "usuario" | "colaborador";
type RoleStatus = "pendente" | "ativo" | "rejeitado";

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: RhRole | null;
  roleStatus: RoleStatus | null;
  funcionarioId: string | null;
  userName: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRole: () => Promise<void>;
  isColaborador: boolean;
  isStaff: boolean;
  isAuditor: boolean;
  canDelete: boolean;
  canConfig: boolean;
  canManageCargos: boolean;
  canManageBeneficiosMoradia: boolean;
  canEditCargoSalario: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<RhRole | null>(null);
  const [roleStatus, setRoleStatus] = useState<RoleStatus | null>(null);
  const [funcionarioId, setFuncionarioId] = useState<string | null>(null);
  const [userName, setUserName] = useState<string | null>(null);
  const [isAuditor, setIsAuditor] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchRole = async (userId: string) => {
    const { data } = await supabase
      .from("rh_user_roles")
      .select("role, nome, status, funcionario_id")
      .eq("user_id", userId);
    const rows = (data ?? []) as any[];
    setIsAuditor(rows.some((r) => r.role === "auditor" && r.status === "ativo"));
    const nonAuditor = rows.filter((r) => r.role !== "auditor");
    if (nonAuditor.length === 0) {
      setRole(null); setUserName(null); setRoleStatus(null); setFuncionarioId(null);
      return;
    }
    // Prioridade: admin > coordenador > usuario > colaborador
    const priority: Record<string, number> = { admin: 4, coordenador: 3, usuario: 2, colaborador: 1 };
    nonAuditor.sort((a, b) => (priority[b.role] ?? 0) - (priority[a.role] ?? 0));
    const best = nonAuditor[0];
    setRole((best.role as RhRole) ?? null);
    setUserName((best.nome as string) ?? null);
    setRoleStatus((best.status as RoleStatus) ?? null);
    setFuncionarioId((best.funcionario_id as string) ?? null);
  };


  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        if (session?.user) {
          setTimeout(() => fetchRole(session.user.id), 0);
        } else {
          setRole(null);
          setRoleStatus(null);
          setFuncionarioId(null);
          setUserName(null);
          setIsAuditor(false);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) fetchRole(session.user.id);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const refreshRole = async () => {
    if (user) await fetchRole(user.id);
  };

  const isColaborador = role === "colaborador";
  const isStaff = role === "admin" || role === "coordenador" || role === "usuario";
  const canDelete = role === "admin" || role === "coordenador";
  const canConfig = role === "admin" || role === "coordenador";
  const canManageCargos = role === "admin" || role === "coordenador";
  const canManageBeneficiosMoradia = role === "admin" || role === "coordenador";
  const canEditCargoSalario = role === "admin" || role === "coordenador";

  return (
    <AuthContext.Provider value={{
      session, user, role, roleStatus, funcionarioId, userName, loading,
      signIn, signOut, refreshRole,
      isColaborador, isStaff, isAuditor,
      canDelete, canConfig, canManageCargos, canManageBeneficiosMoradia, canEditCargoSalario,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
