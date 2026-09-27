import { onCall } from 'firebase-functions/v2/https';
import { FieldValue } from 'firebase-admin/firestore';
import { db } from '../shared/admin';
import { unauthenticated, invalidArgument } from '../shared/errors';
import { writeAudit } from '../shared/audit';

type VehicleType = 'citadine' | 'berline' | 'suv' | 'break' | 'utilitaire';

interface SaveVehicleParams {
  make: string;
  model: string;
  plate: string;
  vehicleType: VehicleType;
  seats: number;
}

const VALID_TYPES: VehicleType[] = ['citadine', 'berline', 'suv', 'break', 'utilitaire'];

/**
 * Callable : enregistre ou met à jour le véhicule d'un chauffeur.
 * Un seul véhicule par compte au MVP.
 */
export const saveVehicle = onCall(
  { region: 'europe-west1', enforceAppCheck: true },
  async (request) => {
    if (!request.auth) throw unauthenticated();

    const uid = request.auth.uid;
    const { make, model, plate, vehicleType, seats } =
      request.data as SaveVehicleParams;

    if (!make?.trim()) throw invalidArgument('make requis');
    if (!model?.trim()) throw invalidArgument('model requis');
    if (!plate?.trim()) throw invalidArgument('plate requis');
    if (!VALID_TYPES.includes(vehicleType)) {
      throw invalidArgument(`vehicleType doit être parmi : ${VALID_TYPES.join(', ')}`);
    }
    if (!seats || seats < 1 || seats > 7) {
      throw invalidArgument('seats doit être entre 1 et 7');
    }

    // Normaliser la plaque (majuscules, sans espaces)
    const normalizedPlate = plate.trim().toUpperCase().replace(/\s/g, '');

    const now = FieldValue.serverTimestamp();
    const vehicleData = {
      make: make.trim(),
      model: model.trim(),
      plate: normalizedPlate,
      vehicleType,
      seats,
      updatedAt: now,
    };

    // Upsert dans /users/{uid}/vehicles/{uid} (1 véhicule par compte)
    await db.collection('users').doc(uid)
      .collection('vehicles').doc(uid)
      .set(vehicleData, { merge: true });

    // Mettre à jour le résumé sur le profil principal
    await db.collection('users').doc(uid).update({
      vehicleDescription: `${make.trim()} ${model.trim()} — ${normalizedPlate}`,
      vehicleType,
      vehicleSeats: seats,
      updatedAt: now,
    });

    await writeAudit({
      action: 'admin.action',
      actorId: uid,
      entityType: 'user',
      entityId: uid,
      metadata: { event: 'vehicle_saved', vehicleType, plate: normalizedPlate },
    });

    return { success: true };
  },
);
