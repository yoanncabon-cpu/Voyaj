// Utilitaires HTTP communs aux Edge Functions Voyaj.
import { createClient, type SupabaseClient, type User } from 'jsr:@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET');

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

/** Erreur métier renvoyée telle quelle au client (message en français). */
export class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

export const badRequest = (msg: string) => new HttpError(400, 'invalid_argument', msg);
export const forbidden = (msg = 'Action non autorisée') => new HttpError(403, 'permission_denied', msg);
export const notFound = (msg = 'Introuvable') => new HttpError(404, 'not_found', msg);
export const conflict = (msg: string) => new HttpError(409, 'failed_precondition', msg);

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/** Client service_role : contourne la RLS. Réservé au code serveur. */
export function adminClient(): SupabaseClient {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } });
}

/** Vérifie le JWT de l'appelant et renvoie l'utilisateur. */
export async function requireUser(req: Request): Promise<User> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) throw new HttpError(401, 'unauthenticated', 'Connexion requise');
  const client = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) throw new HttpError(401, 'unauthenticated', 'Session expirée');
  return data.user;
}

/** Appels internes (déclencheurs base, cron) : secret partagé, comparaison à temps constant. */
export function requireWebhookSecret(req: Request): void {
  const got = req.headers.get('x-webhook-secret') ?? '';
  const expected = WEBHOOK_SECRET ?? '';
  let ok = got.length > 0 && got.length === expected.length;
  if (ok) {
    let diff = 0;
    for (let i = 0; i < got.length; i++) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
    ok = diff === 0;
  }
  if (!ok) throw new HttpError(401, 'unauthorized', 'unauthorized');
}

/**
 * Enveloppe standard : CORS, JSON, gestion des erreurs.
 * Le handler reçoit le corps JSON déjà parsé.
 */
// deno-lint-ignore no-explicit-any
export function serve(handler: (req: Request, body: any) => Promise<unknown>): void {
  Deno.serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
    try {
      let body: unknown = {};
      if (req.method === 'POST') {
        const text = await req.text();
        body = text ? JSON.parse(text) : {};
      }
      const result = await handler(req, body);
      return result instanceof Response ? result : json(result ?? { success: true });
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.code, message: e.message }, e.status);
      if (e instanceof SyntaxError) return json({ error: 'invalid_json', message: 'JSON invalide' }, 400);
      console.error(e);
      return json({ error: 'internal', message: 'Erreur interne, réessayez.' }, 500);
    }
  });
}

// deno-lint-ignore no-explicit-any
export type Row = Record<string, any>;

/** Charge un profil (service_role) ou lève 404. */
export async function getProfile(db: SupabaseClient, id: string): Promise<Row> {
  const { data, error } = await db.from('profiles').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  if (!data || data.deleted_at) throw notFound('Utilisateur introuvable');
  return data;
}

export function assertNotSuspended(profile: Row): void {
  if (profile.is_suspended) throw forbidden('Compte suspendu. Contactez le support.');
}

export function num(v: unknown, name: string, min?: number, max?: number): number {
  const n = typeof v === 'string' ? Number(v) : v;
  if (typeof n !== 'number' || !Number.isFinite(n)) throw badRequest(`${name} invalide`);
  if (min != null && n < min) throw badRequest(`${name} doit être ≥ ${min}`);
  if (max != null && n > max) throw badRequest(`${name} doit être ≤ ${max}`);
  return n;
}

export function int(v: unknown, name: string, min: number, max: number): number {
  const n = num(v, name, min, max);
  if (!Number.isInteger(n)) throw badRequest(`${name} doit être un entier`);
  return n;
}

export function str(v: unknown, name: string, min = 1, max = 500): string {
  if (typeof v !== 'string') throw badRequest(`${name} requis`);
  const s = v.trim();
  if (s.length < min || s.length > max) throw badRequest(`${name} : ${min} à ${max} caractères`);
  return s;
}

export function uuid(v: unknown, name: string): string {
  if (typeof v !== 'string' || !/^[0-9a-f-]{36}$/i.test(v)) throw badRequest(`${name} invalide`);
  return v;
}

export interface Place {
  lat: number;
  lng: number;
  address: string;
}

export function place(v: unknown, name: string): Place {
  const o = (v ?? {}) as Row;
  return {
    lat: num(o.lat, `${name}.lat`, -90, 90),
    lng: num(o.lng, `${name}.lng`, -180, 180),
    address: str(o.address, `${name}.address`, 2, 300),
  };
}
