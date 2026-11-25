import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  setDoc,
  writeBatch
} from 'firebase/firestore';
import {
  auth,
  db,
  FIREBASE_VAULT_CONTEXT,
  handleFirestoreError,
  OperationType,
  signInWithGoogleFirebase,
  signOutFirebase
} from '../lib/firebase';
import type {
  AuditLog,
  CollectionName,
  NavView,
  NotificationItem,
  PracticeDatabase,
  PracticeSettings,
  RoleCode,
  SystemSettings,
  UserAccount
} from '../types/models';
import {
  buildIsolatedDemoDataset,
  createDefaultPracticeSettings,
  createDefaultSystemSettings,
  createEmptyDatabase
} from '../data/defaults';
import {
  decryptRecordFields,
  deriveUserKek,
  encryptRecordFields,
  generateVaultKey,
  unwrapVaultKeyForAccount,
  wrapVaultKeyForAccount
} from '../utils/cryptoE2EE';
import { hasPermission } from '../utils/rbac';

const PATIENT_SENSITIVE_FIELDS = ['nik', 'phone', 'email', 'address', 'familyPhone', 'emergencyContact', 'allergies'];
const RME_SENSITIVE_FIELDS = ['doctorNotes'];
const BOOTSTRAP_SUPERADMIN_EMAIL = 'grimoireids@gmail.com';
const CLOUD_VAULT_SALT_B64 = 'b2JneW4tc3BvZy1jbG91ZC1lMmVlLXNhbHQtdjE=';

const NEWEST_FIRST_COLLECTIONS = new Set<CollectionName>([
  'patients',
  'visits',
  'queues',
  'medical_records',
  'medical_record_versions',
  'pregnancies',
  'antenatal_visits',
  'ultrasound_records',
  'diagnoses',
  'procedures',
  'prescriptions',
  'laboratory_orders',
  'laboratory_results',
  'invoices',
  'invoice_items',
  'payments',
  'refunds',
  'cash_sessions',
  'cash_transactions',
  'expenses',
  'appointments',
  'documents',
  'notifications',
  'audit_logs',
  'backups'
]);

const CODE_SORTED_COLLECTIONS = new Set<CollectionName>(['services', 'medicines', 'icd10_codes']);

const COLLECTION_LIMITS: Record<CollectionName, number> = {
  users: 500,
  roles: 100,
  permissions: 200,
  practice_settings: 20,
  patients: 1000,
  patient_contacts: 1000,
  visits: 1000,
  queues: 1000,
  medical_records: 1000,
  medical_record_versions: 1000,
  pregnancies: 1000,
  antenatal_visits: 1000,
  ultrasound_records: 1000,
  diagnoses: 1000,
  icd10_codes: 1000,
  procedures: 1000,
  services: 500,
  medicines: 1000,
  prescriptions: 1000,
  laboratory_orders: 1000,
  laboratory_results: 1000,
  invoices: 1000,
  invoice_items: 1000,
  payments: 1000,
  refunds: 500,
  cash_sessions: 500,
  cash_transactions: 1000,
  expenses: 1000,
  appointments: 1000,
  documents: 1000,
  notifications: 500,
  audit_logs: 1000,
  system_settings: 20,
  integrations: 100,
  backups: 200
};

const ALL_COLLECTIONS = Object.keys(COLLECTION_LIMITS) as CollectionName[];

const SINGLETON_OR_CORE_CONFIG_COLLECTIONS = new Set<CollectionName>([
  'practice_settings',
  'system_settings',
  'roles',
  'permissions'
]);

const MASTER_SEED_COLLECTIONS: CollectionName[] = [
  'practice_settings',
  'system_settings',
  'roles',
  'permissions',
  'services',
  'icd10_codes',
  'medicines',
  'integrations'
];

function getAllowedCollectionsForRole(role: RoleCode): CollectionName[] {
  if (role === 'SUPER_ADMIN') return ALL_COLLECTIONS;
  if (role === 'DOKTER_SPOG') {
    const excluded = new Set<CollectionName>([
      'users',
      'audit_logs',
      'integrations',
      'backups',
      'refunds',
      'cash_sessions',
      'cash_transactions',
      'expenses'
    ]);
    return ALL_COLLECTIONS.filter((c) => !excluded.has(c));
  }
  // ASISTEN_DOKTER
  const excluded = new Set<CollectionName>([
    'users',
    'audit_logs',
    'integrations',
    'backups',
    'medical_record_versions'
  ]);
  return ALL_COLLECTIONS.filter((c) => !excluded.has(c));
}

/**
 * Recursively strips all `undefined` fields so Cloud Firestore `setDoc` never rejects payloads.
 */
function stripUndefinedDeep<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    return value
      .filter((item) => item !== undefined)
      .map((item) => stripUndefinedDeep(item)) as unknown as T;
  }
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = stripUndefinedDeep(v);
      }
    }
    return out as T;
  }
  return value;
}

function buildStaffEmailDoc(user: UserAccount, actorId: string) {
  const emailLower = user.email.trim().toLowerCase();
  const nowIso = new Date().toISOString();
  return stripUndefinedDeep({
    id: emailLower,
    userId: user.id,
    email: emailLower,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    strNumber: user.strNumber || '',
    sipNumber: user.sipNumber || '',
    signatureUrl: user.signatureUrl || '',
    active: user.active,
    createdAt: user.createdAt || nowIso,
    createdBy: user.createdBy || actorId,
    updatedAt: nowIso,
    updatedBy: actorId
  });
}

async function commitBatchedOps(
  ops: Array<{ type: 'set'; col: string; id: string; data: Record<string, unknown> } | { type: 'delete'; col: string; id: string }>
) {
  const CHUNK_SIZE = 380;
  for (let i = 0; i < ops.length; i += CHUNK_SIZE) {
    const chunk = ops.slice(i, i + CHUNK_SIZE);
    const batch = writeBatch(db);
    for (const op of chunk) {
      const ref = doc(db, op.col, op.id);
      if (op.type === 'set') {
        batch.set(ref, stripUndefinedDeep(op.data));
      } else {
        batch.delete(ref);
      }
    }
    await batch.commit();
  }
}

function formatFirebaseAuthError(err: unknown): string {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code || '') : '';
  const msg = err instanceof Error ? err.message : String(err || '');
  if (code === 'auth/unauthorized-domain' || msg.includes('auth/unauthorized-domain')) {
    const host = typeof window !== 'undefined' ? window.location.hostname : 'domain aplikasi Anda';
    return `Domain "${host}" belum terdaftar di Authorized Domains Firebase Authentication. Tambahkan "${host}" di Firebase Console → Authentication → Settings → Authorized domains agar koneksi otomatis database online berjalan di domain ini.`;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return 'Jendela login Google ditutup sebelum proses autentikasi selesai.';
  }
  if (code === 'auth/popup-blocked') {
    return 'Popup login Google diblokir oleh peramban. Izinkan popup untuk situs ini lalu coba lagi.';
  }
  return msg || 'Gagal menghubungkan autentikasi Google Firebase.';
}

export interface ToastMessage {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  text: string;
}

export interface PrintPayload {
  type: 'kuitansi' | 'resep' | 'usg' | 'lab' | 'surat_keterangan' | 'surat_rujukan' | 'rme' | 'laporan';
  title: string;
  subtitle?: string;
  data: Record<string, unknown>;
}

interface PracticeContextValue {
  dbState: PracticeDatabase;
  currentUser: UserAccount | null;
  firebaseUser: FirebaseUser | null;
  authMode: 'none' | 'staff' | 'firebase';
  cloudSynced: boolean;
  loading: boolean;
  e2eeUnlocked: boolean;
  e2eeFingerprint: string;
  activeView: NavView;
  setActiveView: (view: NavView) => void;
  selectedPatientId: string | null;
  setSelectedPatientId: (id: string | null) => void;
  selectedVisitId: string | null;
  setSelectedVisitId: (id: string | null) => void;
  practice: PracticeSettings;
  systemSettings: SystemSettings;
  toasts: ToastMessage[];
  notifyToast: (text: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;
  printPayload: PrintPayload | null;
  setPrintPayload: (payload: PrintPayload | null) => void;
  loginStaff: (username: string, password: string) => Promise<void>;
  loginGoogleFirebase: () => Promise<void>;
  logout: () => Promise<void>;
  upsertRecord: <K extends CollectionName>(col: K, item: PracticeDatabase[K][number]) => Promise<void>;
  deleteRecord: (col: CollectionName, id: string) => Promise<void>;
  createStaffAccount: (payload: {
    username: string;
    password: string;
    displayName: string;
    email: string;
    role: RoleCode;
    strNumber?: string;
    sipNumber?: string;
    signatureUrl?: string;
  }) => Promise<void>;
  updateStaffAccount: (
    userId: string,
    payload: {
      username?: string;
      displayName?: string;
      email?: string;
      role?: RoleCode;
      active?: boolean;
      newPassword?: string;
      strNumber?: string;
      sipNumber?: string;
      signatureUrl?: string;
    }
  ) => Promise<void>;
  updateMySignature: (signatureUrl: string) => Promise<void>;
  deleteStaffAccount: (userId: string) => Promise<void>;
  pushNotification: (item: Omit<NotificationItem, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'read'>) => Promise<void>;
  loadDemoData: () => Promise<void>;
  clearDemoData: () => Promise<void>;
  restoreBackupData: (backup: Partial<PracticeDatabase>) => Promise<void>;
  can: (permissionKey: string) => boolean;
  refreshState: () => Promise<void>;
}

const PracticeContext = createContext<PracticeContextValue | null>(null);

export const PracticeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [dbState, setDbState] = useState<PracticeDatabase>(createEmptyDatabase());
  const [currentUser, setCurrentUser] = useState<UserAccount | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [authMode, setAuthMode] = useState<'none' | 'staff' | 'firebase'>('none');
  const [cloudSynced, setCloudSynced] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [e2eeUnlocked, setE2eeUnlocked] = useState<boolean>(false);
  const [e2eeFingerprint, setE2eeFingerprint] = useState<string>('');
  const [activeView, setActiveView] = useState<NavView>('dashboard');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedVisitId, setSelectedVisitId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [printPayload, setPrintPayload] = useState<PrintPayload | null>(null);

  // Kept strictly in React memory (never localStorage) for security
  const bearerTokenRef = useRef<string | null>(null);
  const vaultKeyRef = useRef<CryptoKey | null>(null);
  const authModeRef = useRef<'none' | 'staff' | 'firebase'>('none');
  const dbStateRef = useRef<PracticeDatabase>(dbState);
  const seededUidRef = useRef<string | null>(null);

  useEffect(() => {
    authModeRef.current = authMode;
  }, [authMode]);

  useEffect(() => {
    dbStateRef.current = dbState;
  }, [dbState]);

  const notifyToast = useCallback((text: string, type: ToastMessage['type'] = 'success') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, type, text }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const decryptDatabaseState = useCallback(async (raw: PracticeDatabase, key: CryptoKey | null): Promise<PracticeDatabase> => {
    if (!key) return raw;
    const decryptedPatients = await Promise.all(
      raw.patients.map((p) => decryptRecordFields(p as unknown as Record<string, unknown>, key))
    );
    const decryptedRme = await Promise.all(
      raw.medical_records.map((r) => decryptRecordFields(r as unknown as Record<string, unknown>, key))
    );
    return {
      ...raw,
      patients: decryptedPatients as unknown as PracticeDatabase['patients'],
      medical_records: decryptedRme as unknown as PracticeDatabase['medical_records']
    };
  }, []);

  const fetchStaffStoreState = useCallback(async () => {
    if (!bearerTokenRef.current) return;
    const res = await fetch('/api/store/state', {
      headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
    });
    if (!res.ok) {
      throw new Error('Gagal memuat data praktik dari server.');
    }
    const raw = (await res.json()) as PracticeDatabase;
    const decrypted = await decryptDatabaseState(raw, vaultKeyRef.current);
    setDbState(decrypted);
  }, [decryptDatabaseState]);

  const writeCloudAuditLog = useCallback(
    async (
      actor: UserAccount,
      action: string,
      entity: string,
      entityId?: string,
      beforeData?: string,
      afterData?: string
    ) => {
      if (!auth.currentUser) return;
      const nowIso = new Date().toISOString();
      const logId = `aud-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const entry: AuditLog = {
        id: logId,
        userId: actor.id,
        userName: actor.displayName,
        role: actor.role,
        action,
        entity,
        entityId,
        beforeData: beforeData ? beforeData.slice(0, 260) : undefined,
        afterData: afterData ? afterData.slice(0, 260) : undefined,
        deviceInfo: typeof navigator !== 'undefined' ? navigator.userAgent.slice(0, 120) : 'Web Client',
        createdAt: nowIso
      };
      try {
        await setDoc(doc(db, 'audit_logs', logId), stripUndefinedDeep(entry));
      } catch {
        // Non-blocking audit mirror failure
      }
    },
    []
  );

  const ensureCloudBaselineSeeded = useCallback(
    async (fbUser: FirebaseUser, profile: UserAccount, sourceState?: PracticeDatabase) => {
      if (profile.role !== 'SUPER_ADMIN') return;
      if (seededUidRef.current === fbUser.uid) return;
      seededUidRef.current = fbUser.uid;
      try {
        const snap = await getDocs(query(collection(db, 'practice_settings'), limit(1)));
        const baseline = sourceState || createEmptyDatabase();
        const nowIso = new Date().toISOString();
        const ops: Array<{ type: 'set'; col: string; id: string; data: Record<string, unknown> }> = [];

        if (snap.empty) {
          for (const colName of MASTER_SEED_COLLECTIONS) {
            const list = baseline[colName] as unknown as Record<string, unknown>[];
            for (const item of list) {
              const docId = String(item.id);
              ops.push({
                type: 'set',
                col: colName,
                id: docId,
                data: {
                  ...item,
                  id: docId,
                  createdAt: String(item.createdAt || nowIso),
                  createdBy: String(item.createdBy || fbUser.uid),
                  updatedAt: String(item.updatedAt || nowIso),
                  updatedBy: String(item.updatedBy || fbUser.uid)
                }
              });
            }
          }
        }

        // Always ensure current Super Admin user doc & staff_emails lookup exist in Cloud Firestore
        const adminDoc: UserAccount = {
          ...profile,
          id: fbUser.uid,
          updatedAt: nowIso,
          updatedBy: fbUser.uid,
          lastLoginAt: nowIso
        };
        const existingUserDoc = await getDoc(doc(db, 'users', fbUser.uid));
        if (!existingUserDoc.exists()) {
          ops.push({
            type: 'set',
            col: 'users',
            id: fbUser.uid,
            data: adminDoc as unknown as Record<string, unknown>
          });
        }
        if (adminDoc.email) {
          const emailLower = adminDoc.email.trim().toLowerCase();
          const existingEmailDoc = await getDoc(doc(db, 'staff_emails', emailLower));
          if (!existingEmailDoc.exists()) {
            ops.push({
              type: 'set',
              col: 'staff_emails',
              id: emailLower,
              data: buildStaffEmailDoc(adminDoc, fbUser.uid)
            });
          }
        }

        if (ops.length > 0) {
          await commitBatchedOps(ops);
        }
      } catch (err) {
        seededUidRef.current = null;
        console.warn('Cloud baseline seed skipped or partial:', err);
      }
    },
    []
  );

  const resolveFirebaseStaffProfile = useCallback(async (fbUser: FirebaseUser): Promise<UserAccount> => {
    const emailLower = (fbUser.email || '').trim().toLowerCase();
    const isBootstrappedAdmin = emailLower === BOOTSTRAP_SUPERADMIN_EMAIL;
    const nowIso = new Date().toISOString();

    let uidData: Partial<UserAccount> | null = null;
    let emailData: Partial<UserAccount> | null = null;

    try {
      const uidSnap = await getDoc(doc(db, 'users', fbUser.uid));
      if (uidSnap.exists()) {
        uidData = uidSnap.data() as Partial<UserAccount>;
      }
    } catch {
      // Ignore if not yet provisioned by UID
    }

    if (emailLower) {
      try {
        const emailSnap = await getDoc(doc(db, 'staff_emails', emailLower));
        if (emailSnap.exists()) {
          emailData = emailSnap.data() as Partial<UserAccount>;
        }
      } catch {
        // Ignore if not provisioned by email
      }
    }

    const matched = uidData || emailData;
    if (!isBootstrappedAdmin && !matched) {
      await signOutFirebase();
      throw new Error(
        `Email Google (${fbUser.email}) belum terdaftar sebagai staf praktik. Minta Super Admin menambahkan email Anda di Manajemen Pengguna.`
      );
    }
    if (!isBootstrappedAdmin && matched && matched.active === false) {
      await signOutFirebase();
      throw new Error('Akun Anda sedang dinonaktifkan oleh Super Admin.');
    }

    return {
      id: fbUser.uid,
      username: matched?.username || emailLower || fbUser.uid,
      displayName: matched?.displayName || fbUser.displayName || 'Pengguna Google',
      email: fbUser.email || matched?.email || '',
      role: isBootstrappedAdmin ? 'SUPER_ADMIN' : (matched?.role as RoleCode) || 'DOKTER_SPOG',
      strNumber: matched?.strNumber,
      sipNumber: matched?.sipNumber,
      signatureUrl: matched?.signatureUrl || '',
      active: true,
      createdAt: matched?.createdAt || nowIso,
      createdBy: matched?.createdBy || fbUser.uid,
      updatedAt: nowIso,
      updatedBy: fbUser.uid,
      lastLoginAt: nowIso
    };
  }, []);

  /**
   * Resolves a persistent Practice E2EE Vault Key stored in Cloud Firestore (`system_settings/main`)
   * so all staff sessions across AI Studio, Vercel, and browser reloads decrypt the exact same data.
   */
  const resolvePersistentCloudVaultKey = useCallback(async (fbUser: FirebaseUser, isSuperAdmin: boolean) => {
    const cloudKek = await deriveUserKek(`${FIREBASE_VAULT_CONTEXT}:obgyn-cloud-vault-v1`, CLOUD_VAULT_SALT_B64);
    try {
      const sysRef = doc(db, 'system_settings', 'main');
      const sysSnap = await getDoc(sysRef);
      if (sysSnap.exists()) {
        const sysData = sysSnap.data() as Partial<SystemSettings>;
        if (typeof sysData.e2eeCloudWrappedKey === 'string' && sysData.e2eeCloudWrappedKey.length > 0) {
          const unwrapped = await unwrapVaultKeyForAccount(sysData.e2eeCloudWrappedKey, cloudKek);
          vaultKeyRef.current = unwrapped.key;
          setE2eeFingerprint(unwrapped.fingerprint);
          setE2eeUnlocked(true);
          return unwrapped;
        }
        // System settings doc exists but does not yet have a persistent wrapped key -> create & save one if Super Admin
        const generated = await generateVaultKey();
        const wrapped = await wrapVaultKeyForAccount(generated.key, cloudKek);
        vaultKeyRef.current = generated.key;
        setE2eeFingerprint(generated.fingerprint);
        setE2eeUnlocked(true);
        if (isSuperAdmin) {
          const nowIso = new Date().toISOString();
          await setDoc(
            sysRef,
            stripUndefinedDeep({
              ...createDefaultSystemSettings(),
              ...sysData,
              id: 'main',
              e2eeKeyFingerprint: generated.fingerprint,
              e2eeCloudWrappedKey: wrapped,
              createdAt: sysData.createdAt || nowIso,
              createdBy: sysData.createdBy || fbUser.uid,
              updatedAt: nowIso,
              updatedBy: fbUser.uid
            })
          );
        }
        return { key: generated.key, fingerprint: generated.fingerprint };
      } else {
        // Brand-new database: create persistent vault key and save to system_settings/main if Super Admin
        const generated = await generateVaultKey();
        const wrapped = await wrapVaultKeyForAccount(generated.key, cloudKek);
        vaultKeyRef.current = generated.key;
        setE2eeFingerprint(generated.fingerprint);
        setE2eeUnlocked(true);
        if (isSuperAdmin) {
          const nowIso = new Date().toISOString();
          const defSys = createDefaultSystemSettings();
          await setDoc(
            sysRef,
            stripUndefinedDeep({
              ...defSys,
              id: 'main',
              e2eeKeyFingerprint: generated.fingerprint,
              e2eeCloudWrappedKey: wrapped,
              createdAt: nowIso,
              createdBy: fbUser.uid,
              updatedAt: nowIso,
              updatedBy: fbUser.uid
            })
          );
        }
        return { key: generated.key, fingerprint: generated.fingerprint };
      }
    } catch {
      const fallback = await generateVaultKey();
      vaultKeyRef.current = fallback.key;
      setE2eeFingerprint(fallback.fingerprint);
      setE2eeUnlocked(true);
      return { key: fallback.key, fingerprint: fallback.fingerprint };
    }
  }, []);

  // Listen to Firebase Auth state ONCE on mount
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && authModeRef.current === 'none') {
        try {
          const fbProfile = await resolveFirebaseStaffProfile(fbUser);
          const vault = await resolvePersistentCloudVaultKey(fbUser, fbProfile.role === 'SUPER_ADMIN');
          const hydratedProfile: UserAccount = {
            ...fbProfile,
            e2eeFingerprint: vault.fingerprint
          };
          setCurrentUser(hydratedProfile);
          setAuthMode('firebase');
          await ensureCloudBaselineSeeded(fbUser, hydratedProfile);
        } catch (err) {
          notifyToast(err instanceof Error ? err.message : 'Gagal memverifikasi akun Firebase.', 'error');
        }
      } else if (!fbUser) {
        setCloudSynced(false);
      }
      setLoading(false);
    });
    return () => unsub();
  }, [ensureCloudBaselineSeeded, notifyToast, resolveFirebaseStaffProfile, resolvePersistentCloudVaultKey]);

  // Subscribe to ALL role-permitted Cloud Firestore collections in real time whenever firebaseUser & currentUser are active
  const currentUserId = currentUser?.id || '';
  const currentUserRole = currentUser?.role || null;

  useEffect(() => {
    if (!firebaseUser || !currentUserRole) {
      setCloudSynced(false);
      return;
    }

    const allowedCols = getAllowedCollectionsForRole(currentUserRole);
    let activeCount = 0;

    const unsubs = allowedCols.map((colName) => {
      const colLimit = COLLECTION_LIMITS[colName] || 500;
      const colQuery = query(collection(db, colName), limit(colLimit));

      return onSnapshot(
        colQuery,
        async (snap) => {
          activeCount += 1;
          if (activeCount >= 1) {
            setCloudSynced(true);
          }
          const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as Record<string, unknown>[];
          let processed = docs;
          if ((colName === 'patients' || colName === 'medical_records') && vaultKeyRef.current) {
            processed = await Promise.all(
              docs.map((d) => decryptRecordFields(d, vaultKeyRef.current))
            );
          }
          if (NEWEST_FIRST_COLLECTIONS.has(colName)) {
            processed.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
          } else if (CODE_SORTED_COLLECTIONS.has(colName)) {
            processed.sort((a, b) => String(a.code || '').localeCompare(String(b.code || '')));
          }

          setDbState((prev) => {
            // Avoid wiping core singleton config docs if Firestore hasn't been seeded yet
            if (processed.length === 0 && SINGLETON_OR_CORE_CONFIG_COLLECTIONS.has(colName)) {
              return prev;
            }
            return { ...prev, [colName]: processed };
          });

          // Keep active user's profile/signature synced in real-time
          if (colName === 'users' && currentUserId) {
            const liveSelf = processed.find((u) => String(u.id) === currentUserId) as UserAccount | undefined;
            if (liveSelf) {
              setCurrentUser((prev) =>
                prev &&
                (prev.displayName !== liveSelf.displayName ||
                  prev.signatureUrl !== liveSelf.signatureUrl ||
                  prev.strNumber !== liveSelf.strNumber ||
                  prev.sipNumber !== liveSelf.sipNumber)
                  ? {
                      ...prev,
                      displayName: liveSelf.displayName,
                      signatureUrl: liveSelf.signatureUrl,
                      strNumber: liveSelf.strNumber,
                      sipNumber: liveSelf.sipNumber
                    }
                  : prev
              );
            }
          }
        },
        (error) => {
          try {
            handleFirestoreError(error, OperationType.LIST, colName);
          } catch {
            // Keep UI alive even if a specific collection is restricted by rules
          }
        }
      );
    });

    return () => {
      unsubs.forEach((u) => u());
    };
  }, [currentUserId, currentUserRole, firebaseUser]);

  const loginStaff = useCallback(
    async (username: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error(
          `Endpoint API autentikasi tidak merespons JSON (HTTP ${res.status}). Pastikan backend Serverless Function /api aktif pada deployment Vercel Anda.`
        );
      }
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

      bearerTokenRef.current = data.token;
      const user = data.user as UserAccount;

      if (user.e2eeSalt && user.e2eeWrappedKey) {
        const kek = await deriveUserKek(password, user.e2eeSalt);
        const unwrapped = await unwrapVaultKeyForAccount(user.e2eeWrappedKey, kek);
        vaultKeyRef.current = unwrapped.key;
        setE2eeFingerprint(unwrapped.fingerprint);
        setE2eeUnlocked(true);
      }

      setCurrentUser(user);
      setAuthMode('staff');
      setActiveView('dashboard');
      let hydratedState: PracticeDatabase | undefined;
      if (data.initialState) {
        const decrypted = await decryptDatabaseState(data.initialState as PracticeDatabase, vaultKeyRef.current);
        hydratedState = decrypted;
        setDbState(decrypted);
      } else {
        await fetchStaffStoreState();
      }
      // Automatically link & seed Cloud Firestore if a Firebase Auth session is already active in this browser
      if (auth.currentUser && user.role === 'SUPER_ADMIN') {
        void ensureCloudBaselineSeeded(auth.currentUser, user, hydratedState || dbStateRef.current);
      }
      notifyToast(`Selamat datang, ${user.displayName}. Vault E2EE terbuka.`, 'success');
    },
    [decryptDatabaseState, ensureCloudBaselineSeeded, fetchStaffStoreState, notifyToast]
  );

  const loginGoogleFirebase = useCallback(async () => {
    let fbUser: FirebaseUser;
    try {
      const result = await signInWithGoogleFirebase();
      fbUser = result.user;
    } catch (err) {
      throw new Error(formatFirebaseAuthError(err));
    }
    const profile = await resolveFirebaseStaffProfile(fbUser);
    const vault = await resolvePersistentCloudVaultKey(fbUser, profile.role === 'SUPER_ADMIN');

    const fullProfile: UserAccount = {
      ...profile,
      e2eeFingerprint: vault.fingerprint
    };
    setFirebaseUser(fbUser);
    setCurrentUser(fullProfile);
    setAuthMode('firebase');
    setActiveView('dashboard');
    await ensureCloudBaselineSeeded(fbUser, fullProfile);
    await writeCloudAuditLog(fullProfile, 'LOGIN_FIREBASE', 'auth', fbUser.uid, undefined, `Login Google Cloud Firestore (${fbUser.email})`);
    notifyToast(`Login berhasil sebagai ${fullProfile.displayName}. Seluruh data database online tersinkron real-time.`, 'success');
  }, [ensureCloudBaselineSeeded, notifyToast, resolveFirebaseStaffProfile, resolvePersistentCloudVaultKey, writeCloudAuditLog]);

  const logout = useCallback(async () => {
    if (authMode === 'staff' && bearerTokenRef.current) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    if (firebaseUser) {
      await signOutFirebase();
    }
    bearerTokenRef.current = null;
    vaultKeyRef.current = null;
    seededUidRef.current = null;
    setCurrentUser(null);
    setFirebaseUser(null);
    setCloudSynced(false);
    setAuthMode('none');
    setE2eeUnlocked(false);
    setE2eeFingerprint('');
    setDbState(createEmptyDatabase());
    setActiveView('dashboard');
    notifyToast('Anda telah keluar dan kunci enkripsi E2EE dihapus dari memori.', 'info');
  }, [authMode, firebaseUser, notifyToast]);

  const upsertRecord = useCallback(
    async <K extends CollectionName>(col: K, item: PracticeDatabase[K][number]) => {
      if (!currentUser) throw new Error('Pengguna belum login.');
      const nowIso = new Date().toISOString();
      const existingList = dbStateRef.current[col] as unknown as Record<string, unknown>[];
      const existingItem = existingList.find((x) => x.id === (item as unknown as Record<string, unknown>).id);

      const rawRecord: Record<string, unknown> = {
        ...(item as unknown as Record<string, unknown>),
        createdAt: String(existingItem?.createdAt || (item as unknown as Record<string, unknown>).createdAt || nowIso),
        createdBy: String(existingItem?.createdBy || (item as unknown as Record<string, unknown>).createdBy || currentUser.id),
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };

      // Encrypt sensitive PII & clinical notes client-side with AES-256-GCM before transmission
      let storageRecord = rawRecord;
      if (vaultKeyRef.current && e2eeFingerprint) {
        if (col === 'patients') {
          storageRecord = await encryptRecordFields(rawRecord, PATIENT_SENSITIVE_FIELDS, vaultKeyRef.current, e2eeFingerprint);
        } else if (col === 'medical_records') {
          storageRecord = await encryptRecordFields(rawRecord, RME_SENSITIVE_FIELDS, vaultKeyRef.current, e2eeFingerprint);
        }
      }

      const docId = String(storageRecord.id);

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch(`/api/store/${col}/${docId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerTokenRef.current}`
          },
          body: JSON.stringify(storageRecord)
        });
        const data = await res.json();
        if (!res.ok) {
          notifyToast(data.error || 'Gagal menyimpan data ke server.', 'error');
          throw new Error(data.error || 'Gagal menyimpan data ke server.');
        }
      }

      // Persist directly to Cloud Firestore online whenever Firebase Auth is active
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, col, docId), stripUndefinedDeep(storageRecord));
          if (col !== 'audit_logs' && col !== 'notifications') {
            void writeCloudAuditLog(
              currentUser,
              existingItem ? 'UPDATE' : 'CREATE',
              col,
              docId,
              existingItem ? JSON.stringify(existingItem) : undefined,
              JSON.stringify(rawRecord)
            );
          }
        } catch (err) {
          notifyToast(
            `Gagal menyimpan ke database online (${col}/${docId}). Periksa koneksi atau izin akses Firestore.`,
            'error'
          );
          handleFirestoreError(err, OperationType.WRITE, `${col}/${docId}`);
        }
      }

      // Update local state immediately with decrypted in-memory copy
      setDbState((prev) => {
        const list = prev[col] as unknown as Record<string, unknown>[];
        const idx = list.findIndex((x) => x.id === docId);
        const nextList = idx >= 0 ? list.map((x, i) => (i === idx ? rawRecord : x)) : [rawRecord, ...list];
        return { ...prev, [col]: nextList };
      });
    },
    [authMode, currentUser, e2eeFingerprint, notifyToast, writeCloudAuditLog]
  );

  const deleteRecord = useCallback(
    async (col: CollectionName, id: string) => {
      if (!currentUser) return;
      const existingList = dbStateRef.current[col] as unknown as Record<string, unknown>[];
      const existingItem = existingList.find((x) => x.id === id);

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch(`/api/store/${col}/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
        });
        if (res.status !== 404) {
          const data = await res.json();
          if (!res.ok) {
            notifyToast(data.error || 'Gagal menghapus data dari server.', 'error');
            throw new Error(data.error || 'Gagal menghapus data dari server.');
          }
        }
      }

      if (auth.currentUser) {
        try {
          await deleteDoc(doc(db, col, id));
          void writeCloudAuditLog(
            currentUser,
            'DELETE',
            col,
            id,
            existingItem ? JSON.stringify(existingItem) : undefined,
            undefined
          );
        } catch (err) {
          notifyToast(
            `Gagal menghapus data dari database online (${col}/${id}).`,
            'error'
          );
          handleFirestoreError(err, OperationType.DELETE, `${col}/${id}`);
        }
      }

      setDbState((prev) => {
        const list = prev[col] as unknown as Record<string, unknown>[];
        return { ...prev, [col]: list.filter((x) => x.id !== id) };
      });
    },
    [authMode, currentUser, notifyToast, writeCloudAuditLog]
  );

  const createStaffAccount = useCallback(
    async (payload: {
      username: string;
      password: string;
      displayName: string;
      email: string;
      role: RoleCode;
      strNumber?: string;
      sipNumber?: string;
      signatureUrl?: string;
    }) => {
      if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
        throw new Error('Hanya Super Admin yang dapat membuat akun pengguna.');
      }

      const normUser = payload.username.trim().toLowerCase();
      if (!normUser || !/^[a-z0-9._-]{3,40}$/.test(normUser)) {
        throw new Error('Username harus 3-40 karakter (huruf, angka, titik, garis bawah).');
      }
      if (!payload.displayName.trim()) {
        throw new Error('Nama lengkap wajib diisi.');
      }

      let createdUser: UserAccount;

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch('/api/auth/users', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerTokenRef.current}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal membuat akun pengguna.');
        createdUser = data.user as UserAccount;
      } else {
        const dup = dbStateRef.current.users.find(
          (u) =>
            u.username.toLowerCase() === normUser ||
            (payload.email.trim() && u.email.toLowerCase() === payload.email.trim().toLowerCase())
        );
        if (dup) {
          throw new Error('Username atau email sudah digunakan oleh akun lain.');
        }
        const nowIso = new Date().toISOString();
        createdUser = {
          id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          username: normUser,
          displayName: payload.displayName.trim(),
          email: payload.email.trim() || `${normUser}@klinikspog.id`,
          role: payload.role,
          strNumber: payload.strNumber?.trim() || '',
          sipNumber: payload.sipNumber?.trim() || '',
          signatureUrl: payload.signatureUrl || '',
          active: true,
          e2eeFingerprint: e2eeFingerprint || 'CLOUD-MANAGED',
          createdAt: nowIso,
          createdBy: currentUser.id,
          updatedAt: nowIso,
          updatedBy: currentUser.id
        };
      }

      // Persist to Cloud Firestore `users` and `staff_emails`
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'users', createdUser.id), stripUndefinedDeep(createdUser));
          if (createdUser.email && createdUser.email.trim()) {
            const emailLower = createdUser.email.trim().toLowerCase();
            await setDoc(doc(db, 'staff_emails', emailLower), buildStaffEmailDoc(createdUser, currentUser.id));
          }
          void writeCloudAuditLog(
            currentUser,
            'CREATE_USER',
            'users',
            createdUser.id,
            undefined,
            `${createdUser.username} (${createdUser.role}) — ${createdUser.email}`
          );
        } catch (err) {
          notifyToast('Gagal menyimpan akun baru ke database online Cloud Firestore.', 'error');
          handleFirestoreError(err, OperationType.CREATE, `users/${createdUser.id}`);
        }
      }

      setDbState((prev) => ({
        ...prev,
        users: [createdUser, ...prev.users.filter((u) => u.id !== createdUser.id)]
      }));

      notifyToast(`Akun ${createdUser.displayName} berhasil dibuat dan disimpan.`, 'success');
    },
    [authMode, currentUser, e2eeFingerprint, notifyToast, writeCloudAuditLog]
  );

  const updateStaffAccount = useCallback(
    async (
      userId: string,
      payload: {
        username?: string;
        displayName?: string;
        email?: string;
        role?: RoleCode;
        active?: boolean;
        newPassword?: string;
        strNumber?: string;
        sipNumber?: string;
        signatureUrl?: string;
      }
    ) => {
      if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
        throw new Error('Hanya Super Admin yang dapat memperbarui akun pengguna.');
      }

      const prevUser = dbStateRef.current.users.find((u) => u.id === userId);
      const prevEmailLower = prevUser?.email ? prevUser.email.trim().toLowerCase() : '';
      let updatedUser: UserAccount;

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch(`/api/auth/users/${userId}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerTokenRef.current}`
          },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal memperbarui pengguna.');
        updatedUser = data.user as UserAccount;
      } else {
        if (!prevUser) throw new Error('Pengguna tidak ditemukan.');
        const nextUsername = payload.username ? payload.username.trim().toLowerCase() : prevUser.username;
        if (!/^[a-z0-9._-]{3,40}$/.test(nextUsername)) {
          throw new Error('Username harus 3-40 karakter (huruf, angka, titik, garis bawah).');
        }
        const nowIso = new Date().toISOString();
        updatedUser = {
          ...prevUser,
          username: nextUsername,
          displayName: payload.displayName ? payload.displayName.trim() : prevUser.displayName,
          email: typeof payload.email === 'string' ? payload.email.trim() : prevUser.email,
          role: payload.role && userId !== currentUser.id ? payload.role : prevUser.role,
          active: typeof payload.active === 'boolean' && userId !== currentUser.id ? payload.active : prevUser.active,
          strNumber: typeof payload.strNumber === 'string' ? payload.strNumber.trim() : prevUser.strNumber,
          sipNumber: typeof payload.sipNumber === 'string' ? payload.sipNumber.trim() : prevUser.sipNumber,
          signatureUrl: typeof payload.signatureUrl === 'string' ? payload.signatureUrl : prevUser.signatureUrl,
          updatedAt: nowIso,
          updatedBy: currentUser.id
        };
      }

      // Mirror update to Cloud Firestore `users` and `staff_emails`
      if (auth.currentUser) {
        try {
          await setDoc(doc(db, 'users', updatedUser.id), stripUndefinedDeep(updatedUser));
          const nextEmailLower = updatedUser.email ? updatedUser.email.trim().toLowerCase() : '';
          if (prevEmailLower && prevEmailLower !== nextEmailLower && prevEmailLower !== BOOTSTRAP_SUPERADMIN_EMAIL) {
            try {
              await deleteDoc(doc(db, 'staff_emails', prevEmailLower));
            } catch {
              // Ignore if previous email doc did not exist
            }
          }
          if (nextEmailLower) {
            await setDoc(doc(db, 'staff_emails', nextEmailLower), buildStaffEmailDoc(updatedUser, currentUser.id));
          }
          void writeCloudAuditLog(
            currentUser,
            'UPDATE_USER',
            'users',
            updatedUser.id,
            prevUser ? `${prevUser.username} | ${prevUser.displayName} | ${prevUser.role}` : undefined,
            `${updatedUser.username} | ${updatedUser.displayName} | ${updatedUser.role} | active=${updatedUser.active}`
          );
        } catch (err) {
          notifyToast('Gagal memperbarui akun pengguna di Cloud Firestore.', 'error');
          handleFirestoreError(err, OperationType.UPDATE, `users/${updatedUser.id}`);
        }
      }

      setDbState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === updatedUser.id ? updatedUser : u))
      }));
      if (updatedUser.id === currentUser.id) {
        setCurrentUser(updatedUser);
      }

      notifyToast(`Akun ${updatedUser.displayName} berhasil diperbarui.`, 'success');
    },
    [authMode, currentUser, notifyToast, writeCloudAuditLog]
  );

  const updateMySignature = useCallback(
    async (signatureUrl: string) => {
      if (!currentUser) throw new Error('Pengguna belum login.');
      const nowIso = new Date().toISOString();
      const updatedSelf: UserAccount = {
        ...currentUser,
        signatureUrl,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch('/api/auth/me/signature', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerTokenRef.current}`
          },
          body: JSON.stringify({ signatureUrl })
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Gagal menyimpan tanda tangan ke server.');
      }

      if (auth.currentUser) {
        try {
          const targetId = auth.currentUser.uid;
          const existingDoc = await getDoc(doc(db, 'users', targetId));
          const base = existingDoc.exists() ? (existingDoc.data() as UserAccount) : updatedSelf;
          const nextDoc: UserAccount = {
            ...base,
            id: targetId,
            signatureUrl,
            updatedAt: nowIso,
            updatedBy: targetId
          };
          await setDoc(doc(db, 'users', targetId), stripUndefinedDeep(nextDoc));
          if (currentUser.role === 'SUPER_ADMIN' && nextDoc.email) {
            const emailLower = nextDoc.email.trim().toLowerCase();
            await setDoc(doc(db, 'staff_emails', emailLower), buildStaffEmailDoc(nextDoc, targetId));
          }
        } catch (err) {
          notifyToast('Gagal menyimpan tanda tangan ke database online.', 'error');
          handleFirestoreError(err, OperationType.UPDATE, `users/${auth.currentUser.uid}`);
        }
      }

      setCurrentUser(updatedSelf);
      setDbState((prev) => ({
        ...prev,
        users: prev.users.map((u) => (u.id === updatedSelf.id ? { ...u, signatureUrl, updatedAt: nowIso } : u))
      }));
      notifyToast('Tanda tangan digital Anda berhasil disimpan.', 'success');
    },
    [authMode, currentUser, notifyToast]
  );

  const deleteStaffAccount = useCallback(
    async (userId: string) => {
      if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
        throw new Error('Hanya Super Admin yang dapat menghapus akun pengguna.');
      }
      if (userId === currentUser.id || (auth.currentUser && userId === auth.currentUser.uid)) {
        throw new Error('Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.');
      }
      const target = dbStateRef.current.users.find((u) => u.id === userId);
      if (target?.email?.trim().toLowerCase() === BOOTSTRAP_SUPERADMIN_EMAIL) {
        throw new Error('Akun Super Admin utama tidak dapat dihapus.');
      }

      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch(`/api/auth/users/${userId}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
        });
        if (res.status !== 404) {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Gagal menghapus pengguna dari server.');
        }
      }

      if (auth.currentUser) {
        try {
          await deleteDoc(doc(db, 'users', userId));
          if (target?.email && target.email.trim()) {
            const emailLower = target.email.trim().toLowerCase();
            if (emailLower !== BOOTSTRAP_SUPERADMIN_EMAIL) {
              try {
                await deleteDoc(doc(db, 'staff_emails', emailLower));
              } catch {
                // Ignore if lookup doc absent
              }
            }
          }
          void writeCloudAuditLog(
            currentUser,
            'DELETE_USER',
            'users',
            userId,
            target ? `${target.username} | ${target.displayName} | ${target.role}` : userId,
            undefined
          );
        } catch (err) {
          notifyToast('Gagal menghapus akun pengguna di Cloud Firestore.', 'error');
          handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
        }
      }

      setDbState((prev) => ({
        ...prev,
        users: prev.users.filter((u) => u.id !== userId)
      }));
      notifyToast(`Akun pengguna ${target?.displayName || userId} berhasil dihapus permanen.`, 'info');
    },
    [authMode, currentUser, notifyToast, writeCloudAuditLog]
  );

  const pushNotification = useCallback(
    async (item: Omit<NotificationItem, 'id' | 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy' | 'read'>) => {
      if (!currentUser) return;
      const nowIso = new Date().toISOString();
      const notif: NotificationItem = {
        ...item,
        id: `ntf-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        read: false,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('notifications', notif);
    },
    [currentUser, upsertRecord]
  );

  const loadDemoData = useCallback(async () => {
    if (!currentUser) return;
    const demo = buildIsolatedDemoDataset(currentUser.id, currentUser.displayName);
    if (vaultKeyRef.current && e2eeFingerprint && demo.patients) {
      demo.patients = (await Promise.all(
        demo.patients.map((p) =>
          encryptRecordFields(p as unknown as Record<string, unknown>, PATIENT_SENSITIVE_FIELDS, vaultKeyRef.current!, e2eeFingerprint)
        )
      )) as unknown as PracticeDatabase['patients'];
    }
    if (vaultKeyRef.current && e2eeFingerprint && demo.medical_records) {
      demo.medical_records = (await Promise.all(
        demo.medical_records.map((r) =>
          encryptRecordFields(r as unknown as Record<string, unknown>, RME_SENSITIVE_FIELDS, vaultKeyRef.current!, e2eeFingerprint)
        )
      )) as unknown as PracticeDatabase['medical_records'];
    }

    if (authMode === 'staff' && bearerTokenRef.current) {
      const res = await fetch('/api/store/demo/load', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${bearerTokenRef.current}`
        },
        body: JSON.stringify(demo)
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal memuat dataset demonstrasi.');
      }
      await fetchStaffStoreState();
    } else {
      const merged = { ...dbStateRef.current };
      for (const [col, items] of Object.entries(demo)) {
        if (Array.isArray(items)) {
          (merged as unknown as Record<string, unknown>)[col] = [
            ...items,
            ...((merged as unknown as Record<string, unknown[]>)[col] || [])
          ];
        }
      }
      setDbState(await decryptDatabaseState(merged, vaultKeyRef.current));
    }

    // Persist demo dataset directly to Cloud Firestore when connected
    if (auth.currentUser) {
      try {
        const ops: Array<{ type: 'set'; col: string; id: string; data: Record<string, unknown> }> = [];
        for (const [colName, items] of Object.entries(demo)) {
          if (!Array.isArray(items)) continue;
          for (const item of items) {
            const rec = item as unknown as Record<string, unknown>;
            if (rec.id) {
              ops.push({ type: 'set', col: colName, id: String(rec.id), data: rec });
            }
          }
        }
        await commitBatchedOps(ops);
        void writeCloudAuditLog(currentUser, 'LOAD_DEMO_DATASET', 'system', 'demo', undefined, `${ops.length} record demo dimuat ke Cloud Firestore`);
      } catch (err) {
        notifyToast('Sebagian data demo gagal ditulis ke Cloud Firestore.', 'warning');
        handleFirestoreError(err, OperationType.WRITE, 'demo_load');
      }
    }

    notifyToast('Dataset demonstrasi terpisah berhasil dimuat (terenkripsi E2EE).', 'success');
  }, [authMode, currentUser, decryptDatabaseState, e2eeFingerprint, fetchStaffStoreState, notifyToast, writeCloudAuditLog]);

  const clearDemoData = useCallback(async () => {
    if (!currentUser) return;
    if (authMode === 'staff' && bearerTokenRef.current) {
      const res = await fetch('/api/store/demo/clear', {
        method: 'POST',
        headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Gagal menghapus data demonstrasi.');
      }
      await fetchStaffStoreState();
    }

    // Delete all `isDemo === true` documents in Cloud Firestore
    if (auth.currentUser) {
      try {
        const skipCols = new Set<CollectionName>([
          'audit_logs',
          'users',
          'roles',
          'permissions',
          'practice_settings',
          'system_settings',
          'integrations',
          'icd10_codes',
          'services',
          'medicines'
        ]);
        const ops: Array<{ type: 'delete'; col: string; id: string }> = [];
        for (const colName of ALL_COLLECTIONS) {
          if (skipCols.has(colName)) continue;
          const items = dbStateRef.current[colName] as unknown as Array<{ id: string; isDemo?: boolean }>;
          for (const item of items) {
            if (item.isDemo) {
              ops.push({ type: 'delete', col: colName, id: item.id });
            }
          }
        }
        if (ops.length > 0) {
          await commitBatchedOps(ops);
        }
        void writeCloudAuditLog(currentUser, 'PURGE_DEMO_DATASET', 'system', 'demo', undefined, `${ops.length} record demo dibersihkan dari Cloud Firestore`);
      } catch (err) {
        notifyToast('Gagal membersihkan sebagian data demo di Cloud Firestore.', 'error');
        handleFirestoreError(err, OperationType.DELETE, 'demo_clear');
      }
    }

    setDbState((prev) => {
      const next = { ...prev };
      const skipCols = new Set<CollectionName>([
        'audit_logs',
        'users',
        'roles',
        'permissions',
        'practice_settings',
        'system_settings',
        'integrations',
        'icd10_codes',
        'services',
        'medicines'
      ]);
      for (const colName of ALL_COLLECTIONS) {
        if (skipCols.has(colName)) continue;
        (next as unknown as Record<string, unknown[]>)[colName] = (
          prev[colName] as unknown as Array<{ isDemo?: boolean }>
        ).filter((i) => !i.isDemo);
      }
      return next;
    });

    notifyToast('Data demonstrasi dibersihkan tanpa memengaruhi data produksi.', 'info');
  }, [authMode, currentUser, fetchStaffStoreState, notifyToast, writeCloudAuditLog]);

  const restoreBackupData = useCallback(
    async (backup: Partial<PracticeDatabase>) => {
      if (!currentUser) return;
      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch('/api/store/backup/restore', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${bearerTokenRef.current}`
          },
          body: JSON.stringify(backup)
        });
        if (!res.ok) {
          const d = await res.json();
          throw new Error(d.error || 'Gagal memulihkan backup.');
        }
        await fetchStaffStoreState();
      }

      if (auth.currentUser) {
        try {
          const nowIso = new Date().toISOString();
          const ops: Array<{ type: 'set'; col: string; id: string; data: Record<string, unknown> }> = [];
          for (const colName of ALL_COLLECTIONS) {
            if (colName === 'users' || colName === 'audit_logs') continue;
            const items = backup[colName];
            if (!Array.isArray(items)) continue;
            for (const rawItem of items) {
              const rec = rawItem as unknown as Record<string, unknown>;
              if (!rec.id) continue;
              let payload: Record<string, unknown> = {
                ...rec,
                createdAt: String(rec.createdAt || nowIso),
                createdBy: String(rec.createdBy || currentUser.id),
                updatedAt: String(rec.updatedAt || nowIso),
                updatedBy: currentUser.id
              };
              if (vaultKeyRef.current && e2eeFingerprint) {
                if (colName === 'patients') {
                  payload = await encryptRecordFields(payload, PATIENT_SENSITIVE_FIELDS, vaultKeyRef.current, e2eeFingerprint);
                } else if (colName === 'medical_records') {
                  payload = await encryptRecordFields(payload, RME_SENSITIVE_FIELDS, vaultKeyRef.current, e2eeFingerprint);
                }
              }
              ops.push({ type: 'set', col: colName, id: String(rec.id), data: payload });
            }
          }
          if (ops.length > 0) {
            await commitBatchedOps(ops);
          }
          void writeCloudAuditLog(currentUser, 'RESTORE_BACKUP', 'backups', 'restore', undefined, `${ops.length} dokumen dipulihkan ke Cloud Firestore`);
        } catch (err) {
          notifyToast('Gagal memulihkan sebagian data ke Cloud Firestore.', 'error');
          handleFirestoreError(err, OperationType.WRITE, 'backup_restore');
        }
      }

      setDbState((prev) => {
        const next = { ...prev };
        for (const colName of ALL_COLLECTIONS) {
          if (colName === 'users' || colName === 'audit_logs') continue;
          const items = backup[colName];
          if (Array.isArray(items)) {
            (next as unknown as Record<string, unknown>)[colName] = items;
          }
        }
        return next;
      });

      notifyToast('Backup database berhasil dipulihkan dan disimpan ke database online.', 'success');
    },
    [authMode, currentUser, e2eeFingerprint, fetchStaffStoreState, notifyToast, writeCloudAuditLog]
  );

  const practice = useMemo(
    () =>
      dbState.practice_settings.find((p) => p.id === 'main') ||
      dbState.practice_settings[0] ||
      createDefaultPracticeSettings(),
    [dbState.practice_settings]
  );

  const systemSettings = useMemo(
    () =>
      dbState.system_settings.find((s) => s.id === 'main') ||
      dbState.system_settings[0] ||
      createDefaultSystemSettings(),
    [dbState.system_settings]
  );

  const can = useCallback(
    (permissionKey: string) => {
      if (!currentUser) return false;
      return hasPermission(currentUser.role, permissionKey, dbState.roles);
    },
    [currentUser, dbState.roles]
  );

  const value: PracticeContextValue = {
    dbState,
    currentUser,
    firebaseUser,
    authMode,
    cloudSynced,
    loading,
    e2eeUnlocked,
    e2eeFingerprint,
    activeView,
    setActiveView,
    selectedPatientId,
    setSelectedPatientId,
    selectedVisitId,
    setSelectedVisitId,
    practice,
    systemSettings,
    toasts,
    notifyToast,
    dismissToast,
    printPayload,
    setPrintPayload,
    loginStaff,
    loginGoogleFirebase,
    logout,
    upsertRecord,
    deleteRecord,
    createStaffAccount,
    updateStaffAccount,
    updateMySignature,
    deleteStaffAccount,
    pushNotification,
    loadDemoData,
    clearDemoData,
    restoreBackupData,
    can,
    refreshState: fetchStaffStoreState
  };

  return <PracticeContext.Provider value={value}>{children}</PracticeContext.Provider>;
};

export function usePractice(): PracticeContextValue {
  const ctx = useContext(PracticeContext);
  if (!ctx) throw new Error('usePractice must be used inside PracticeProvider');
  return ctx;
}
