import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import type { AuditLog, CollectionName, PracticeDatabase, RoleCode, UserAccount } from './src/types/models.ts';
import { createEmptyDatabase } from './src/data/defaults.ts';

dotenv.config();

const PORT = 3000;
const DATA_DIR = path.resolve(process.cwd(), '.data');
const DB_FILE = path.join(DATA_DIR, 'practice-db.json');
const CRED_FILE = path.join(DATA_DIR, 'auth-credentials.json');
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

interface StoredCredential {
  userId: string;
  username: string;
  passwordSalt: string;
  passwordHash: string;
  e2eeSalt: string;
  e2eeWrappedKey: string;
  e2eeFingerprint: string;
  keyVersion: number;
}

interface SessionPayload {
  userId: string;
  username: string;
  displayName: string;
  role: RoleCode;
  exp: number;
}

interface AuthedRequest extends Request {
  session?: SessionPayload;
}

// Rate limiter for login attempts (in-memory)
const loginAttempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function hashPassword(password: string, saltHex?: string): { salt: string; hash: string } {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password: string, salt: string, expectedHash: string): boolean {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Derive a 256-bit AES-GCM KEK using PBKDF2-SHA256 (100,000 iterations) — matches browser Web Crypto subtle.deriveKey.
 */
function wrapVaultKeyNode(vaultKeyRaw: Buffer, passphrase: string, saltBase64: string): string {
  const saltBuf = Buffer.from(saltBase64, 'base64');
  const kek = crypto.pbkdf2Sync(passphrase, saltBuf, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const encrypted = Buffer.concat([cipher.update(vaultKeyRaw), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Web Crypto AES-GCM expects ciphertext || 16-byte auth tag concatenated
  const wrapped = Buffer.concat([encrypted, tag]);
  return JSON.stringify({
    iv: iv.toString('base64'),
    wrapped: wrapped.toString('base64')
  });
}

function computeFingerprintNode(rawKey: Buffer): string {
  const digest = crypto.createHash('sha256').update(rawKey).digest();
  return Array.from(digest.subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

function signToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

interface CredentialStore {
  vaultKeyBase64: string;
  keyVersion: number;
  fingerprint: string;
  credentials: Record<string, StoredCredential>;
}

let dbState: PracticeDatabase;
let credStore: CredentialStore;

function saveDb() {
  ensureDataDir();
  fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
}

function saveCreds() {
  ensureDataDir();
  fs.writeFileSync(CRED_FILE, JSON.stringify(credStore, null, 2), 'utf8');
}

function createCredentialEntry(
  userId: string,
  username: string,
  plainPassword: string,
  vaultKeyRaw: Buffer,
  keyVersion: number,
  fingerprint: string
): StoredCredential {
  const { salt, hash } = hashPassword(plainPassword);
  const e2eeSalt = crypto.randomBytes(16).toString('base64');
  const e2eeWrappedKey = wrapVaultKeyNode(vaultKeyRaw, plainPassword, e2eeSalt);
  return {
    userId,
    username: username.toLowerCase(),
    passwordSalt: salt,
    passwordHash: hash,
    e2eeSalt,
    e2eeWrappedKey,
    e2eeFingerprint: fingerprint,
    keyVersion
  };
}

function initStorage() {
  ensureDataDir();
  const superAdminUser = (process.env.SUPERADMIN_USERNAME || 'superman').trim().toLowerCase();
  const superAdminPass = process.env.SUPERADMIN_PASSWORD || 'superman123';

  if (fs.existsSync(CRED_FILE)) {
    credStore = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8')) as CredentialStore;
  } else {
    const vaultKeyRaw = crypto.randomBytes(32);
    const fingerprint = computeFingerprintNode(vaultKeyRaw);
    credStore = {
      vaultKeyBase64: vaultKeyRaw.toString('base64'),
      keyVersion: 1,
      fingerprint,
      credentials: {}
    };
  }

  const vaultKeyRaw = Buffer.from(credStore.vaultKeyBase64, 'base64');

  if (fs.existsSync(DB_FILE)) {
    dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8')) as PracticeDatabase;
  } else {
    dbState = createEmptyDatabase();
  }

  // Ensure initial system_settings has E2EE fingerprint synced
  if (dbState.system_settings[0]) {
    dbState.system_settings[0].e2eeKeyFingerprint = credStore.fingerprint;
    dbState.system_settings[0].e2eeKeyVersion = credStore.keyVersion;
  }

  // Bootstrap required accounts if missing (superman + starter doctor & assistant for RBAC workflow)
  const nowIso = new Date().toISOString();
  const bootstrapSpecs: {
    id: string;
    username: string;
    password: string;
    displayName: string;
    email: string;
    role: RoleCode;
    strNumber?: string;
    sipNumber?: string;
  }[] = [
    {
      id: 'usr-superadmin',
      username: superAdminUser,
      password: superAdminPass,
      displayName: 'Super Admin Praktik',
      email: 'grimoireids@gmail.com',
      role: 'SUPER_ADMIN'
    },
    {
      id: 'usr-dokter',
      username: 'dokter',
      password: process.env.BOOTSTRAP_DOCTOR_PASSWORD || 'dokter123',
      displayName: 'dr. Kartika Wulandari, Sp.OG (K)',
      email: 'dokter.spog@klinikspog.id',
      role: 'DOKTER_SPOG',
      strNumber: '31.2.1.301.4.23.189402',
      sipNumber: '446/SIP-SpOG/2025/0142'
    },
    {
      id: 'usr-asisten',
      username: 'asisten',
      password: process.env.BOOTSTRAP_ASSISTANT_PASSWORD || 'asisten123',
      displayName: 'Ns. Rani Permata, S.Kep',
      email: 'asisten@klinikspog.id',
      role: 'ASISTEN_DOKTER'
    }
  ];

  let changed = false;
  for (const spec of bootstrapSpecs) {
    if (!credStore.credentials[spec.username]) {
      credStore.credentials[spec.username] = createCredentialEntry(
        spec.id,
        spec.username,
        spec.password,
        vaultKeyRaw,
        credStore.keyVersion,
        credStore.fingerprint
      );
      changed = true;
    }
    const existingUser = dbState.users.find((u) => u.id === spec.id || u.username === spec.username);
    const cred = credStore.credentials[spec.username];
    if (!existingUser) {
      const account: UserAccount = {
        id: spec.id,
        username: spec.username,
        displayName: spec.displayName,
        email: spec.email,
        role: spec.role,
        strNumber: spec.strNumber,
        sipNumber: spec.sipNumber,
        active: true,
        e2eeSalt: cred.e2eeSalt,
        e2eeWrappedKey: cred.e2eeWrappedKey,
        e2eeFingerprint: cred.e2eeFingerprint,
        createdAt: nowIso,
        createdBy: 'system',
        updatedAt: nowIso,
        updatedBy: 'system'
      };
      dbState.users.push(account);
      changed = true;
    }
  }

  // If SUPERADMIN_PASSWORD env var is explicitly provided, synchronize its hash
  if (process.env.SUPERADMIN_PASSWORD && credStore.credentials[superAdminUser]) {
    if (!verifyPassword(superAdminPass, credStore.credentials[superAdminUser].passwordSalt, credStore.credentials[superAdminUser].passwordHash)) {
      credStore.credentials[superAdminUser] = createCredentialEntry(
        'usr-superadmin',
        superAdminUser,
        superAdminPass,
        vaultKeyRaw,
        credStore.keyVersion,
        credStore.fingerprint
      );
      changed = true;
    }
  }

  if (changed || !fs.existsSync(DB_FILE) || !fs.existsSync(CRED_FILE)) {
    saveCreds();
    saveDb();
  }
}

initStorage();

const VALID_COLLECTIONS = new Set<CollectionName>(Object.keys(createEmptyDatabase()) as CollectionName[]);

function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Sesi tidak valid. Silakan login kembali.' });
    return;
  }
  const token = header.slice('Bearer '.length).trim();
  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: 'Token sesi kedaluwarsa atau tidak sah.' });
    return;
  }
  const user = dbState.users.find((u) => u.id === payload.userId);
  if (!user || !user.active) {
    res.status(403).json({ error: 'Akun dinonaktifkan atau tidak ditemukan.' });
    return;
  }
  req.session = { ...payload, role: user.role, displayName: user.displayName };
  next();
}

function checkCollectionWriteAccess(
  role: RoleCode,
  collection: CollectionName,
  method: 'UPSERT' | 'DELETE',
  existingItem?: Record<string, unknown>,
  incomingItem?: Record<string, unknown>
): string | null {
  if (collection === 'audit_logs') {
    if (method === 'DELETE' || existingItem) {
      return 'Audit log bersifat permanen dan tidak dapat diubah atau dihapus.';
    }
    return null;
  }
  if (collection === 'medical_record_versions' && (method === 'DELETE' || existingItem)) {
    return 'Riwayat versi rekam medis tidak dapat diubah atau dihapus.';
  }
  if (role === 'SUPER_ADMIN') return null;

  const superAdminOnly: CollectionName[] = [
    'users',
    'roles',
    'permissions',
    'practice_settings',
    'services',
    'system_settings',
    'integrations',
    'backups'
  ];
  if (superAdminOnly.includes(collection)) {
    return 'Hanya Super Admin yang berwenang mengubah konfigurasi ini.';
  }

  if (role === 'ASISTEN_DOKTER') {
    const medicalOnly: CollectionName[] = [
      'medical_records',
      'diagnoses',
      'pregnancies',
      'antenatal_visits',
      'ultrasound_records',
      'icd10_codes'
    ];
    if (medicalOnly.includes(collection)) {
      return 'Asisten Dokter tidak berwenang mengubah data klinis/diagnosis dokter.';
    }
    if (collection === 'prescriptions') {
      if (!existingItem) return 'Asisten Dokter tidak berwenang membuat resep dokter.';
      if (method === 'DELETE') return 'Asisten Dokter tidak berwenang menghapus resep.';
      // Assistant may only update dispensing status on doctor-authorized prescriptions
      if (existingItem.status !== 'Disahkan Dokter' && existingItem.status !== 'Disiapkan') {
        return 'Resep belum disahkan oleh dokter.';
      }
      return null;
    }
    if (collection === 'refunds' && existingItem && incomingItem?.status === 'Disetujui') {
      return 'Persetujuan refund wajib dilakukan oleh Super Admin.';
    }
    if (method === 'DELETE' && ['patients', 'invoices', 'payments'].includes(collection)) {
      return 'Penghapusan permanen tidak diizinkan untuk Asisten Dokter.';
    }
    return null;
  }

  if (role === 'DOKTER_SPOG') {
    const financeOnly: CollectionName[] = [
      'payments',
      'refunds',
      'cash_sessions',
      'cash_transactions',
      'expenses'
    ];
    if (financeOnly.includes(collection)) {
      return 'Dokter tidak diperkenankan mengubah transaksi pembayaran kasir.';
    }
    if (collection === 'invoices' && existingItem) {
      return 'Dokter tidak diperkenankan mengubah tagihan yang sudah diproses kasir.';
    }
    if (collection === 'medical_records' && existingItem && existingItem.status === 'locked') {
      return 'Rekam medis sudah disahkan dan dikunci secara permanen.';
    }
    if (method === 'DELETE') {
      return 'Dokter tidak berwenang menghapus data permanen.';
    }
    return null;
  }

  return 'Akses ditolak.';
}

function appendServerAudit(entry: Omit<AuditLog, 'id' | 'createdAt'>) {
  const log: AuditLog = {
    ...entry,
    id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString()
  };
  dbState.audit_logs.unshift(log);
  if (dbState.audit_logs.length > 2000) {
    dbState.audit_logs = dbState.audit_logs.slice(0, 2000);
  }
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  // Health endpoint
  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, e2eeFingerprint: credStore.fingerprint, keyVersion: credStore.keyVersion });
  });

  // Public practice header info (name & logo for login page)
  app.get('/api/public/practice', (_req, res) => {
    const p = dbState.practice_settings[0];
    res.json({
      practiceName: p?.practiceName || 'OBGYN PRACTICE MANAGEMENT SYSTEM',
      doctorName: p?.doctorName || '',
      doctorTitle: p?.doctorTitle || '',
      address: p?.address || '',
      logoUrl: p?.logoUrl || '',
      e2eeEnabled: true,
      e2eeFingerprint: credStore.fingerprint
    });
  });

  // Staff Login (scrypt verification + rate limit + E2EE wrapped key delivery)
  app.post('/api/auth/login', (req, res) => {
    const { username, password } = req.body as { username?: string; password?: string };
    const normUser = String(username || '').trim().toLowerCase();
    const passStr = String(password || '');
    const rateKey = `${req.ip || 'local'}:${normUser}`;

    const attempt = loginAttempts.get(rateKey);
    if (attempt && Date.now() < attempt.resetAt && attempt.count >= MAX_ATTEMPTS) {
      res.status(429).json({
        error: 'Terlalu banyak percobaan login gagal. Coba lagi dalam 15 menit.'
      });
      return;
    }

    if (!normUser || !passStr) {
      res.status(400).json({ error: 'Username dan kata sandi wajib diisi.' });
      return;
    }

    const cred = credStore.credentials[normUser];
    const user = dbState.users.find((u) => u.username.toLowerCase() === normUser);

    if (!cred || !user || !verifyPassword(passStr, cred.passwordSalt, cred.passwordHash)) {
      const nextCount = attempt && Date.now() < attempt.resetAt ? attempt.count + 1 : 1;
      loginAttempts.set(rateKey, { count: nextCount, resetAt: Date.now() + WINDOW_MS });
      res.status(401).json({ error: 'Username atau kata sandi tidak valid.' });
      return;
    }

    if (!user.active) {
      res.status(403).json({ error: 'Akun Anda sedang dinonaktifkan oleh Super Admin.' });
      return;
    }

    loginAttempts.delete(rateKey);
    user.lastLoginAt = new Date().toISOString();

    const exp = Date.now() + 8 * 60 * 60 * 1000;
    const token = signToken({
      userId: user.id,
      username: user.username,
      displayName: user.displayName,
      role: user.role,
      exp
    });

    appendServerAudit({
      userId: user.id,
      userName: user.displayName,
      role: user.role,
      action: 'LOGIN',
      entity: 'auth',
      entityId: user.id,
      afterData: `Login berhasil dengan enkripsi E2EE (Key v${cred.keyVersion})`,
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();

    res.json({
      token,
      user: {
        ...user,
        e2eeSalt: cred.e2eeSalt,
        e2eeWrappedKey: cred.e2eeWrappedKey,
        e2eeFingerprint: cred.e2eeFingerprint
      }
    });
  });

  app.post('/api/auth/logout', requireAuth, (req: AuthedRequest, res) => {
    if (req.session) {
      appendServerAudit({
        userId: req.session.userId,
        userName: req.session.displayName,
        role: req.session.role,
        action: 'LOGOUT',
        entity: 'auth',
        entityId: req.session.userId,
        deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
      });
      saveDb();
    }
    res.json({ ok: true });
  });

  // Super Admin: Create new staff user with automatic E2EE key wrapping
  app.post('/api/auth/users', requireAuth, (req: AuthedRequest, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat membuat akun pengguna.' });
      return;
    }
    const { username, password, displayName, email, role, strNumber, sipNumber } = req.body as {
      username?: string;
      password?: string;
      displayName?: string;
      email?: string;
      role?: RoleCode;
      strNumber?: string;
      sipNumber?: string;
    };
    const normUser = String(username || '').trim().toLowerCase();
    if (!normUser || !/^[a-z0-9._-]{3,40}$/.test(normUser)) {
      res.status(400).json({ error: 'Username harus 3-40 karakter (huruf, angka, titik, garis bawah).' });
      return;
    }
    if (!password || password.length < 6) {
      res.status(400).json({ error: 'Kata sandi minimal 6 karakter.' });
      return;
    }
    if (!displayName || !role || !['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'].includes(role)) {
      res.status(400).json({ error: 'Nama lengkap dan role valid wajib diisi.' });
      return;
    }
    if (credStore.credentials[normUser]) {
      res.status(409).json({ error: 'Username sudah terdaftar.' });
      return;
    }

    const id = `usr-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    const vaultKeyRaw = Buffer.from(credStore.vaultKeyBase64, 'base64');
    const cred = createCredentialEntry(id, normUser, password, vaultKeyRaw, credStore.keyVersion, credStore.fingerprint);
    credStore.credentials[normUser] = cred;

    const nowIso = new Date().toISOString();
    const newUser: UserAccount = {
      id,
      username: normUser,
      displayName: displayName.trim(),
      email: String(email || `${normUser}@klinikspog.id`).trim(),
      role,
      strNumber: strNumber?.trim() || '',
      sipNumber: sipNumber?.trim() || '',
      active: true,
      e2eeSalt: cred.e2eeSalt,
      e2eeWrappedKey: cred.e2eeWrappedKey,
      e2eeFingerprint: cred.e2eeFingerprint,
      createdAt: nowIso,
      createdBy: req.session.userId,
      updatedAt: nowIso,
      updatedBy: req.session.userId
    };
    dbState.users.push(newUser);
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'CREATE_USER',
      entity: 'users',
      entityId: id,
      afterData: `${newUser.username} (${newUser.role}) — Kunci E2EE terpasang`,
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveCreds();
    saveDb();
    res.status(201).json({ user: newUser });
  });

  // Super Admin: Update user status/role/password & re-wrap E2EE key
  app.patch('/api/auth/users/:userId', requireAuth, (req: AuthedRequest, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memperbarui akun pengguna.' });
      return;
    }
    const { userId } = req.params;
    const user = dbState.users.find((u) => u.id === userId);
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const { displayName, email, role, active, newPassword, strNumber, sipNumber } = req.body as {
      displayName?: string;
      email?: string;
      role?: RoleCode;
      active?: boolean;
      newPassword?: string;
      strNumber?: string;
      sipNumber?: string;
    };

    const beforeSummary = `${user.displayName} | ${user.role} | active=${user.active}`;
    if (displayName) user.displayName = displayName.trim();
    if (email) user.email = email.trim();
    if (role && ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'].includes(role) && user.id !== req.session.userId) {
      user.role = role;
    }
    if (typeof active === 'boolean' && user.id !== req.session.userId) {
      user.active = active;
    }
    if (typeof strNumber === 'string') user.strNumber = strNumber.trim();
    if (typeof sipNumber === 'string') user.sipNumber = sipNumber.trim();

    if (newPassword && newPassword.length >= 6) {
      const vaultKeyRaw = Buffer.from(credStore.vaultKeyBase64, 'base64');
      const cred = createCredentialEntry(
        user.id,
        user.username,
        newPassword,
        vaultKeyRaw,
        credStore.keyVersion,
        credStore.fingerprint
      );
      credStore.credentials[user.username.toLowerCase()] = cred;
      user.e2eeSalt = cred.e2eeSalt;
      user.e2eeWrappedKey = cred.e2eeWrappedKey;
      user.e2eeFingerprint = cred.e2eeFingerprint;
      saveCreds();
    }

    user.updatedAt = new Date().toISOString();
    user.updatedBy = req.session.userId;
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'UPDATE_USER',
      entity: 'users',
      entityId: user.id,
      beforeData: beforeSummary,
      afterData: `${user.displayName} | ${user.role} | active=${user.active}`,
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ user });
  });

  // Get full practice state (role-filtered: audit_logs only for Super Admin, finance filtered for Doctor)
  app.get('/api/store/state', requireAuth, (req: AuthedRequest, res) => {
    const role = req.session!.role;
    const responseState: PracticeDatabase = {
      ...dbState,
      audit_logs: role === 'SUPER_ADMIN' ? dbState.audit_logs : [],
      integrations: role === 'SUPER_ADMIN' ? dbState.integrations : [],
      backups: role === 'SUPER_ADMIN' ? dbState.backups : [],
      users:
        role === 'SUPER_ADMIN'
          ? dbState.users
          : dbState.users.map((u) => ({
              ...u,
              e2eeWrappedKey: u.id === req.session!.userId ? u.e2eeWrappedKey : undefined,
              e2eeSalt: u.id === req.session!.userId ? u.e2eeSalt : undefined
            }))
    };
    res.json(responseState);
  });

  // Upsert document in any of the 35 collections with strict server-side RBAC
  app.put('/api/store/:collection/:docId', requireAuth, (req: AuthedRequest, res) => {
    const collection = req.params.collection as CollectionName;
    const docId = String(req.params.docId || '');
    if (!VALID_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: 'Koleksi tidak dikenal.' });
      return;
    }
    if (!/^[a-zA-Z0-9_\-]{1,128}$/.test(docId)) {
      res.status(400).json({ error: 'Format ID dokumen tidak valid.' });
      return;
    }
    const list = dbState[collection] as unknown as Record<string, unknown>[];
    const existingIdx = list.findIndex((item) => item.id === docId);
    const existingItem = existingIdx >= 0 ? list[existingIdx] : undefined;
    const incoming = req.body as Record<string, unknown>;

    const denied = checkCollectionWriteAccess(req.session!.role, collection, 'UPSERT', existingItem, incoming);
    if (denied) {
      res.status(403).json({ error: denied });
      return;
    }

    const nowIso = new Date().toISOString();
    const record: Record<string, unknown> = {
      ...incoming,
      id: docId,
      createdAt: (existingItem?.createdAt as string) || (incoming.createdAt as string) || nowIso,
      createdBy: (existingItem?.createdBy as string) || req.session!.userId,
      updatedAt: nowIso,
      updatedBy: req.session!.userId
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }

    if (collection !== 'audit_logs' && collection !== 'notifications') {
      appendServerAudit({
        userId: req.session!.userId,
        userName: req.session!.displayName,
        role: req.session!.role,
        action: existingIdx >= 0 ? 'UPDATE' : 'CREATE',
        entity: collection,
        entityId: docId,
        beforeData: existingItem ? JSON.stringify(existingItem).slice(0, 260) : undefined,
        afterData: JSON.stringify(record).slice(0, 260),
        deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
      });
    }

    saveDb();
    res.json({ item: record });
  });

  // Delete document in collection (strictly governed by RBAC)
  app.delete('/api/store/:collection/:docId', requireAuth, (req: AuthedRequest, res) => {
    const collection = req.params.collection as CollectionName;
    const docId = String(req.params.docId || '');
    if (!VALID_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: 'Koleksi tidak dikenal.' });
      return;
    }
    const list = dbState[collection] as unknown as Record<string, unknown>[];
    const existingIdx = list.findIndex((item) => item.id === docId);
    if (existingIdx < 0) {
      res.status(404).json({ error: 'Data tidak ditemukan.' });
      return;
    }
    const existingItem = list[existingIdx];
    const denied = checkCollectionWriteAccess(req.session!.role, collection, 'DELETE', existingItem);
    if (denied) {
      res.status(403).json({ error: denied });
      return;
    }
    list.splice(existingIdx, 1);
    appendServerAudit({
      userId: req.session!.userId,
      userName: req.session!.displayName,
      role: req.session!.role,
      action: 'DELETE',
      entity: collection,
      entityId: docId,
      beforeData: JSON.stringify(existingItem).slice(0, 260),
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true });
  });

  // Bulk batch load/clear isolated demo dataset (Super Admin only)
  app.post('/api/store/demo/load', requireAuth, (req: AuthedRequest, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memuat data demonstrasi.' });
      return;
    }
    const payload = req.body as Partial<PracticeDatabase>;
    for (const [colName, items] of Object.entries(payload)) {
      if (!VALID_COLLECTIONS.has(colName as CollectionName) || !Array.isArray(items)) continue;
      const target = dbState[colName as CollectionName] as unknown as Record<string, unknown>[];
      for (const item of items as unknown as Record<string, unknown>[]) {
        const idx = target.findIndex((t) => t.id === item.id);
        if (idx >= 0) target[idx] = item;
        else target.unshift(item);
      }
    }
    saveDb();
    res.json({ ok: true });
  });

  app.post('/api/store/demo/clear', requireAuth, (req: AuthedRequest, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus data demonstrasi.' });
      return;
    }
    for (const colName of VALID_COLLECTIONS) {
      if (colName === 'audit_logs' || colName === 'users' || colName === 'roles' || colName === 'permissions' || colName === 'practice_settings' || colName === 'system_settings' || colName === 'integrations' || colName === 'icd10_codes' || colName === 'services' || colName === 'medicines') {
        continue;
      }
      const list = dbState[colName] as unknown as Record<string, unknown>[];
      (dbState as unknown as Record<string, unknown>)[colName] = list.filter((i) => !i.isDemo);
    }
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'PURGE_DEMO_DATASET',
      entity: 'system',
      afterData: 'Seluruh data demonstrasi terpisah berhasil dibersihkan.',
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true });
  });

  // Restore backup JSON (Super Admin only)
  app.post('/api/store/backup/restore', requireAuth, (req: AuthedRequest, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memulihkan backup database.' });
      return;
    }
    const backup = req.body as Partial<PracticeDatabase>;
    for (const colName of VALID_COLLECTIONS) {
      if (colName === 'users' || colName === 'audit_logs') continue;
      if (Array.isArray(backup[colName])) {
        (dbState as unknown as Record<string, unknown>)[colName] = backup[colName];
      }
    }
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'RESTORE_BACKUP',
      entity: 'backups',
      afterData: 'Database dipulihkan dari snapshot backup.',
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true });
  });

  // Serve Vite in dev or built dist/ in production
  const isProd = process.env.NODE_ENV === 'production' && fs.existsSync(path.resolve(process.cwd(), 'dist', 'index.html'));
  if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa'
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OBGYN Practice Management System running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
