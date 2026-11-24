import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { onAuthStateChanged, type User as FirebaseUser } from 'firebase/auth';
import { collection, deleteDoc, doc, getDocs, onSnapshot, setDoc } from 'firebase/firestore';
import { auth, db, handleFirestoreError, OperationType, signInWithGoogleFirebase, signOutFirebase } from '../lib/firebase';
import type {
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
  unwrapVaultKeyForAccount
} from '../utils/cryptoE2EE';
import { hasPermission } from '../utils/rbac';

const PATIENT_SENSITIVE_FIELDS = ['nik', 'phone', 'email', 'address', 'familyPhone', 'emergencyContact', 'allergies'];
const RME_SENSITIVE_FIELDS = ['doctorNotes'];

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
  connectFirebaseCloud: () => Promise<void>;
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
  }) => Promise<void>;
  updateStaffAccount: (
    userId: string,
    payload: {
      displayName?: string;
      email?: string;
      role?: RoleCode;
      active?: boolean;
      newPassword?: string;
      strNumber?: string;
      sipNumber?: string;
    }
  ) => Promise<void>;
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

  // Listen to Firebase Auth state for Google Sign-In cloud sync
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      setFirebaseUser(fbUser);
      if (fbUser && authMode === 'none') {
        const isBootstrappedAdmin = fbUser.email?.toLowerCase() === 'grimoireids@gmail.com';
        const nowIso = new Date().toISOString();
        const fbProfile: UserAccount = {
          id: fbUser.uid,
          username: fbUser.email || fbUser.uid,
          displayName: fbUser.displayName || 'Pengguna Google',
          email: fbUser.email || '',
          role: isBootstrappedAdmin ? 'SUPER_ADMIN' : 'DOKTER_SPOG',
          active: true,
          createdAt: nowIso,
          createdBy: fbUser.uid,
          updatedAt: nowIso,
          updatedBy: fbUser.uid
        };
        if (!vaultKeyRef.current) {
          const v = await generateVaultKey();
          vaultKeyRef.current = v.key;
          setE2eeFingerprint(v.fingerprint);
          setE2eeUnlocked(true);
        }
        setCurrentUser(fbProfile);
        setAuthMode('firebase');
      }
      setLoading(false);
    });
    return () => unsub();
  }, [authMode]);

  // Subscribe to real-time Cloud Firestore snapshots when authenticated directly via Firebase Auth
  useEffect(() => {
    if (authMode !== 'firebase' || !firebaseUser) return;
    const coreCollections: CollectionName[] = [
      'practice_settings',
      'patients',
      'visits',
      'queues',
      'medical_records',
      'pregnancies',
      'antenatal_visits',
      'ultrasound_records',
      'prescriptions',
      'invoices',
      'payments',
      'appointments',
      'notifications'
    ];
    const unsubs = coreCollections.map((colName) =>
      onSnapshot(
        collection(db, colName),
        async (snap) => {
          const docs = snap.docs.map((d) => ({ ...d.data(), id: d.id })) as Record<string, unknown>[];
          let processed = docs;
          if ((colName === 'patients' || colName === 'medical_records') && vaultKeyRef.current) {
            processed = await Promise.all(
              docs.map((d) => decryptRecordFields(d, vaultKeyRef.current))
            );
          }
          if (processed.length > 0) {
            setDbState((prev) => ({ ...prev, [colName]: processed }));
          }
        },
        (error) => {
          // Surface structured Firestore permission context
          try {
            handleFirestoreError(error, OperationType.LIST, colName);
          } catch {
            // Keep UI alive even if optional collection is restricted by role
          }
        }
      )
    );
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [authMode, firebaseUser]);

  const loginStaff = useCallback(
    async (username: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Login gagal.');
      }

      bearerTokenRef.current = data.token;
      const user = data.user as UserAccount;

      // Client-side Web Crypto E2EE Vault Key Unwrapping per account
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
      await fetchStaffStoreState();
      notifyToast(`Selamat datang, ${user.displayName}. Vault E2EE terbuka.`, 'success');
    },
    [fetchStaffStoreState, notifyToast]
  );

  const loginGoogleFirebase = useCallback(async () => {
    const result = await signInWithGoogleFirebase();
    const fbUser = result.user;
    const isBootstrappedAdmin = fbUser.email?.toLowerCase() === 'grimoireids@gmail.com';
    const nowIso = new Date().toISOString();

    const vault = await generateVaultKey();
    vaultKeyRef.current = vault.key;
    setE2eeFingerprint(vault.fingerprint);
    setE2eeUnlocked(true);

    const profile: UserAccount = {
      id: fbUser.uid,
      username: fbUser.email || fbUser.uid,
      displayName: fbUser.displayName || 'Pengguna Google',
      email: fbUser.email || '',
      role: isBootstrappedAdmin ? 'SUPER_ADMIN' : 'DOKTER_SPOG',
      active: true,
      e2eeFingerprint: vault.fingerprint,
      createdAt: nowIso,
      createdBy: fbUser.uid,
      updatedAt: nowIso,
      updatedBy: fbUser.uid
    };
    setCurrentUser(profile);
    setAuthMode('firebase');
    setActiveView('dashboard');
    notifyToast(`Login Firebase berhasil sebagai ${profile.displayName}.`, 'success');
  }, [notifyToast]);

  const connectFirebaseCloud = useCallback(async () => {
    const result = await signInWithGoogleFirebase();
    setFirebaseUser(result.user);
    // Sync current practice settings & patients snapshot to Cloud Firestore
    try {
      const p = dbState.practice_settings[0];
      if (p) {
        await setDoc(doc(db, 'practice_settings', p.id), p);
      }
      const existingSnap = await getDocs(collection(db, 'patients'));
      notifyToast(
        `Terhubung ke Cloud Firestore (${result.user.email}). ${existingSnap.size} data pasien cloud terdeteksi.`,
        'success'
      );
    } catch (error) {
      try {
        handleFirestoreError(error, OperationType.WRITE, 'practice_settings/main');
      } catch {
        notifyToast('Terhubung ke Firebase Auth. Pastikan email Anda terdaftar sebagai staf aktif di Firestore.', 'info');
      }
    }
  }, [dbState.practice_settings, notifyToast]);

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
    setCurrentUser(null);
    setFirebaseUser(null);
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
      const rawRecord: Record<string, unknown> = {
        ...(item as unknown as Record<string, unknown>),
        createdAt: (item as unknown as Record<string, unknown>).createdAt || nowIso,
        createdBy: (item as unknown as Record<string, unknown>).createdBy || currentUser.id,
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
          notifyToast(data.error || 'Gagal menyimpan data.', 'error');
          throw new Error(data.error || 'Gagal menyimpan data.');
        }
      }

      // Mirror to Cloud Firestore whenever Firebase user is authenticated
      if (firebaseUser) {
        try {
          await setDoc(doc(db, col, docId), storageRecord);
        } catch (err) {
          if (authMode === 'firebase') {
            handleFirestoreError(err, OperationType.WRITE, `${col}/${docId}`);
          }
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
    [authMode, currentUser, e2eeFingerprint, firebaseUser, notifyToast]
  );

  const deleteRecord = useCallback(
    async (col: CollectionName, id: string) => {
      if (!currentUser) return;
      if (authMode === 'staff' && bearerTokenRef.current) {
        const res = await fetch(`/api/store/${col}/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${bearerTokenRef.current}` }
        });
        const data = await res.json();
        if (!res.ok) {
          notifyToast(data.error || 'Gagal menghapus data.', 'error');
          throw new Error(data.error || 'Gagal menghapus data.');
        }
      }
      if (firebaseUser) {
        try {
          await deleteDoc(doc(db, col, id));
        } catch (err) {
          if (authMode === 'firebase') {
            handleFirestoreError(err, OperationType.DELETE, `${col}/${id}`);
          }
        }
      }
      setDbState((prev) => {
        const list = prev[col] as unknown as Record<string, unknown>[];
        return { ...prev, [col]: list.filter((x) => x.id !== id) };
      });
    },
    [authMode, currentUser, firebaseUser, notifyToast]
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
    }) => {
      if (!bearerTokenRef.current) {
        throw new Error('Pembuatan akun staf memerlukan sesi Super Admin server.');
      }
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
      await fetchStaffStoreState();
      notifyToast(`Akun ${payload.username} berhasil dibuat dengan enkripsi E2EE.`, 'success');
    },
    [fetchStaffStoreState, notifyToast]
  );

  const updateStaffAccount = useCallback(
    async (
      userId: string,
      payload: {
        displayName?: string;
        email?: string;
        role?: RoleCode;
        active?: boolean;
        newPassword?: string;
        strNumber?: string;
        sipNumber?: string;
      }
    ) => {
      if (!bearerTokenRef.current) {
        throw new Error('Pembaruan akun staf memerlukan sesi Super Admin server.');
      }
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
      await fetchStaffStoreState();
      notifyToast('Data akun & kunci E2EE diperbarui.', 'success');
    },
    [fetchStaffStoreState, notifyToast]
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
    // Encrypt sensitive demo patients & medical records before storage
    if (vaultKeyRef.current && e2eeFingerprint && demo.patients) {
      demo.patients = (await Promise.all(
        demo.patients.map((p) =>
          encryptRecordFields(p as unknown as Record<string, unknown>, PATIENT_SENSITIVE_FIELDS, vaultKeyRef.current!, e2eeFingerprint)
        )
      )) as unknown as PracticeDatabase['patients'];
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
      const merged = { ...dbState };
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
    notifyToast('Dataset demonstrasi terpisah berhasil dimuat (terenkripsi E2EE).', 'success');
  }, [authMode, currentUser, dbState, decryptDatabaseState, e2eeFingerprint, fetchStaffStoreState, notifyToast]);

  const clearDemoData = useCallback(async () => {
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
    notifyToast('Data demonstrasi dibersihkan tanpa memengaruhi data produksi.', 'info');
  }, [authMode, fetchStaffStoreState, notifyToast]);

  const restoreBackupData = useCallback(
    async (backup: Partial<PracticeDatabase>) => {
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
      notifyToast('Backup database berhasil dipulihkan.', 'success');
    },
    [authMode, fetchStaffStoreState, notifyToast]
  );

  const practice = useMemo(
    () => dbState.practice_settings[0] || createDefaultPracticeSettings(),
    [dbState.practice_settings]
  );

  const systemSettings = useMemo(
    () => dbState.system_settings[0] || createDefaultSystemSettings(),
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
    connectFirebaseCloud,
    logout,
    upsertRecord,
    deleteRecord,
    createStaffAccount,
    updateStaffAccount,
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
