// Briques métier partagées : journal, points, tarifs, itinéraire.
import type { SupabaseClient } from 'jsr:@supabase/supabase-js@2';
import { DEFAULT_CONFIG, DEFAULT_CONSUMPTION, haversineKm, type PricingConfig, round2 } from './pricing.ts';

export async function audit(db: SupabaseClient, entry: {
  action: string;
  actorId: string | null;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  const { error } = await db.from('audit_logs').insert({
    action: entry.action,
    actor_id: entry.actorId,
    entity_type: entry.entityType,
    entity_id: entry.entityId,
    metadata: entry.metadata ?? null,
  });
  if (error) console.error('audit', error);
}

/** Barème de points Voyaj. */
export const POINTS = {
  rideCompletedPassenger: 10,
  rideCompletedDriver: 20,
  ratingSubmitted: 5,
} as const;

export async function awardPoints(db: SupabaseClient, userId: string, points: number, reason: string, entityId: string) {
  if (points <= 0) return;
  // Idempotent : une même raison ne rapporte qu'une fois par entité.
  const { data: existing } = await db.from('points_transactions')
    .select('id').eq('user_id', userId).eq('reason', reason).eq('entity_id', entityId).maybeSingle();
  if (existing) return;
  await db.from('points_transactions').insert({ user_id: userId, points, reason, entity_id: entityId });
  await db.rpc('increment_points', { uid: userId, delta: points });
}

export async function loadPricing(db: SupabaseClient): Promise<{ config: PricingConfig; consumption: Record<string, number>; lateCancelPenaltyEur: number }> {
  const { data } = await db.from('pricing_config').select('*').eq('id', 1).maybeSingle();
  if (!data) return { config: DEFAULT_CONFIG, consumption: DEFAULT_CONSUMPTION, lateCancelPenaltyEur: 5 };
  return {
    config: {
      fuelPriceEurPerL: Number(data.fuel_price_eur_per_l),
      wearEurPerKm: Number(data.wear_eur_per_km),
      feeBaseEur: Number(data.fee_base_eur),
      feePerKmEur: Number(data.fee_per_km_eur),
      feeMaxEur: Number(data.fee_max_eur),
    },
    consumption: { ...DEFAULT_CONSUMPTION, ...(data.consumption ?? {}) },
    lateCancelPenaltyEur: Number(data.late_cancel_penalty_eur),
  };
}

const MAPBOX_TOKEN = Deno.env.get('MAPBOX_TOKEN');

/**
 * Distance routière (km). Mapbox Directions si MAPBOX_TOKEN est défini,
 * sinon estimation : vol d'oiseau × 1,3 (facteur routier moyen en France).
 */
export async function routeDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): Promise<number> {
  if (MAPBOX_TOKEN) {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${from.lng},${from.lat};${to.lng},${to.lat}` +
        `?overview=false&access_token=${MAPBOX_TOKEN}`;
      const resp = await fetch(url);
      if (resp.ok) {
        const data = await resp.json();
        const meters = data?.routes?.[0]?.distance;
        if (typeof meters === 'number' && meters > 0) return round2(meters / 1000);
      }
    } catch (e) {
      console.error('mapbox', e);
    }
  }
  return round2(Math.max(haversineKm(from.lat, from.lng, to.lat, to.lng) * 1.3, 0.5));
}
