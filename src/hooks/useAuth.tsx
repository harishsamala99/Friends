import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type AppRole = "super_admin" | "competition_admin" | "match_official" | "viewer";

type AuthValue = {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  loading: boolean;
  canManage: boolean;
  canOfficiate: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthValue>({
  user: null,
  session: null,
  roles: [],
  loading: true,
  canManage: false,
  canOfficiate: false,
  signOut: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      if (!active) return;
      setSession(s);
      if (!s) setRoles([]);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user) return;
    let active = true;
    (supabase as any)
      .from("user_roles")
      .select("role")
      .eq("user_id", session.user.id)
      .then(({ data }: { data: { role: AppRole }[] | null }) => {
        if (active) setRoles((data ?? []).map((r) => r.role));
      });
    return () => {
      active = false;
    };
  }, [session?.user?.id]);

  const canManage = roles.includes("super_admin") || roles.includes("competition_admin");

  return (
    <AuthContext.Provider
      value={{
        user: session?.user ?? null,
        session,
        roles,
        loading,
        canManage,
        canOfficiate: canManage || roles.includes("match_official"),
        signOut: async () => {
          await supabase.auth.signOut();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
