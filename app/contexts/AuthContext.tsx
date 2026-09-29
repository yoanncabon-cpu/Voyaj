import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { registerForPush, unregisterPush } from '@/lib/notifications';
import type { Profile } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  userId: string | null;
  profile: Profile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<string | null>;
  signUp: (email: string, password: string, name: string, phone: string) => Promise<{ error: string | null; needsConfirmation: boolean }>;
  resetPassword: (email: string) => Promise<string | null>;
  confirmPasswordReset: (email: string, code: string, newPassword: string) => Promise<string | null>;
  verifySignup: (email: string, code: string) => Promise<string | null>;
  resendSignupCode: (email: string) => Promise<string | null>;
  changePassword: (newPassword: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  updateProfile: (fields: Partial<Pick<Profile, 'name' | 'phone' | 'avatar_url' | 'bio' | 'terms_accepted_at'>>) => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async (uid: string) => {
    const { data } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
    setProfile((data as Profile) ?? null);
  }, []);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      if (next?.user) {
        loadProfile(next.user.id);
        registerForPush(next.user.id).catch(() => {});
      } else {
        setProfile(null);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  // Le profil (note, points, vérification) est modifié par le serveur :
  // on l'écoute en temps réel pour que l'app reste à jour.
  const userId = session?.user?.id ?? null;
  useEffect(() => {
    if (!userId) return;
    const channel = supabase
      .channel(`profile-${userId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
        (payload) => setProfile(payload.new as Profile))
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (userId) await loadProfile(userId);
  }, [userId, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return error ? authError(error.message) : null;
  }, []);

  const signUp = useCallback(async (email: string, password: string, name: string, phone: string) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { name: name.trim(), phone: phone.trim() } },
    });
    if (error) return { error: authError(error.message), needsConfirmation: false };
    // E-mail déjà inscrit : Supabase répond « succès » sans rien envoyer, avec un utilisateur sans identité.
    if (data.user && data.user.identities?.length === 0) {
      return { error: 'Un compte existe déjà avec cet e-mail. Connectez-vous ou utilisez « Mot de passe oublié ».', needsConfirmation: false };
    }
    return { error: null, needsConfirmation: !data.session };
  }, []);

  // Les e-mails contiennent un code à saisir dans l'app : pas de lien à ouvrir, donc pas de redirection à configurer.
  const resetPassword = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim().toLowerCase());
    return error ? authError(error.message) : null;
  }, []);

  const confirmPasswordReset = useCallback(async (email: string, code: string, newPassword: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'recovery' });
    if (error) return authError(error.message);
    const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
    return updateError ? authError(updateError.message) : null;
  }, []);

  const verifySignup = useCallback(async (email: string, code: string) => {
    const { error } = await supabase.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email' });
    return error ? authError(error.message) : null;
  }, []);

  const resendSignupCode = useCallback(async (email: string) => {
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim().toLowerCase() });
    return error ? authError(error.message) : null;
  }, []);

  const changePassword = useCallback(async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return error ? authError(error.message) : null;
  }, []);

  const signOut = useCallback(async () => {
    await unregisterPush();
    await supabase.auth.signOut();
  }, []);

  const updateProfile = useCallback<AuthContextValue['updateProfile']>(async (fields) => {
    if (!userId) return 'Session expirée, reconnectez-vous.';
    const { error } = await supabase.from('profiles').update(fields).eq('id', userId);
    if (error) return error.code === '23505' ? 'Ce numéro est déjà utilisé' : error.message;
    await loadProfile(userId);
    return null;
  }, [userId, loadProfile]);

  const value = useMemo<AuthContextValue>(() => ({
    session, userId, profile, loading, refreshProfile, signIn, signUp, resetPassword, confirmPasswordReset,
    verifySignup, resendSignupCode, changePassword, signOut, updateProfile,
  }), [session, userId, profile, loading, refreshProfile, signIn, signUp, resetPassword, confirmPasswordReset,
    verifySignup, resendSignupCode, changePassword, signOut, updateProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans AuthProvider');
  return ctx;
}

function authError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'E-mail ou mot de passe incorrect';
  if (m.includes('already registered')) return 'Un compte existe déjà avec cet e-mail';
  if (m.includes('email not confirmed')) return 'Confirmez votre e-mail avant de vous connecter';
  if (m.includes('password') && m.includes('characters')) return 'Mot de passe trop court (8 caractères minimum)';
  if (m.includes('database error saving new user')) return 'Ce numéro de téléphone est déjà associé à un compte';
  if (m.includes('expired') || (m.includes('invalid') && m.includes('token'))) return 'Code incorrect ou expiré. Demandez-en un nouveau.';
  if (m.includes('different from the old')) return "Choisissez un mot de passe différent de l'ancien";
  if (m.includes('weak') || m.includes('pwned')) return 'Mot de passe trop facile à deviner, choisissez-en un autre';
  if (m.includes('for security purposes')) return 'Patientez quelques secondes avant de redemander un code';
  if (m.includes('rate limit')) return 'Trop de tentatives, réessayez dans quelques minutes';
  if (m.includes('network')) return 'Connexion impossible. Vérifiez votre réseau.';
  return message;
}
