import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const IS_VERCEL = process.env.VERCEL === '1' || Boolean(process.env.VERCEL_ENV);

function resolveWritableDataDir() {
  if (IS_VERCEL) {
    return path.join(os.tmpdir(), 'obgyn-practice-data');
  }
  const preferred = path.resolve(process.cwd(), '.data');
  try {
    if (!fs.existsSync(preferred)) {
      fs.mkdirSync(preferred, { recursive: true });
    }
    fs.accessSync(preferred, fs.constants.W_OK);
    return preferred;
  } catch {
    return path.join(os.tmpdir(), 'obgyn-practice-data');
  }
}

const DATA_DIR = resolveWritableDataDir();
const DB_FILE = path.join(DATA_DIR, 'practice-db.json');
const CRED_FILE = path.join(DATA_DIR, 'auth-credentials.json');

/**
 * Resolve session signing secret:
 * 1. Explicit SESSION_SECRET env var (recommended in Vercel / production Secrets).
 * 2. On Vercel serverless when SESSION_SECRET is unset, derive a per-deployment key
 *    from Vercel runtime deployment metadata so multiple serverless instances of the
 *    same deployment verify Bearer tokens consistently without hardcoding any secret.
 * 3. Local/single-node fallback: cryptographically random 32-byte in-memory key.
 */
function resolveSessionSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16) {
    return process.env.SESSION_SECRET.trim();
  }
  if (IS_VERCEL && process.env.VERCEL_DEPLOYMENT_ID) {
    const material = [
      process.env.VERCEL_DEPLOYMENT_ID,
      process.env.VERCEL_PROJECT_ID || '',
      process.env.VERCEL_GIT_COMMIT_SHA || '',
      process.env.VERCEL_URL || '',
      process.env.SUPERADMIN_PASSWORD || ''
    ].join('|');
    return crypto.createHash('sha256').update(material).digest('hex');
  }
  return crypto.randomBytes(32).toString('hex');
}

const SESSION_SECRET = resolveSessionSecret();

const PERMISSION_CATALOG = [
  { key: 'dashboard.all', module: 'Dashboard', label: 'Lihat seluruh metrik dashboard praktik' },
  { key: 'patients.read', module: 'Pasien', label: 'Melihat data pasien' },
  { key: 'patients.register', module: 'Pasien', label: 'Mendaftarkan & mengedit administrasi pasien' },
  { key: 'patients.delete', module: 'Pasien', label: 'Menghapus/menonaktifkan pasien sesuai retensi' },
  { key: 'visits.manage', module: 'Kunjungan & Antrean', label: 'Kelola pendaftaran kunjungan & antrean' },
  { key: 'vitals.initial', module: 'Kunjungan & Antrean', label: 'Input tanda vital awal pasien' },
  { key: 'rme.read', module: 'Rekam Medis', label: 'Membaca riwayat rekam medis elektronik' },
  { key: 'rme.write', module: 'Rekam Medis', label: 'Mengisi anamnesis, pemeriksaan fisik, obstetri, ginekologi & diagnosis' },
  { key: 'rme.sign_lock', module: 'Rekam Medis', label: 'Menandatangani & mengunci rekam medis dokter' },
  { key: 'pregnancy.manage', module: 'Kehamilan & USG', label: 'Mengelola data kehamilan, ANC & hasil USG' },
  { key: 'procedures.order', module: 'Tindakan Medis', label: 'Mencatat & menginstruksikan tindakan medis' },
  { key: 'procedures.admin', module: 'Tindakan Medis', label: 'Administrasi tindakan sesuai instruksi dokter' },
  { key: 'prescriptions.write', module: 'Resep & Obat', label: 'Membuat & mengesahkan resep obat dokter' },
  { key: 'prescriptions.dispense', module: 'Resep & Obat', label: 'Administrasi resep & penyerahan obat' },
  { key: 'lab.order', module: 'Laboratorium', label: 'Membuat permintaan pemeriksaan laboratorium' },
  { key: 'lab.results', module: 'Laboratorium', label: 'Input & administrasi hasil laboratorium' },
  { key: 'documents.medical', module: 'Dokumen', label: 'Membuat surat keterangan medis & surat rujukan' },
  { key: 'schedule.manage', module: 'Jadwal & Kontrol', label: 'Mengatur jadwal praktik & pengingat kontrol' },
  { key: 'cashier.operate', module: 'Kasir & Keuangan', label: 'Mengelola tagihan, kasir, kuitansi, piutang & kas harian' },
  { key: 'cashier.refund_approve', module: 'Kasir & Keuangan', label: 'Menyetujui pengembalian dana (refund)' },
  { key: 'reports.medical', module: 'Laporan', label: 'Mengakses laporan pelayanan & statistik medis' },
  { key: 'reports.finance', module: 'Laporan', label: 'Mengakses laporan keuangan & transaksi' },
  { key: 'settings.practice', module: 'Pengaturan', label: 'Mengubah identitas praktik, tarif & template dokumen' },
  { key: 'settings.users', module: 'Pengaturan', label: 'Mengelola akun pengguna, role & hak akses' },
  { key: 'settings.security', module: 'Pengaturan', label: 'Mengakses audit log, integrasi API, E2EE & backup' }
];

const DEFAULT_ROLE_PERMISSIONS = {
  SUPER_ADMIN: PERMISSION_CATALOG.map((p) => p.key),
  DOKTER_SPOG: [
    'patients.read',
    'visits.manage',
    'vitals.initial',
    'rme.read',
    'rme.write',
    'rme.sign_lock',
    'pregnancy.manage',
    'procedures.order',
    'prescriptions.write',
    'lab.order',
    'lab.results',
    'documents.medical',
    'reports.medical'
  ],
  ASISTEN_DOKTER: [
    'patients.read',
    'patients.register',
    'visits.manage',
    'vitals.initial',
    'rme.read',
    'procedures.admin',
    'prescriptions.dispense',
    'lab.results',
    'schedule.manage',
    'cashier.operate',
    'reports.finance'
  ]
};

function createEmptyServerDatabase() {
  const NOW = new Date().toISOString();
  const icdRows = [
    ['Z34.0', 'Supervisi kehamilan normal pertama (ANC Primigravida)', 'Obstetri'],
    ['Z34.8', 'Supervisi kehamilan normal lainnya (ANC Multigravida)', 'Obstetri'],
    ['O20.0', 'Abortus imminens (Threatened abortion)', 'Obstetri'],
    ['O21.0', 'Hiperemesis gravidarum ringan', 'Obstetri'],
    ['O14.0', 'Preeklampsia ringan sampai sedang', 'Obstetri'],
    ['O14.1', 'Preeklampsia berat', 'Obstetri'],
    ['O24.4', 'Diabetes melitus gestasional dalam kehamilan', 'Obstetri'],
    ['O42.9', 'Ketuban pecah dini (KPD), tidak spesifik', 'Obstetri'],
    ['O44.1', 'Plasenta previa dengan perdarahan', 'Obstetri'],
    ['O80.0', 'Persalinan tunggal spontan presentasi kepala', 'Obstetri'],
    ['O99.0', 'Anemia yang menyulitkan kehamilan', 'Obstetri'],
    ['N80.0', 'Endometriosis uterus (Adenomiosis)', 'Ginekologi'],
    ['D25.9', 'Leiomioma uterus (Mioma uteri), tidak spesifik', 'Ginekologi'],
    ['E28.2', 'Sindrom ovarium polikistik (PCOS)', 'Ginekologi'],
    ['N83.2', 'Kista ovarium lainnya dan tidak spesifik', 'Ginekologi'],
    ['N76.0', 'Vaginitis akut / Keputihan patologis', 'Ginekologi'],
    ['N92.0', 'Menstruasi berlebihan dan sering dengan siklus teratur', 'Ginekologi'],
    ['Z30.0', 'Konseling umum dan edukasi kontrasepsi (KB)', 'Keluarga Berencana']
  ];

  const serviceRows = [
    ['SRV-KONSUL', 'Konsultasi Dokter Spesialis Sp.OG', 'Konsultasi', 250000, 20, 'Konsultasi klinis obstetri/ginekologi bersama dokter Sp.OG'],
    ['SRV-ANC', 'Pemeriksaan Antenatal Care (ANC)', 'Obstetri', 200000, 20, 'Pemeriksaan rutin kehamilan lengkap (TFU, DJJ, Leopold, edukasi)'],
    ['SRV-USG2D', 'USG Obstetri / Ginekologi 2D', 'USG', 250000, 15, 'Ultrasonografi biometri 2D dengan cetak laporan USG'],
    ['SRV-USG4D', 'USG Fetomaternal 3D/4D HD Live', 'USG', 550000, 30, 'Ultrasonografi skrining detail anatomi janin 3D/4D'],
    ['SRV-USGTV', 'USG Transvaginal', 'USG', 325000, 20, 'Pemeriksaan ultrasonografi transvaginal ginekologi / kehamilan awal'],
    ['SRV-GIN', 'Pemeriksaan Ginekologi Inspekulo & Bimanual', 'Ginekologi', 225000, 20, 'Evaluasi klinis organ reproduksi dan serviks'],
    ['SRV-PAP', 'Tindakan Pap Smear (LBC)', 'Tindakan', 375000, 20, 'Pengambilan sampel sitologi serviks untuk skrining dini'],
    ['SRV-IVA', 'Pemeriksaan IVA Test', 'Tindakan', 150000, 15, 'Inspeksi Visual Asam Asetat skrining serviks'],
    ['SRV-IUD-IN', 'Pemasangan Kontrasepsi IUD', 'Tindakan', 650000, 30, 'Pemasangan AKDR steril termasuk kontrol posisi USG'],
    ['SRV-IUD-OUT', 'Pelepasan Kontrasepsi IUD', 'Tindakan', 300000, 15, 'Pelepasan AKDR steril dengan evaluasi klinis'],
    ['SRV-ADM', 'Biaya Administrasi & Rekam Medis', 'Administrasi', 35000, 5, 'Biaya administrasi kunjungan rawat jalan']
  ];

  const medRows = [
    ['OBT-001', 'Folamil Genio', 'Asam Folat + DHA + Multivitamin', 'Dexa Medica', 'Kapsul Lunak', '1000 mcg', 'Kapsul', 5500, 180, '2027-08-31'],
    ['OBT-002', 'Ferrous Sulfate 200mg', 'Ferrous Sulfate', 'Generik', 'Tablet Salut', '200 mg', 'Tablet', 1500, 240, '2027-06-30'],
    ['OBT-003', 'Calcium Lactate 500mg', 'Calcium Lactate', 'Generik', 'Tablet', '500 mg', 'Tablet', 1200, 300, '2027-10-31'],
    ['OBT-004', 'Utrogestan 200mg', 'Micronized Progesterone', 'Besins', 'Kapsul Lunak', '200 mg', 'Kapsul', 28000, 90, '2027-04-30'],
    ['OBT-005', 'Duphaston 10mg', 'Dydrogesterone', 'Abbott', 'Tablet', '10 mg', 'Tablet', 24500, 110, '2027-09-30'],
    ['OBT-006', 'Nifedipine 10mg', 'Nifedipine', 'Generik', 'Tablet', '10 mg', 'Tablet', 1800, 140, '2027-05-31'],
    ['OBT-007', 'Methyldopa 250mg', 'Methyldopa', 'Dopamet', 'Tablet', '250 mg', 'Tablet', 4200, 120, '2027-07-31'],
    ['OBT-008', 'Asam Mefenamat 500mg', 'Asam Mefenamat', 'Generik', 'Kaplet', '500 mg', 'Kaplet', 1500, 200, '2027-11-30'],
    ['OBT-009', 'Amoxicillin 500mg', 'Amoxicillin', 'Generik', 'Kaplet', '500 mg', 'Kaplet', 2500, 160, '2027-03-31'],
    ['OBT-010', 'Metronidazole Ovula 500mg', 'Metronidazole', 'Flagystatin', 'Ovula', '500 mg', 'Ovula', 22000, 48, '2027-06-15']
  ];

  return {
    users: [],
    roles: [
      {
        id: 'role-super-admin',
        code: 'SUPER_ADMIN',
        name: 'Super Admin',
        description: 'Kewenangan penuh terhadap manajemen sistem, pengguna, hak akses, tarif, keuangan, backup, dan audit log.',
        permissions: DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN,
        active: true,
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      },
      {
        id: 'role-dokter',
        code: 'DOKTER_SPOG',
        name: 'Dokter Sp.OG',
        description: 'Kewenangan penuh pelayanan medis, RME, obstetri, ginekologi, kehamilan, USG, resep, surat keterangan & rujukan.',
        permissions: DEFAULT_ROLE_PERMISSIONS.DOKTER_SPOG,
        active: true,
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      },
      {
        id: 'role-asisten',
        code: 'ASISTEN_DOKTER',
        name: 'Asisten Dokter',
        description: 'Kewenangan pendaftaran pasien, antrean, tanda vital awal, administrasi resep/lab, jadwal kontrol, kasir & keuangan harian.',
        permissions: DEFAULT_ROLE_PERMISSIONS.ASISTEN_DOKTER,
        active: true,
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      }
    ],
    permissions: PERMISSION_CATALOG.map((p) => ({
      id: `perm-${p.key.replace('.', '-')}`,
      key: p.key,
      module: p.module,
      label: p.label,
      active: true,
      createdAt: NOW,
      createdBy: 'system',
      updatedAt: NOW,
      updatedBy: 'system'
    })),
    practice_settings: [
      {
        id: 'main',
        practiceName: 'OBGYN PRACTICE MANAGEMENT SYSTEM',
        doctorName: 'dr. Kartika Wulandari',
        doctorTitle: 'Sp.OG (K)',
        strNumber: '31.2.1.301.4.23.189402',
        sipNumber: '446/SIP-SpOG/2025/0142',
        address: 'Jl. Kesehatan Raya No. 48, Kebayoran Baru, Jakarta Selatan 12160',
        phone: '(021) 720-4891 / 0811-9482-001',
        email: 'praktik.obgyn@klinikspog.id',
        logoUrl: '/src/assets/images/practice_logo_mark_1795522062108.jpg',
        operationalHours: 'Senin - Jumat: 09:00 - 20:00 WIB | Sabtu: 09:00 - 15:00 WIB',
        rmFormat: 'RM',
        visitFormat: 'VIS',
        invoiceFormat: 'INV',
        receiptFormat: 'KWT',
        rxFormat: 'RX',
        taxRatePercent: 0,
        defaultDiscountPercent: 0,
        active: true,
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      }
    ],
    patients: [],
    patient_contacts: [],
    visits: [],
    queues: [],
    medical_records: [],
    medical_record_versions: [],
    pregnancies: [],
    antenatal_visits: [],
    ultrasound_records: [],
    diagnoses: [],
    icd10_codes: icdRows.map(([code, name, category]) => ({
      id: `icd-${code.replace('.', '-')}`,
      code,
      name,
      category,
      active: true,
      createdAt: NOW,
      createdBy: 'system',
      updatedAt: NOW,
      updatedBy: 'system'
    })),
    procedures: [],
    services: serviceRows.map(([code, name, category, price, durationMinutes, description]) => ({
      id: `srv-${String(code).toLowerCase()}`,
      code,
      name,
      category,
      price,
      durationMinutes,
      description,
      active: true,
      createdAt: NOW,
      createdBy: 'system',
      updatedAt: NOW,
      updatedBy: 'system'
    })),
    medicines: medRows.map(([code, name, genericName, brand, dosageForm, strength, unit, price, stock, expiryDate]) => ({
      id: `med-${String(code).toLowerCase()}`,
      code,
      name,
      genericName,
      brand,
      dosageForm,
      strength,
      unit,
      price,
      stock,
      expiryDate,
      active: true,
      createdAt: NOW,
      createdBy: 'system',
      updatedAt: NOW,
      updatedBy: 'system'
    })),
    prescriptions: [],
    laboratory_orders: [],
    laboratory_results: [],
    invoices: [],
    invoice_items: [],
    payments: [],
    refunds: [],
    cash_sessions: [],
    cash_transactions: [],
    expenses: [],
    appointments: [],
    documents: [],
    notifications: [],
    audit_logs: [],
    system_settings: [
      {
        id: 'main',
        passwordMinLength: 8,
        sessionTimeoutMinutes: 60,
        maxLoginAttempts: 5,
        dataRetentionYears: 5,
        autoBackupEnabled: true,
        e2eeRequired: true,
        e2eeKeyVersion: 1,
        e2eeKeyFingerprint: 'INISIALISASI',
        scheduleSlots: [
          { dayOfWeek: 'Senin', startTime: '09:00', endTime: '14:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 20, active: true },
          { dayOfWeek: 'Senin', startTime: '16:00', endTime: '20:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 15, active: true },
          { dayOfWeek: 'Selasa', startTime: '09:00', endTime: '14:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 20, active: true },
          { dayOfWeek: 'Rabu', startTime: '09:00', endTime: '15:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 20, active: true },
          { dayOfWeek: 'Kamis', startTime: '15:00', endTime: '20:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 18, active: true },
          { dayOfWeek: 'Jumat', startTime: '09:00', endTime: '14:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 18, active: true },
          { dayOfWeek: 'Sabtu', startTime: '09:00', endTime: '15:00', doctorId: 'usr-dokter', doctorName: 'dr. Kartika Wulandari, Sp.OG (K)', quota: 25, active: true }
        ],
        templates: {
          kuitansiFooter: 'Terima kasih atas kepercayaan Anda. Kuitansi ini merupakan bukti pembayaran sah dari praktik dokter spesialis.',
          resepHeaderNote: 'Resep elektronik sah sesuai Permenkes No. 24 Tahun 2022. Tidak dapat digandakan tanpa verifikasi dokter.',
          usgDisclaimer: 'Hasil pemeriksaan ultrasonografi merupakan interpretasi klinis pada saat pemeriksaan dilakukan dan perlu dikorelasikan dengan kondisi klinis pasien.',
          suratKeteranganBody: 'Berdasarkan hasil pemeriksaan medis obstetri dan ginekologi yang telah dilakukan, yang bersangkutan dinyatakan dalam kondisi sesuai keterangan klinis di bawah ini.',
          suratRujukanHeader: 'Kepada Yth. Rekan Sejawat Dokter Spesialis / Instalasi Gawat Darurat Rumah Sakit Rujukan',
          laporanFooter: 'Dokumen Rahasia Medis & Operasional — Dilindungi UU No. 27 Tahun 2022 tentang Pelindungan Data Pribadi.'
        },
        active: true,
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      }
    ],
    integrations: [
      {
        id: 'int-satusehat',
        provider: 'SATUSEHAT_FHIR',
        name: 'SATUSEHAT Kemenkes RI (HL7 FHIR R4)',
        endpointUrl: 'https://api-satusehat-stg.dto.kemkes.go.id/fhir-r4/v1',
        organizationId: 'ORG-SPOG-STAGING-001',
        clientId: '',
        enabled: false,
        statusNote: 'Siap dikembangkan & diintegrasikan (mode staging — belum tersertifikasi produksi sebelum verifikasi Kemenkes).',
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      },
      {
        id: 'int-whatsapp',
        provider: 'WHATSAPP_API',
        name: 'WhatsApp Business Official API (Pengingat Kontrol)',
        endpointUrl: 'https://graph.facebook.com/v20.0',
        senderNumber: '+628119482001',
        enabled: false,
        statusNote: 'Integrasi pengingat jadwal ANC & kontrol ulang otomatis saat kredensial penyedia API resmi aktif.',
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      },
      {
        id: 'int-firebase',
        provider: 'FIREBASE_CLOUD',
        name: 'Firebase Cloud Firestore & Authentication',
        endpointUrl: 'firestore.googleapis.com',
        enabled: true,
        statusNote: 'Database Cloud Firestore & Security Rules aktif; hubungkan akun Google untuk sinkronisasi cloud langsung.',
        createdAt: NOW,
        createdBy: 'system',
        updatedAt: NOW,
        updatedBy: 'system'
      }
    ],
    backups: []
  };
}

const VALID_COLLECTIONS = new Set(Object.keys(createEmptyServerDatabase()));
const loginAttempts = new Map();
const MAX_ATTEMPTS = 8;
const WINDOW_MS = 15 * 60 * 1000;

function ensureDataDir() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    return true;
  } catch {
    return false;
  }
}

function hashPassword(password, saltHex) {
  const salt = saltHex || crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return { salt, hash: derived };
}

function verifyPassword(password, salt, expectedHash) {
  const actual = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

/**
 * Derive a 256-bit AES-GCM KEK using PBKDF2-SHA256 (100,000 iterations) — matches browser Web Crypto subtle.deriveKey.
 */
function wrapVaultKeyNode(vaultKeyRaw, passphrase, saltBase64) {
  const saltBuf = Buffer.from(saltBase64, 'base64');
  const kek = crypto.pbkdf2Sync(passphrase, saltBuf, 100000, 32, 'sha256');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', kek, iv);
  const encrypted = Buffer.concat([cipher.update(vaultKeyRaw), cipher.final()]);
  const tag = cipher.getAuthTag();
  const wrapped = Buffer.concat([encrypted, tag]);
  return JSON.stringify({
    iv: iv.toString('base64'),
    wrapped: wrapped.toString('base64')
  });
}

function computeFingerprintNode(rawKey) {
  const digest = crypto.createHash('sha256').update(rawKey).digest();
  return Array.from(digest.subarray(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(':')
    .toUpperCase();
}

function signToken(payload) {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyToken(token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expected = crypto.createHmac('sha256', SESSION_SECRET).update(encoded).digest('base64url');
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (Date.now() > parsed.exp) return null;
    return parsed;
  } catch {
    return null;
  }
}

let dbState;
let credStore;
let initialized = false;

function saveDb() {
  try {
    if (!ensureDataDir()) return;
    fs.writeFileSync(DB_FILE, JSON.stringify(dbState, null, 2), 'utf8');
  } catch {
    // Safe in-memory fallback when serverless filesystem is unavailable
  }
}

function saveCreds() {
  try {
    if (!ensureDataDir()) return;
    fs.writeFileSync(CRED_FILE, JSON.stringify(credStore, null, 2), 'utf8');
  } catch {
    // Safe in-memory fallback when serverless filesystem is unavailable
  }
}

function createCredentialEntry(userId, username, plainPassword, vaultKeyRaw, keyVersion, fingerprint) {
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
  if (initialized) return;
  ensureDataDir();
  const superAdminUser = (process.env.SUPERADMIN_USERNAME || 'superman').trim().toLowerCase();
  const superAdminPass = process.env.SUPERADMIN_PASSWORD || 'superman123';

  if (fs.existsSync(CRED_FILE)) {
    try {
      credStore = JSON.parse(fs.readFileSync(CRED_FILE, 'utf8'));
    } catch {
      credStore = undefined;
    }
  }
  if (!credStore) {
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
    try {
      dbState = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    } catch {
      dbState = createEmptyServerDatabase();
    }
  } else {
    dbState = createEmptyServerDatabase();
  }

  if (dbState.system_settings && dbState.system_settings[0]) {
    dbState.system_settings[0].e2eeKeyFingerprint = credStore.fingerprint;
    dbState.system_settings[0].e2eeKeyVersion = credStore.keyVersion;
  }

  const nowIso = new Date().toISOString();
  const bootstrapSpecs = [
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
      dbState.users.push({
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
      });
      changed = true;
    }
  }

  if (process.env.SUPERADMIN_PASSWORD && credStore.credentials[superAdminUser]) {
    if (
      !verifyPassword(
        superAdminPass,
        credStore.credentials[superAdminUser].passwordSalt,
        credStore.credentials[superAdminUser].passwordHash
      )
    ) {
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
  initialized = true;
}

function requireAuth(req, res, next) {
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

function buildFilteredState(role, userId) {
  return {
    ...dbState,
    audit_logs: role === 'SUPER_ADMIN' ? dbState.audit_logs : [],
    integrations: role === 'SUPER_ADMIN' ? dbState.integrations : [],
    backups: role === 'SUPER_ADMIN' ? dbState.backups : [],
    users:
      role === 'SUPER_ADMIN'
        ? dbState.users
        : dbState.users.map((u) => ({
            ...u,
            e2eeWrappedKey: u.id === userId ? u.e2eeWrappedKey : undefined,
            e2eeSalt: u.id === userId ? u.e2eeSalt : undefined
          }))
  };
}

function checkCollectionWriteAccess(role, collection, method, existingItem, incomingItem) {
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

  const superAdminOnly = [
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
    const medicalOnly = [
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
    const financeOnly = ['payments', 'refunds', 'cash_sessions', 'cash_transactions', 'expenses'];
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

function appendServerAudit(entry) {
  dbState.audit_logs.unshift({
    ...entry,
    id: `aud-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`,
    createdAt: new Date().toISOString()
  });
  if (dbState.audit_logs.length > 2000) {
    dbState.audit_logs = dbState.audit_logs.slice(0, 2000);
  }
}

export function createApiApp() {
  initStorage();
  const app = express();
  app.set('trust proxy', 1);

  const jsonParser = express.json({ limit: '12mb' });
  app.use((req, res, next) => {
    if (typeof req.body === 'string' && req.body.trim().startsWith('{')) {
      try {
        req.body = JSON.parse(req.body);
        next();
        return;
      } catch {
        // Fall through to jsonParser
      }
    }
    if (req.readableEnded || (req.body && typeof req.body === 'object' && Object.keys(req.body).length > 0)) {
      next();
      return;
    }
    jsonParser(req, res, next);
  });

  const router = express.Router();

  router.get('/health', (_req, res) => {
    res.json({
      ok: true,
      runtime: IS_VERCEL ? 'vercel-serverless' : 'node-server',
      e2eeFingerprint: credStore.fingerprint,
      keyVersion: credStore.keyVersion
    });
  });

  router.get('/public/practice', (_req, res) => {
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

  router.post('/auth/login', (req, res) => {
    const { username, password } = req.body || {};
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
      },
      initialState: buildFilteredState(user.role, user.id)
    });
  });

  router.post('/auth/logout', requireAuth, (req, res) => {
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

  router.post('/auth/users', requireAuth, (req, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat membuat akun pengguna.' });
      return;
    }
    const { username, password, displayName, email, role, strNumber, sipNumber, signatureUrl } = req.body || {};
    const normUser = String(username || '').trim().toLowerCase();
    if (!normUser || !/^[a-z0-9._-]{3,40}$/.test(normUser)) {
      res.status(400).json({ error: 'Username harus 3-40 karakter (huruf, angka, titik, garis bawah).' });
      return;
    }
    if (!password || String(password).length < 6) {
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
    const cred = createCredentialEntry(id, normUser, String(password), vaultKeyRaw, credStore.keyVersion, credStore.fingerprint);
    credStore.credentials[normUser] = cred;

    const nowIso = new Date().toISOString();
    const newUser = {
      id,
      username: normUser,
      displayName: String(displayName).trim(),
      email: String(email || `${normUser}@klinikspog.id`).trim(),
      role,
      strNumber: strNumber ? String(strNumber).trim() : '',
      sipNumber: sipNumber ? String(sipNumber).trim() : '',
      signatureUrl: typeof signatureUrl === 'string' ? signatureUrl : '',
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

  router.patch('/auth/users/:userId', requireAuth, (req, res) => {
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
    const { username, displayName, email, role, active, newPassword, strNumber, sipNumber, signatureUrl } = req.body || {};

    const beforeSummary = `${user.username} | ${user.displayName} | ${user.role} | active=${user.active}`;
    const prevUsername = user.username.toLowerCase();
    if (username && String(username).trim().toLowerCase() !== prevUsername) {
      const nextUsername = String(username).trim().toLowerCase();
      if (!/^[a-z0-9._-]{3,40}$/.test(nextUsername)) {
        res.status(400).json({ error: 'Username harus 3-40 karakter (huruf, angka, titik, garis bawah).' });
        return;
      }
      if (credStore.credentials[nextUsername]) {
        res.status(409).json({ error: 'Username baru sudah digunakan oleh akun lain.' });
        return;
      }
      if (credStore.credentials[prevUsername]) {
        credStore.credentials[nextUsername] = {
          ...credStore.credentials[prevUsername],
          username: nextUsername
        };
        delete credStore.credentials[prevUsername];
        saveCreds();
      }
      user.username = nextUsername;
    }
    if (displayName) user.displayName = String(displayName).trim();
    if (typeof email === 'string') user.email = email.trim();
    if (role && ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'].includes(role) && user.id !== req.session.userId) {
      user.role = role;
    }
    if (typeof active === 'boolean' && user.id !== req.session.userId) {
      user.active = active;
    }
    if (typeof strNumber === 'string') user.strNumber = strNumber.trim();
    if (typeof sipNumber === 'string') user.sipNumber = sipNumber.trim();
    if (typeof signatureUrl === 'string') user.signatureUrl = signatureUrl;

    if (newPassword && String(newPassword).length >= 6) {
      const vaultKeyRaw = Buffer.from(credStore.vaultKeyBase64, 'base64');
      const cred = createCredentialEntry(
        user.id,
        user.username,
        String(newPassword),
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
      afterData: `${user.username} | ${user.displayName} | ${user.role} | active=${user.active}`,
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ user });
  });

  router.patch('/auth/me/signature', requireAuth, (req, res) => {
    const user = dbState.users.find((u) => u.id === req.session.userId);
    if (!user) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const { signatureUrl } = req.body || {};
    if (typeof signatureUrl !== 'string' || signatureUrl.length > 350000) {
      res.status(400).json({ error: 'Format tanda tangan tidak valid atau ukuran melebihi batas.' });
      return;
    }
    user.signatureUrl = signatureUrl;
    user.updatedAt = new Date().toISOString();
    user.updatedBy = req.session.userId;
    saveDb();
    res.json({ user });
  });

  router.delete('/auth/users/:userId', requireAuth, (req, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus akun pengguna.' });
      return;
    }
    const { userId } = req.params;
    if (userId === req.session.userId) {
      res.status(400).json({ error: 'Anda tidak dapat menghapus akun Anda sendiri yang sedang aktif.' });
      return;
    }
    const idx = dbState.users.findIndex((u) => u.id === userId);
    if (idx < 0) {
      res.status(404).json({ error: 'Pengguna tidak ditemukan.' });
      return;
    }
    const removed = dbState.users[idx];
    dbState.users.splice(idx, 1);
    const normUser = String(removed.username || '').toLowerCase();
    if (credStore.credentials[normUser]) {
      delete credStore.credentials[normUser];
      saveCreds();
    }
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'DELETE_USER',
      entity: 'users',
      entityId: removed.id,
      beforeData: `${removed.username} | ${removed.displayName} | ${removed.role}`,
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true, deletedId: removed.id, deletedEmail: removed.email || '' });
  });

  router.get('/store/state', requireAuth, (req, res) => {
    res.json(buildFilteredState(req.session.role, req.session.userId));
  });

  router.put('/store/:collection/:docId', requireAuth, (req, res) => {
    const collection = req.params.collection;
    const docId = String(req.params.docId || '');
    if (!VALID_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: 'Koleksi tidak dikenal.' });
      return;
    }
    if (!/^[a-zA-Z0-9_\-]{1,128}$/.test(docId)) {
      res.status(400).json({ error: 'Format ID dokumen tidak valid.' });
      return;
    }
    const list = dbState[collection];
    const existingIdx = list.findIndex((item) => item.id === docId);
    const existingItem = existingIdx >= 0 ? list[existingIdx] : undefined;
    const incoming = req.body || {};

    const denied = checkCollectionWriteAccess(req.session.role, collection, 'UPSERT', existingItem, incoming);
    if (denied) {
      res.status(403).json({ error: denied });
      return;
    }

    const nowIso = new Date().toISOString();
    const record = {
      ...incoming,
      id: docId,
      createdAt: existingItem?.createdAt || incoming.createdAt || nowIso,
      createdBy: existingItem?.createdBy || req.session.userId,
      updatedAt: nowIso,
      updatedBy: req.session.userId
    };

    if (existingIdx >= 0) {
      list[existingIdx] = record;
    } else {
      list.unshift(record);
    }

    if (collection !== 'audit_logs' && collection !== 'notifications') {
      appendServerAudit({
        userId: req.session.userId,
        userName: req.session.displayName,
        role: req.session.role,
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

  router.delete('/store/:collection/:docId', requireAuth, (req, res) => {
    const collection = req.params.collection;
    const docId = String(req.params.docId || '');
    if (!VALID_COLLECTIONS.has(collection)) {
      res.status(400).json({ error: 'Koleksi tidak dikenal.' });
      return;
    }
    const list = dbState[collection];
    const existingIdx = list.findIndex((item) => item.id === docId);
    if (existingIdx < 0) {
      res.status(404).json({ error: 'Data tidak ditemukan.' });
      return;
    }
    const existingItem = list[existingIdx];
    const denied = checkCollectionWriteAccess(req.session.role, collection, 'DELETE', existingItem);
    if (denied) {
      res.status(403).json({ error: denied });
      return;
    }
    list.splice(existingIdx, 1);
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'DELETE',
      entity: collection,
      entityId: docId,
      beforeData: JSON.stringify(existingItem).slice(0, 260),
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true });
  });

  router.post('/store/demo/load', requireAuth, (req, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memuat data demonstrasi.' });
      return;
    }
    const payload = req.body || {};
    for (const [colName, items] of Object.entries(payload)) {
      if (!VALID_COLLECTIONS.has(colName) || !Array.isArray(items)) continue;
      const target = dbState[colName];
      for (const item of items) {
        const idx = target.findIndex((t) => t.id === item.id);
        if (idx >= 0) target[idx] = item;
        else target.unshift(item);
      }
    }
    appendServerAudit({
      userId: req.session.userId,
      userName: req.session.displayName,
      role: req.session.role,
      action: 'LOAD_DEMO_DATASET',
      entity: 'system',
      afterData: 'Dataset demonstrasi terpisah dimuat.',
      deviceInfo: String(req.headers['user-agent'] || 'Web Client').slice(0, 120)
    });
    saveDb();
    res.json({ ok: true });
  });

  router.post('/store/demo/clear', requireAuth, (req, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat menghapus data demonstrasi.' });
      return;
    }
    for (const colName of VALID_COLLECTIONS) {
      if (
        colName === 'audit_logs' ||
        colName === 'users' ||
        colName === 'roles' ||
        colName === 'permissions' ||
        colName === 'practice_settings' ||
        colName === 'system_settings' ||
        colName === 'integrations' ||
        colName === 'icd10_codes' ||
        colName === 'services' ||
        colName === 'medicines'
      ) {
        continue;
      }
      dbState[colName] = dbState[colName].filter((i) => !i.isDemo);
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

  router.post('/store/backup/restore', requireAuth, (req, res) => {
    if (req.session?.role !== 'SUPER_ADMIN') {
      res.status(403).json({ error: 'Hanya Super Admin yang dapat memulihkan backup database.' });
      return;
    }
    const backup = req.body || {};
    for (const colName of VALID_COLLECTIONS) {
      if (colName === 'users' || colName === 'audit_logs') continue;
      if (Array.isArray(backup[colName])) {
        dbState[colName] = backup[colName];
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

  app.use('/api', router);
  app.use('/', router);

  // Structured JSON error handler so API routes never leak raw HTML 500 pages
  app.use((err, _req, res, _next) => {
    console.error('API runtime error:', err);
    res.status(500).json({ error: 'Terjadi kesalahan internal pada server API.' });
  });

  return app;
}
