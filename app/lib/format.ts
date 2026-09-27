import type { RideStatus } from '@/lib/types';

export const eur = (n: number | string | null | undefined) =>
  `${Number(n ?? 0).toFixed(2).replace('.', ',')} €`;

export const km = (n: number | string) => `${Number(n).toFixed(1).replace('.', ',')} km`;

export function dateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' }) +
    ' · ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(iso: string): string {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'à l\'instant';
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return shortDate(iso);
}

export const RIDE_STATUS_LABEL: Record<RideStatus, string> = {
  awaiting_payment: 'Paiement en attente',
  searching: 'Recherche d\'un chauffeur…',
  accepted: 'Chauffeur en route',
  pickup: 'Chauffeur arrivé',
  in_progress: 'En route',
  ended: 'Arrivé·e — à confirmer',
  confirmed: 'Terminée',
  cancelled: 'Annulée',
  passenger_absent: 'Passager absent',
  expired: 'Aucun chauffeur trouvé',
};

export const ACTIVE_STATUSES: RideStatus[] = ['searching', 'accepted', 'pickup', 'in_progress', 'ended'];
