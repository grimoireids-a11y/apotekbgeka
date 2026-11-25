import { getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  getAuth,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const storage = getStorage(app);
export const FIREBASE_VAULT_CONTEXT = `${firebaseConfig.projectId}:${firebaseConfig.firestoreDatabaseId}`;
export const STAFF_AUTH_EMAIL_DOMAIN = 'staff.obgyn-pms.app';
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export function usernameToStaffAuthEmail(usernameOrEmail: string): string {
  const norm = usernameOrEmail.trim().toLowerCase();
  if (norm.includes('@')) return norm;
  return `${norm}@${STAFF_AUTH_EMAIL_DOMAIN}`;
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write'
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid ?? null,
      email: auth.currentUser?.email ?? null,
      emailVerified: auth.currentUser?.emailVerified ?? null,
      isAnonymous: auth.currentUser?.isAnonymous ?? null,
      tenantId: auth.currentUser?.tenantId ?? null,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email
        })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export async function testConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
      return false;
    }
    // Permission denied on default-deny test/connection confirms Firestore endpoint is reachable
    return true;
  }
}

export async function signInWithGoogleFirebase() {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmailPasswordFirebase(email: string, password: string) {
  return signInWithEmailAndPassword(auth, email, password);
}

/**
 * Creates (or links existing) a Firebase Auth Email/Password user using a secondary
 * Firebase App instance so the currently signed-in Super Admin session is never disrupted.
 */
export async function provisionFirebaseEmailPasswordUser(
  usernameOrEmail: string,
  password: string
): Promise<{ uid: string; authEmail: string; alreadyExisted?: boolean }> {
  const authEmail = usernameToStaffAuthEmail(usernameOrEmail);
  const secondaryName = 'obgyn-staff-provisioner';
  const secondaryApp =
    getApps().find((a) => a.name === secondaryName) || initializeApp(firebaseConfig, secondaryName);
  const secondaryAuth = getAuth(secondaryApp);

  try {
    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, authEmail, password);
      return { uid: cred.user.uid, authEmail };
    } catch (err: unknown) {
      const code =
        typeof err === 'object' && err !== null && 'code' in err
          ? String((err as { code?: unknown }).code || '')
          : '';
      if (code === 'auth/email-already-in-use') {
        const existingCred = await signInWithEmailAndPassword(secondaryAuth, authEmail, password);
        return { uid: existingCred.user.uid, authEmail, alreadyExisted: true };
      }
      throw err;
    }
  } finally {
    try {
      await signOut(secondaryAuth);
    } catch {
      // Ignore cleanup errors
    }
  }
}

export async function signOutFirebase() {
  return signOut(auth);
}

// Run startup connectivity probe
void testConnection();
