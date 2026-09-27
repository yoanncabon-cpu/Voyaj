import * as admin from 'firebase-admin';

// Initialiser l'app une seule fois
if (!admin.apps.length) {
  admin.initializeApp();
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();
export const messaging = admin.messaging();

// Région par défaut pour les Cloud Tasks
export const REGION = 'europe-west1';
export const PROJECT_ID = process.env.GCLOUD_PROJECT ?? '';
