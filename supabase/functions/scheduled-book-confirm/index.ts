// scheduled-book-confirm — Après la PaymentSheet : vérifie le paiement chez
// Stripe et confirme la réservation. Aussi appelé par le webhook Stripe
// (payment_intent.succeeded) si l'app a été fermée entre-temps.
//
// Entrée : { bookingId }
import { adminClient, conflict, forbidden, notFound, requireUser, serve, uuid } from '../_shared/http.ts';
import { confirmBooking } from '../_shared/bookings.ts';

serve(async (req, body) => {
  const user = await requireUser(req);
  const bookingId = uuid(body.bookingId, 'bookingId');
  const db = adminClient();

  const { data: booking } = await db.from('bookings').select('*').eq('id', bookingId).maybeSingle();
  if (!booking) throw notFound('Réservation introuvable');
  if (booking.passenger_id !== user.id) throw forbidden();
  if (booking.status === 'confirmed') return { status: 'confirmed', pickupCode: booking.pickup_code };
  if (booking.status !== 'pending_payment') throw conflict('Réservation expirée, recommencez');

  const ok = await confirmBooking(db, booking);
  if (!ok) throw conflict('Paiement non abouti. Vérifiez votre carte.');
  return { status: 'confirmed', pickupCode: booking.pickup_code };
});
