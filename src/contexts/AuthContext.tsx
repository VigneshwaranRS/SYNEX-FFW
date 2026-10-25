import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import type { User, Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type { OrganizerRole } from "../lib/database.types";

interface OrganizerProfile {
  id: string;
  role: OrganizerRole;
  display_name: string | null;
}

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  profile: OrganizerProfile | null;
  loading: boolean;
  isAdmin: boolean;
  isStaff: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async (uid: string) => {
    const { data, error } = await supabase
      .from("organizer_profiles")
      .select("id, role, display_name")
      .eq("id", uid)
      .maybeSingle();
    if (error || !data) {
      setProfile(null);
    } else {
      setProfile(data as OrganizerProfile);
    }
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const s = data.session;
      setSession(s);
      setUser(s?.user ?? null);
      if (s?.user) {
        fetchProfile(s.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, s) => {
        setSession(s);
        setUser(s?.user ?? null);
        if (s?.user) {
          fetchProfile(s.user.id);
        } else {
          setProfile(null);
        }
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = useCallback(
    async (email: string, password: string): Promise<{ error: string | null }> => {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        return { error: error.message };
      }
      if (data.user) {
        await fetchProfile(data.user.id);
        // If user is not an organizer, sign them out immediately
        const { data: profileData } = await supabase
          .from("organizer_profiles")
          .select("id")
          .eq("id", data.user.id)
          .maybeSingle();
        if (!profileData) {
          await supabase.auth.signOut();
          return { error: "You do not have organizer access." };
        }
      }
      return { error: null };
    },
    [fetchProfile]
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
  }, []);

  const isAdmin = profile?.role === "admin";
  const isStaff = profile?.role === "admin" || profile?.role === "checkin_staff";

  return (
    <AuthContext.Provider
      value={{ user, session, profile, loading, isAdmin, isStaff, signIn, signOut }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
