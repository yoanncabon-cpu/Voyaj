// vehicle-save — Enregistre le véhicule du chauffeur (un seul au MVP).
// Une fois validé par l'admin (locked), il ne peut plus être modifié ici.
//
// Entrée : { make, model, plate, color?, vehicleType, seats }
import { adminClient, assertNotSuspended, badRequest, conflict, getProfile, int, requireUser, serve, str } from '../_shared/http.ts';
import { audit } from '../_shared/domain.ts';

const TYPES = ['citadine', 'berline', 'suv', 'break', 'utilitaire'];
// Format SIV (AA-123-AA) ou ancien FNI (1234 AB 56).
const PLATE = /^([A-Z]{2}-?\d{3}-?[A-Z]{2}|\d{1,4}\s?[A-Z]{1,3}\s?\d{2,3})$/;

serve(async (req, body) => {
  const user = await requireUser(req);
  const make = str(body.make, 'Marque', 2, 40);
  const model = str(body.model, 'Modèle', 1, 40);
  const color = typeof body.color === 'string' ? body.color.trim().slice(0, 30) || null : null;
  const vehicleType = String(body.vehicleType ?? '');
  if (!TYPES.includes(vehicleType)) throw badRequest('Type de véhicule invalide');
  const seats = int(body.seats, 'Places', 1, 7);
  const rawPlate = str(body.plate, 'Plaque', 5, 12).toUpperCase();
  if (!PLATE.test(rawPlate)) throw badRequest('Plaque invalide (format AB-123-CD)');
  const plate = /^[A-Z]{2}-?\d{3}-?[A-Z]{2}$/.test(rawPlate)
    ? `${rawPlate.slice(0, 2)}-${rawPlate.replace(/-/g, '').slice(2, 5)}-${rawPlate.replace(/-/g, '').slice(5)}`
    : rawPlate.replace(/\s+/g, ' ');

  const db = adminClient();
  assertNotSuspended(await getProfile(db, user.id));

  const { data: existing } = await db.from('vehicles').select('locked').eq('owner_id', user.id).maybeSingle();
  if (existing?.locked) throw conflict('Véhicule validé : contactez le support pour le modifier');

  const { error } = await db.from('vehicles').upsert({
    owner_id: user.id, make, model, plate, color, vehicle_type: vehicleType, seats,
  });
  if (error?.code === '23505') throw conflict('Cette plaque est déjà enregistrée sur un autre compte');
  if (error) throw error;

  await db.from('profiles').update({ is_driver: true }).eq('id', user.id);
  await audit(db, { action: 'vehicle.saved', actorId: user.id, entityType: 'user', entityId: user.id, metadata: { plate, vehicleType } });
  return { success: true, plate };
});
