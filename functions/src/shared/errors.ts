import { HttpsError } from 'firebase-functions/v2/https';

export function notFound(message = 'Not found'): HttpsError {
  return new HttpsError('not-found', message);
}

export function unauthenticated(message = 'Unauthenticated'): HttpsError {
  return new HttpsError('unauthenticated', message);
}

export function permissionDenied(message = 'Permission denied'): HttpsError {
  return new HttpsError('permission-denied', message);
}

export function invalidArgument(message: string): HttpsError {
  return new HttpsError('invalid-argument', message);
}

export function failedPrecondition(message: string): HttpsError {
  return new HttpsError('failed-precondition', message);
}

export function internal(message = 'Internal error'): HttpsError {
  return new HttpsError('internal', message);
}

export function alreadyExists(message: string): HttpsError {
  return new HttpsError('already-exists', message);
}
