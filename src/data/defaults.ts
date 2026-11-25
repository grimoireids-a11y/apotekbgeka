import type {
  Icd10Code,
  IntegrationConfig,
  LabTestCatalogItem,
  Medicine,
  PracticeDatabase,
  PracticeSettings,
  RoleDefinition,
  ServiceTariff,
  SystemSettings
} from '../types/models';
import { DEFAULT_ROLE_PERMISSIONS, PERMISSION_CATALOG } from '../utils/rbac';

const NOW = new Date().toISOString();

export const DEFAULT_LOGO_PATH = '/src/assets/images/practice_logo_mark_1795522062108.jpg';
export const DEFAULT_HERO_PATH = '/src/assets/images/clinic_hero_interior_1795522061943.jpg';

export const LAB_TEST_CATALOG: LabTestCatalogItem[] = [
  { code: 'LAB-HB', name: 'Hemoglobin (Hb)', category: 'Hematologi', unit: 'g/dL', referenceRange: '11.0 - 15.0 (Ibu Hamil >= 11.0)', price: 55000 },
  { code: 'LAB-GOLDAR', name: 'Golongan Darah & Rhesus', category: 'Imunohematologi', unit: 'ABO/Rh', referenceRange: 'A / B / AB / O (Rh +/-)', price: 45000 },
  { code: 'LAB-GDS', name: 'Gula Darah Sewaktu (GDS)', category: 'Kimia Klinik', unit: 'mg/dL', referenceRange: '< 140', price: 50000 },
  { code: 'LAB-TTGO', name: 'Tes Toleransi Glukosa Oral (TTGO)', category: 'Kimia Klinik', unit: 'mg/dL', referenceRange: 'Puasa < 92; 2 jam < 153', price: 110000 },
  { code: 'LAB-URIN', name: 'Urinalisis Lengkap & Protein Urin', category: 'Urinalisis', unit: 'Kualitatif', referenceRange: 'Protein Negatif, Leukosit < 5/LPB', price: 65000 },
  { code: 'LAB-HBSAG', name: 'HBsAg Rapid / ELISA', category: 'Serologi', unit: 'Kualitatif', referenceRange: 'Non-Reaktif', price: 95000 },
  { code: 'LAB-HIV', name: 'Anti-HIV Screening (Triple Eliminasi)', category: 'Serologi', unit: 'Kualitatif', referenceRange: 'Non-Reaktif', price: 120000 },
  { code: 'LAB-SIFILIS', name: 'Sifilis (VDRL / TPHA)', category: 'Serologi', unit: 'Kualitatif', referenceRange: 'Non-Reaktif', price: 95000 },
  { code: 'LAB-PAPSMEAR', name: 'Sitologi Pap Smear (LBC)', category: 'Patologi Anatomi', unit: 'Bethesda', referenceRange: 'NILM (Negatif lesi intraepitel)', price: 325000 }
];

export function createDefaultPracticeSettings(): PracticeSettings {
  return {
    id: 'main',
    practiceName: 'OBGYN PRACTICE MANAGEMENT SYSTEM',
    doctorName: 'dr. Kartika Wulandari',
    doctorTitle: 'Sp.OG (K)',
    strNumber: '31.2.1.301.4.23.189402',
    sipNumber: '446/SIP-SpOG/2025/0142',
    address: 'Jl. Kesehatan Raya No. 48, Kebayoran Baru, Jakarta Selatan 12160',
    phone: '(021) 720-4891 / 0811-9482-001',
    email: 'praktik.obgyn@klinikspog.id',
    logoUrl: DEFAULT_LOGO_PATH,
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
  };
}

export function createDefaultRoles(): RoleDefinition[] {
  return [
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
  ];
}

export function createDefaultIcd10(): Icd10Code[] {
  const list: [string, string, string][] = [
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
  return list.map(([code, name, category]) => ({
    id: `icd-${code.replace('.', '-')}`,
    code,
    name,
    category,
    active: true,
    createdAt: NOW,
    createdBy: 'system',
    updatedAt: NOW,
    updatedBy: 'system'
  }));
}

export function createDefaultServices(): ServiceTariff[] {
  const rows: [string, string, ServiceTariff['category'], number, number, string][] = [
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
  return rows.map(([code, name, category, price, durationMinutes, description]) => ({
    id: `srv-${code.toLowerCase()}`,
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
  }));
}

export function createDefaultMedicines(): Medicine[] {
  const meds: [string, string, string, string, string, string, string, number, number, string][] = [
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
  return meds.map(([code, name, genericName, brand, dosageForm, strength, unit, price, stock, expiryDate]) => ({
    id: `med-${code.toLowerCase()}`,
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
  }));
}

export function createDefaultSystemSettings(): SystemSettings {
  return {
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
  };
}

export function createDefaultIntegrations(): IntegrationConfig[] {
  return [
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
  ];
}

export function createEmptyDatabase(): PracticeDatabase {
  return {
    users: [],
    access_requests: [],
    roles: createDefaultRoles(),
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
    practice_settings: [createDefaultPracticeSettings()],
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
    icd10_codes: createDefaultIcd10(),
    procedures: [],
    services: createDefaultServices(),
    medicines: createDefaultMedicines(),
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
    system_settings: [createDefaultSystemSettings()],
    integrations: createDefaultIntegrations(),
    backups: []
  };
}

/**
 * Isolated demonstration dataset (tagged with `isDemo: true`) strictly separated from permanent production data.
 * Can be loaded or purged cleanly from Settings -> Backup Database or Dashboard.
 */
export function buildIsolatedDemoDataset(actorId: string, actorName: string): Partial<PracticeDatabase> {
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const twoDaysAgo = new Date(Date.now() - 2 * 86400000).toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const nowIso = new Date().toISOString();

  const meta = {
    createdAt: nowIso,
    createdBy: actorId,
    updatedAt: nowIso,
    updatedBy: actorId,
    isDemo: true
  };

  return {
    patients: [
      {
        id: 'demo-pat-1',
        rmNumber: 'RM-00001',
        nik: '3174015204950001',
        fullName: 'Nadia Kusuma Putri',
        birthPlace: 'Jakarta',
        birthDate: '1995-04-12',
        gender: 'Perempuan',
        address: 'Jl. Panglima Polim IV No. 19, Jakarta Selatan',
        phone: '081288112233',
        email: 'nadia.kusuma@example.id',
        occupation: 'Arsitek',
        maritalStatus: 'Menikah',
        spouseName: 'Raka Pratama',
        familyPhone: '081288112234',
        emergencyContact: 'Raka Pratama (Suami) - 081288112234',
        bloodType: 'O+',
        allergies: 'Tidak ada',
        medicalHistory: 'Tidak ada riwayat hipertensi/DM',
        surgicalHistory: 'Belum pernah operasi',
        medicationHistory: 'Folamil Genio 1x1',
        consentGiven: true,
        consentDate: twoDaysAgo,
        active: true,
        ...meta
      },
      {
        id: 'demo-pat-2',
        rmNumber: 'RM-00002',
        nik: '3273026108910004',
        fullName: 'Aulia Rahmawati',
        birthPlace: 'Bandung',
        birthDate: '1991-08-21',
        gender: 'Perempuan',
        address: 'Jl. Kemang Timur No. 72, Jakarta Selatan',
        phone: '081399224455',
        email: 'aulia.rahma@example.id',
        occupation: 'Akuntan',
        maritalStatus: 'Menikah',
        spouseName: 'Dimas Santoso',
        familyPhone: '081399224456',
        emergencyContact: 'Dimas Santoso (Suami) - 081399224456',
        bloodType: 'A+',
        allergies: 'Penisilin',
        medicalHistory: 'Hipertensi gestasional kehamilan sebelumnya',
        surgicalHistory: 'SC 2022',
        medicationHistory: 'Methyldopa 250mg',
        consentGiven: true,
        consentDate: yesterday,
        active: true,
        ...meta
      },
      {
        id: 'demo-pat-3',
        rmNumber: 'RM-00003',
        nik: '3171044511970009',
        fullName: 'Clara Wijaya',
        birthPlace: 'Surabaya',
        birthDate: '1997-11-05',
        gender: 'Perempuan',
        address: 'Jl. Senopati No. 34, Jakarta Selatan',
        phone: '081766554433',
        email: 'clara.wijaya@example.id',
        occupation: 'Desainer Produk',
        maritalStatus: 'Belum Menikah',
        spouseName: '-',
        familyPhone: '081766554430',
        emergencyContact: 'Surya Wijaya (Ayah) - 081766554430',
        bloodType: 'B+',
        allergies: 'Tidak ada',
        medicalHistory: 'Siklus menstruasi tidak teratur sejak 1 tahun',
        surgicalHistory: '-',
        medicationHistory: '-',
        consentGiven: true,
        consentDate: today,
        active: true,
        ...meta
      }
    ],
    visits: [
      {
        id: 'demo-vis-1',
        visitNumber: `VIS-${today.replaceAll('-', '')}-00001`,
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        visitType: 'Pemeriksaan Kehamilan',
        serviceCategory: 'Obstetri',
        initialComplaint: 'Kontrol kehamilan rutin trimester 3, gerakan janin aktif',
        initialVitals: { bloodPressure: '115/75', heartRate: 80, temperature: 36.6, respiratoryRate: 18, weightKg: 64, heightCm: 162, bmi: 24.4 },
        status: 'Selesai',
        paymentStatus: 'Lunas',
        queueNumber: 'A-001',
        visitDate: today,
        ...meta
      },
      {
        id: 'demo-vis-2',
        visitNumber: `VIS-${today.replaceAll('-', '')}-00002`,
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        visitType: 'Pemeriksaan USG',
        serviceCategory: 'USG',
        initialComplaint: 'Kontrol tekanan darah & evaluasi pertumbuhan janin (risiko preeklampsia)',
        initialVitals: { bloodPressure: '138/88', heartRate: 86, temperature: 36.7, respiratoryRate: 20, weightKg: 71, heightCm: 159, bmi: 28.1 },
        status: 'Menunggu Pembayaran',
        paymentStatus: 'Dibayar Sebagian',
        queueNumber: 'A-002',
        visitDate: today,
        ...meta
      },
      {
        id: 'demo-vis-3',
        visitNumber: `VIS-${today.replaceAll('-', '')}-00003`,
        patientId: 'demo-pat-3',
        patientName: 'Clara Wijaya',
        patientRm: 'RM-00003',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        visitType: 'Konsultasi Ginekologi',
        serviceCategory: 'Ginekologi',
        initialComplaint: 'Haid tidak teratur 3 bulan terakhir dan nyeri perut bawah',
        initialVitals: { bloodPressure: '110/70', heartRate: 76, temperature: 36.5, respiratoryRate: 18, weightKg: 58, heightCm: 163, bmi: 21.8 },
        status: 'Menunggu',
        paymentStatus: 'Belum Dibayar',
        queueNumber: 'A-003',
        visitDate: today,
        ...meta
      }
    ],
    queues: [
      {
        id: 'demo-q-1',
        visitId: 'demo-vis-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        queueNumber: 'A-001',
        visitType: 'Pemeriksaan Kehamilan',
        status: 'Selesai',
        queueDate: today,
        ...meta
      },
      {
        id: 'demo-q-2',
        visitId: 'demo-vis-2',
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        queueNumber: 'A-002',
        visitType: 'Pemeriksaan USG',
        status: 'Menunggu Pembayaran',
        queueDate: today,
        ...meta
      },
      {
        id: 'demo-q-3',
        visitId: 'demo-vis-3',
        patientId: 'demo-pat-3',
        patientName: 'Clara Wijaya',
        patientRm: 'RM-00003',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        queueNumber: 'A-003',
        visitType: 'Konsultasi Ginekologi',
        status: 'Menunggu',
        queueDate: today,
        ...meta
      }
    ],
    pregnancies: [
      {
        id: 'demo-preg-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        hpht: '2026-04-14',
        hpl: '2027-01-19',
        gestationalAgeWeeks: 32,
        gestationalAgeDays: 0,
        gravida: 1,
        para: 0,
        abortus: 0,
        complications: 'Tidak ada',
        riskFactors: 'Risiko rendah',
        riskLevel: 'Rendah',
        deliveryHistory: 'Belum pernah melahirkan',
        miscarriageHistory: 'Tidak ada',
        status: 'Aktif',
        nextAncDate: nextWeek,
        doctorConfirmed: true,
        ...meta
      },
      {
        id: 'demo-preg-2',
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        hpht: '2026-05-05',
        hpl: '2027-02-09',
        gestationalAgeWeeks: 29,
        gestationalAgeDays: 0,
        gravida: 2,
        para: 1,
        abortus: 0,
        complications: 'Hipertensi gestasional terkontrol',
        riskFactors: 'Riwayat SC, TD meningkat 138/88 mmHg — pemantauan ketat preeklampsia',
        riskLevel: 'Tinggi',
        deliveryHistory: 'SC 2022 bayi hidup 3.2 kg',
        miscarriageHistory: 'Tidak ada',
        status: 'Aktif',
        nextAncDate: nextWeek,
        doctorConfirmed: true,
        ...meta
      }
    ],
    antenatal_visits: [
      {
        id: 'demo-anc-1',
        pregnancyId: 'demo-preg-1',
        patientId: 'demo-pat-1',
        visitDate: '2026-09-01',
        gestationalAgeWeeks: 20,
        weightKg: 59,
        bloodPressure: '110/70',
        fundalHeightCm: 20,
        fetalHeartRate: 146,
        examNotes: 'Kondisi ibu baik, janin tunggal hidup',
        usgSummary: 'EFW 350g, plasenta korpus posterior',
        diagnosis: 'Z34.0 ANC Primigravida Normal',
        therapy: 'Folamil Genio 1x1, Kalsium 1x1',
        nextControlDate: '2026-10-01',
        ...meta
      },
      {
        id: 'demo-anc-2',
        pregnancyId: 'demo-preg-1',
        patientId: 'demo-pat-1',
        visitDate: '2026-10-15',
        gestationalAgeWeeks: 26,
        weightKg: 61.5,
        bloodPressure: '112/72',
        fundalHeightCm: 26,
        fetalHeartRate: 144,
        examNotes: 'Gerakan janin aktif, tidak ada edema',
        usgSummary: 'EFW 950g, cairan ketuban cukup',
        diagnosis: 'Z34.0 ANC Primigravida Normal',
        therapy: 'Folamil Genio 1x1, Ferrous Sulfate 1x1',
        nextControlDate: today,
        ...meta
      },
      {
        id: 'demo-anc-3',
        pregnancyId: 'demo-preg-1',
        patientId: 'demo-pat-1',
        visitId: 'demo-vis-1',
        visitDate: today,
        gestationalAgeWeeks: 32,
        weightKg: 64,
        bloodPressure: '115/75',
        fundalHeightCm: 31,
        fetalHeartRate: 142,
        examNotes: 'Presentasi kepala, gerakan janin aktif, tanda bahaya negatif',
        usgSummary: 'EFW 1920g, plasenta maturasi grade II, AFI 13 cm',
        diagnosis: 'Z34.0 ANC Primigravida Normal',
        therapy: 'Lanjutkan vitamin prenatal & zat besi',
        nextControlDate: nextWeek,
        ...meta
      }
    ],
    medical_records: [
      {
        id: 'demo-rme-1',
        visitId: 'demo-vis-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        visitDate: today,
        anamnesis: {
          chiefComplaint: 'Kontrol kehamilan rutin 32 minggu',
          presentIllness: 'Gerakan janin aktif, tidak ada mules, tidak ada perdarahan jalan lahir',
          pastMedicalHistory: 'Tidak ada penyakit kronis',
          familyHistory: 'Tidak ada riwayat DM/hipertensi',
          allergyHistory: 'Tidak ada',
          medicationHistory: 'Folamil Genio 1x1',
          menstrualHistory: 'Siklus teratur 28 hari, HPHT 2026-04-14',
          maritalHistory: 'Menikah 2 tahun',
          contraceptionHistory: 'Belum pernah'
        },
        physicalExam: {
          bloodPressure: '115/75',
          heartRate: 80,
          temperature: 36.6,
          respiratoryRate: 18,
          weightKg: 64,
          heightCm: 162,
          bmi: 24.4,
          bmiCategory: 'Berat Badan Lebih',
          generalNotes: 'Kesadaran compos mentis, konjungtiva anemis (-), edema ekstremitas (-)'
        },
        obstetricExam: {
          gravida: 1,
          para: 0,
          abortus: 0,
          hpht: '2026-04-14',
          gestationalAgeWeeks: 32,
          gestationalAgeDays: 0,
          hpl: '2027-01-19',
          fundalHeightCm: 31,
          fetalHeartRate: 142,
          fetalPresentation: 'Kepala',
          fetalMovement: 'Aktif',
          maternalCondition: 'Baik',
          pregnancyNotes: 'Pertumbuhan janin sesuai usia kehamilan'
        },
        diagnoses: [
          { icd10Code: 'Z34.0', description: 'Supervisi kehamilan normal pertama (ANC Primigravida)', type: 'Utama' }
        ],
        doctorNotes: 'Edukasi tanda bahaya trimester III, persiapan persalinan, dan nutrisi seimbang.',
        plan: {
          therapy: 'Folamil Genio 1x1, Ferrous Sulfate 1x1 (malam), Calcium 1x1 (pagi)',
          prescriptionSummary: 'Folamil Genio #30, Ferrous Sulfate #30',
          followUpExam: 'Cek Hb ulang usia 36 minggu',
          counseling: 'Senam hamil ringan & pemantauan gerak janin harian',
          nextControlDate: nextWeek,
          referralNotes: '-',
          patientEducation: 'Segera ke IGD jika ketuban pecah, perdarahan, atau gerak janin berkurang'
        },
        status: 'locked',
        signedAt: nowIso,
        signedBy: 'dr. Kartika Wulandari, Sp.OG (K)',
        signatureHash: 'SIG-DEMO-8A4C9F12E0B73D21',
        version: 1,
        ...meta
      }
    ],
    ultrasound_records: [
      {
        id: 'demo-usg-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        visitId: 'demo-vis-1',
        pregnancyId: 'demo-preg-1',
        examDate: today,
        examType: 'USG Obstetri',
        gestationalAge: '32 minggu 0 hari',
        fetalCount: 1,
        presentation: 'Kepala',
        bpdMm: 81,
        hcMm: 296,
        acMm: 282,
        flMm: 62,
        efwGrams: 1924,
        fhrBpm: 142,
        placenta: 'Korpus posterior, maturasi grade II, tidak menutupi OUI',
        amnioticFluid: 'Cukup (AFI 13.2 cm)',
        fetalPosition: 'Punggung kiri (Puki)',
        conclusion: 'Janin tunggal hidup intrauterin presentasi kepala, biometri sesuai usia kehamilan 32 minggu, EFW 1924 gram, plasenta dan cairan ketuban dalam batas normal.',
        mediaUrls: [],
        verifiedByDoctor: true,
        verifiedByName: 'dr. Kartika Wulandari, Sp.OG (K)',
        verifiedAt: nowIso,
        ...meta
      }
    ],
    prescriptions: [
      {
        id: 'demo-rx-1',
        rxNumber: `RX-${today.replaceAll('-', '')}-00001`,
        visitId: 'demo-vis-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        items: [
          {
            medicineId: 'med-obt-001',
            medicineName: 'Folamil Genio',
            genericName: 'Asam Folat + DHA + Multivitamin',
            dosage: '1 kapsul',
            frequency: '1x1',
            quantity: 30,
            unit: 'Kapsul',
            unitPrice: 5500,
            route: 'Oral',
            duration: '30 hari',
            instructions: 'Sesudah makan pagi'
          }
        ],
        interactionWarnings: [],
        allergyWarnings: [],
        status: 'Diserahkan',
        authorizedAt: nowIso,
        dispensedAt: nowIso,
        dispensedBy: 'Ns. Rani Permata',
        ...meta
      }
    ],
    invoices: [
      {
        id: 'demo-inv-1',
        invoiceNumber: `INV-${today.replaceAll('-', '')}-00001`,
        visitId: 'demo-vis-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        items: [
          { id: 'di-1', category: 'Konsultasi', description: 'Konsultasi Dokter Spesialis Sp.OG', qty: 1, unitPrice: 250000, total: 250000 },
          { id: 'di-2', category: 'USG', description: 'USG Obstetri / Ginekologi 2D', qty: 1, unitPrice: 250000, total: 250000 },
          { id: 'di-3', category: 'Obat', description: 'Folamil Genio (30 Kapsul)', qty: 30, unitPrice: 5500, total: 165000 },
          { id: 'di-4', category: 'Administrasi', description: 'Biaya Administrasi & Rekam Medis', qty: 1, unitPrice: 35000, total: 35000 }
        ],
        subtotal: 700000,
        discount: 0,
        tax: 0,
        total: 700000,
        paidAmount: 700000,
        remainingAmount: 0,
        status: 'Lunas',
        ...meta
      },
      {
        id: 'demo-inv-2',
        invoiceNumber: `INV-${today.replaceAll('-', '')}-00002`,
        visitId: 'demo-vis-2',
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        items: [
          { id: 'di-5', category: 'Konsultasi', description: 'Konsultasi Dokter Spesialis Sp.OG', qty: 1, unitPrice: 250000, total: 250000 },
          { id: 'di-6', category: 'USG', description: 'USG Fetomaternal 3D/4D HD Live', qty: 1, unitPrice: 550000, total: 550000 },
          { id: 'di-7', category: 'Laboratorium', description: 'Urinalisis Lengkap & Protein Urin', qty: 1, unitPrice: 65000, total: 65000 }
        ],
        subtotal: 865000,
        discount: 0,
        tax: 0,
        total: 865000,
        paidAmount: 500000,
        remainingAmount: 365000,
        status: 'Piutang',
        ...meta
      }
    ],
    payments: [
      {
        id: 'demo-pay-1',
        receiptNumber: `KWT-${today.replaceAll('-', '')}-00001`,
        invoiceId: 'demo-inv-1',
        invoiceNumber: `INV-${today.replaceAll('-', '')}-00001`,
        visitId: 'demo-vis-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        amount: 700000,
        receivedAmount: 700000,
        changeAmount: 0,
        method: 'QRIS',
        referenceNumber: 'QRIS-20261124-001',
        status: 'Sukses',
        cashierName: 'Ns. Rani Permata',
        paymentDate: today,
        ...meta
      },
      {
        id: 'demo-pay-2',
        receiptNumber: `KWT-${today.replaceAll('-', '')}-00002`,
        invoiceId: 'demo-inv-2',
        invoiceNumber: `INV-${today.replaceAll('-', '')}-00002`,
        visitId: 'demo-vis-2',
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        amount: 500000,
        receivedAmount: 500000,
        changeAmount: 0,
        method: 'Tunai',
        status: 'Sukses',
        cashierName: 'Ns. Rani Permata',
        paymentDate: today,
        ...meta
      }
    ],
    cash_transactions: [
      {
        id: 'demo-ct-1',
        type: 'Masuk',
        category: 'Pembayaran Pasien',
        amount: 700000,
        method: 'QRIS',
        description: 'Pelunasan KWT-00001 — Nadia Kusuma Putri',
        referenceId: 'demo-pay-1',
        transactionDate: today,
        ...meta
      },
      {
        id: 'demo-ct-2',
        type: 'Masuk',
        category: 'Pembayaran Pasien',
        amount: 500000,
        method: 'Tunai',
        description: 'Pembayaran sebagian KWT-00002 — Aulia Rahmawati',
        referenceId: 'demo-pay-2',
        transactionDate: today,
        ...meta
      },
      {
        id: 'demo-ct-3',
        type: 'Keluar',
        category: 'Bahan Habis Pakai Medis',
        amount: 185000,
        method: 'Tunai',
        description: 'Pembelian gel USG & kertas thermal cetak USG',
        transactionDate: today,
        ...meta
      }
    ],
    expenses: [
      {
        id: 'demo-exp-1',
        category: 'Bahan Habis Pakai Medis',
        description: 'Gel USG 5 Liter & Kertas Thermal Sony UPP-110S',
        amount: 185000,
        expenseDate: today,
        vendor: 'PT Medika Supplies',
        paymentMethod: 'Tunai',
        ...meta
      }
    ],
    appointments: [
      {
        id: 'demo-apt-1',
        patientId: 'demo-pat-1',
        patientName: 'Nadia Kusuma Putri',
        patientRm: 'RM-00001',
        patientPhone: '081288112233',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        scheduledDate: nextWeek,
        scheduledTime: '10:00',
        purpose: 'Kontrol ANC 33 Minggu',
        status: 'Terjadwal',
        reminderSent: false,
        ...meta
      },
      {
        id: 'demo-apt-2',
        patientId: 'demo-pat-2',
        patientName: 'Aulia Rahmawati',
        patientRm: 'RM-00002',
        patientPhone: '081399224455',
        doctorId: 'usr-dokter',
        doctorName: 'dr. Kartika Wulandari, Sp.OG (K)',
        scheduledDate: nextWeek,
        scheduledTime: '11:00',
        purpose: 'Evaluasi TD & Protein Urin (Kehamilan Risiko Tinggi)',
        status: 'Terjadwal',
        reminderSent: true,
        reminderSentAt: nowIso,
        ...meta
      }
    ],
    notifications: [
      {
        id: 'demo-notif-1',
        category: 'Pemeriksaan',
        title: 'Pemantauan Kehamilan Risiko Tinggi',
        message: 'Aulia Rahmawati (RM-00002) memiliki TD 138/88 mmHg — jadwalkan evaluasi protein urin & kontrol 1 minggu.',
        severity: 'critical',
        targetRoles: ['SUPER_ADMIN', 'DOKTER_SPOG'],
        read: false,
        linkView: 'pregnancy',
        ...meta
      },
      {
        id: 'demo-notif-2',
        category: 'Pembayaran',
        title: 'Piutang Tagihan Pasien',
        message: 'Tagihan Aulia Rahmawati masih memiliki sisa piutang Rp 365.000.',
        severity: 'warning',
        targetRoles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'],
        read: false,
        linkView: 'receivables',
        ...meta
      },
      {
        id: 'demo-notif-3',
        category: 'Antrean',
        title: 'Pasien Menunggu Pemeriksaan',
        message: 'Clara Wijaya (A-003) sedang menunggu panggilan dokter untuk Konsultasi Ginekologi.',
        severity: 'info',
        targetRoles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'],
        read: false,
        linkView: 'queue',
        ...meta
      }
    ],
    audit_logs: [
      {
        id: 'demo-audit-1',
        userId: actorId,
        userName: actorName,
        role: 'SUPER_ADMIN',
        action: 'LOAD_DEMO_DATASET',
        entity: 'system',
        afterData: 'Dataset demonstrasi terpisah dimuat untuk pengujian operasional.',
        deviceInfo: 'Web Client',
        createdAt: nowIso
      }
    ]
  };
}
