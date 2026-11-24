export type RoleCode = 'SUPER_ADMIN' | 'DOKTER_SPOG' | 'ASISTEN_DOKTER';

export type QueueStatus =
  | 'Terdaftar'
  | 'Menunggu'
  | 'Dipanggil'
  | 'Sedang Diperiksa'
  | 'Pemeriksaan Selesai'
  | 'Menunggu Pembayaran'
  | 'Selesai';

export type PaymentStatus =
  | 'Belum Dibayar'
  | 'Dibayar Sebagian'
  | 'Lunas'
  | 'Piutang'
  | 'Dibatalkan'
  | 'Dikembalikan';

export type PaymentMethod =
  | 'Tunai'
  | 'Transfer Bank'
  | 'QRIS'
  | 'E-Wallet'
  | 'Kartu Debit/Kredit'
  | 'Lainnya';

export type VisitType =
  | 'Pasien Baru'
  | 'Pasien Lama'
  | 'Konsultasi Obstetri'
  | 'Konsultasi Ginekologi'
  | 'Pemeriksaan Kehamilan'
  | 'Pemeriksaan USG'
  | 'Kontrol Ulang'
  | 'Konsultasi KB'
  | 'Pemeriksaan Lainnya';

export interface AuditFields {
  id: string;
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
  active?: boolean;
  isDemo?: boolean;
}

export interface E2EEEnvelope {
  __e2ee: true;
  alg: 'AES-GCM-256';
  iv: string;
  ct: string;
  keyId: string;
}

export interface UserAccount extends AuditFields {
  username: string;
  displayName: string;
  email: string;
  role: RoleCode;
  strNumber?: string;
  sipNumber?: string;
  active: boolean;
  e2eeSalt?: string;
  e2eeWrappedKey?: string;
  e2eeFingerprint?: string;
  lastLoginAt?: string;
}

export interface RoleDefinition extends AuditFields {
  code: RoleCode;
  name: string;
  description: string;
  permissions: string[];
  active: boolean;
}

export interface PermissionDefinition extends AuditFields {
  key: string;
  module: string;
  label: string;
  active: boolean;
}

export interface PracticeSettings extends AuditFields {
  practiceName: string;
  doctorName: string;
  doctorTitle: string;
  strNumber: string;
  sipNumber: string;
  address: string;
  phone: string;
  email: string;
  logoUrl: string;
  operationalHours: string;
  rmFormat: string;
  visitFormat: string;
  invoiceFormat: string;
  receiptFormat: string;
  rxFormat: string;
  taxRatePercent: number;
  defaultDiscountPercent: number;
}

export interface Patient extends AuditFields {
  rmNumber: string;
  nik: string;
  fullName: string;
  birthPlace: string;
  birthDate: string;
  gender: 'Perempuan' | 'Laki-laki';
  address: string;
  phone: string;
  email: string;
  occupation: string;
  maritalStatus: string;
  spouseName: string;
  familyPhone: string;
  emergencyContact: string;
  bloodType: string;
  allergies: string;
  medicalHistory: string;
  surgicalHistory: string;
  medicationHistory: string;
  consentGiven: boolean;
  consentDate?: string;
  active: boolean;
  e2ee?: Record<string, E2EEEnvelope>;
}

export interface PatientContact extends AuditFields {
  patientId: string;
  name: string;
  relationship: string;
  phone: string;
  active: boolean;
}

export interface VitalSigns {
  bloodPressureSystolic?: number;
  bloodPressureDiastolic?: number;
  bloodPressure: string;
  heartRate: number;
  temperature: number;
  respiratoryRate: number;
  weightKg: number;
  heightCm: number;
  bmi: number;
  bmiCategory?: string;
  generalNotes?: string;
}

export interface Visit extends AuditFields {
  visitNumber: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  doctorId: string;
  doctorName: string;
  visitType: VisitType;
  serviceCategory: string;
  initialComplaint: string;
  initialVitals?: Partial<VitalSigns>;
  status: QueueStatus;
  paymentStatus: PaymentStatus;
  queueNumber: string;
  visitDate: string;
}

export interface QueueEntry extends AuditFields {
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  doctorId: string;
  doctorName: string;
  queueNumber: string;
  visitType: VisitType;
  status: QueueStatus;
  queueDate: string;
  calledAt?: string;
}

export interface AnamnesisData {
  chiefComplaint: string;
  presentIllness: string;
  pastMedicalHistory: string;
  familyHistory: string;
  allergyHistory: string;
  medicationHistory: string;
  menstrualHistory: string;
  maritalHistory: string;
  contraceptionHistory: string;
}

export interface ObstetricExamData {
  gravida: number;
  para: number;
  abortus: number;
  hpht: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  hpl: string;
  fundalHeightCm?: number;
  fetalHeartRate?: number;
  fetalPresentation?: string;
  fetalMovement?: string;
  maternalCondition?: string;
  pregnancyNotes?: string;
}

export interface GynecologyExamData {
  complaint: string;
  externalGenitalia: string;
  speculumExam: string;
  bimanualExam: string;
  supportingExam: string;
  clinicalNotes: string;
}

export interface DiagnosisEntry {
  icd10Code: string;
  description: string;
  type: 'Utama' | 'Sekunder' | 'Banding';
}

export interface PlanData {
  therapy: string;
  prescriptionSummary: string;
  followUpExam: string;
  counseling: string;
  nextControlDate: string;
  referralNotes: string;
  patientEducation: string;
}

export interface MedicalRecord extends AuditFields {
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  doctorId: string;
  doctorName: string;
  visitDate: string;
  anamnesis: AnamnesisData;
  physicalExam: VitalSigns;
  obstetricExam?: ObstetricExamData;
  gynecologyExam?: GynecologyExamData;
  diagnoses: DiagnosisEntry[];
  doctorNotes: string;
  plan: PlanData;
  status: 'draft' | 'signed' | 'locked';
  signedAt?: string;
  signedBy?: string;
  signatureHash?: string;
  version: number;
  e2ee?: Record<string, E2EEEnvelope>;
}

export interface MedicalRecordVersion extends AuditFields {
  medicalRecordId: string;
  patientId: string;
  version: number;
  changeReason: string;
  changedByName: string;
  snapshotSummary: string;
}

export interface Pregnancy extends AuditFields {
  patientId: string;
  patientName: string;
  patientRm: string;
  hpht: string;
  hpl: string;
  gestationalAgeWeeks: number;
  gestationalAgeDays: number;
  gravida: number;
  para: number;
  abortus: number;
  complications: string;
  riskFactors: string;
  riskLevel: 'Rendah' | 'Sedang' | 'Tinggi';
  deliveryHistory: string;
  miscarriageHistory: string;
  status: 'Aktif' | 'Lahir' | 'Keguguran' | 'Selesai';
  nextAncDate?: string;
  doctorConfirmed: boolean;
}

export interface AntenatalVisit extends AuditFields {
  pregnancyId: string;
  patientId: string;
  visitId?: string;
  visitDate: string;
  gestationalAgeWeeks: number;
  weightKg: number;
  bloodPressure: string;
  fundalHeightCm: number;
  fetalHeartRate: number;
  examNotes: string;
  usgSummary: string;
  diagnosis: string;
  therapy: string;
  nextControlDate: string;
}

export interface UltrasoundRecord extends AuditFields {
  patientId: string;
  patientName: string;
  patientRm: string;
  visitId: string;
  pregnancyId?: string;
  examDate: string;
  examType: 'USG Obstetri' | 'USG Ginekologi' | 'USG Transabdominal' | 'USG Transvaginal' | 'Lainnya';
  // Obstetric fields
  gestationalAge?: string;
  fetalCount?: number;
  presentation?: string;
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
  efwGrams?: number;
  fhrBpm?: number;
  placenta?: string;
  amnioticFluid?: string;
  fetalPosition?: string;
  // Gynecology fields
  uterusSize?: string;
  endometriumThicknessMm?: number;
  rightOvary?: string;
  leftOvary?: string;
  massSize?: string;
  otherFindings?: string;
  conclusion: string;
  mediaUrls: { name: string; type: 'image' | 'video'; url: string }[];
  verifiedByDoctor: boolean;
  verifiedByName?: string;
  verifiedAt?: string;
}

export interface DiagnosisRecord extends AuditFields {
  medicalRecordId: string;
  visitId: string;
  patientId: string;
  icd10Code: string;
  description: string;
  type: 'Utama' | 'Sekunder' | 'Banding';
}

export interface Icd10Code extends AuditFields {
  code: string;
  name: string;
  category: string;
  active: boolean;
}

export interface ServiceTariff extends AuditFields {
  code: string;
  name: string;
  category: 'Konsultasi' | 'Obstetri' | 'Ginekologi' | 'USG' | 'Tindakan' | 'Laboratorium' | 'Administrasi';
  price: number;
  durationMinutes: number;
  description: string;
  active: boolean;
}

export interface ProcedureRecord extends AuditFields {
  visitId: string;
  patientId: string;
  patientName: string;
  serviceId: string;
  code: string;
  name: string;
  category: string;
  price: number;
  doctorId: string;
  doctorName: string;
  notes: string;
  billed: boolean;
}

export interface Medicine extends AuditFields {
  code: string;
  name: string;
  genericName: string;
  brand: string;
  dosageForm: string;
  strength: string;
  unit: string;
  price: number;
  stock: number;
  expiryDate: string;
  active: boolean;
}

export interface PrescriptionItem {
  medicineId: string;
  medicineName: string;
  genericName: string;
  dosage: string;
  frequency: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  route: string;
  duration: string;
  instructions: string;
}

export interface Prescription extends AuditFields {
  rxNumber: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  doctorId: string;
  doctorName: string;
  items: PrescriptionItem[];
  interactionWarnings: string[];
  allergyWarnings: string[];
  status: 'Draft' | 'Disahkan Dokter' | 'Disiapkan' | 'Diserahkan';
  authorizedAt?: string;
  dispensedAt?: string;
  dispensedBy?: string;
}

export interface LabTestCatalogItem {
  code: string;
  name: string;
  category: string;
  unit: string;
  referenceRange: string;
  price: number;
}

export interface LaboratoryOrder extends AuditFields {
  orderNumber: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  doctorId: string;
  doctorName: string;
  tests: { code: string; name: string; price: number; unit: string; referenceRange: string }[];
  clinicalNotes: string;
  status: 'Diminta' | 'Proses' | 'Selesai';
}

export interface LaboratoryResult extends AuditFields {
  orderId: string;
  visitId: string;
  patientId: string;
  patientName: string;
  testCode: string;
  testName: string;
  resultValue: string;
  unit: string;
  referenceRange: string;
  flag: 'Normal' | 'Tinggi' | 'Rendah' | 'Reaktif' | 'Non-Reaktif';
  examinerName: string;
  examinedAt: string;
  attachmentUrl?: string;
  notes?: string;
}

export interface InvoiceItem extends AuditFields {
  invoiceId: string;
  category: 'Konsultasi' | 'Pemeriksaan' | 'USG' | 'Tindakan' | 'Laboratorium' | 'Obat' | 'Administrasi' | 'Lainnya';
  description: string;
  qty: number;
  unitPrice: number;
  total: number;
}

export interface Invoice extends AuditFields {
  invoiceNumber: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  items: {
    id: string;
    category: InvoiceItem['category'];
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
  }[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  paidAmount: number;
  remainingAmount: number;
  status: PaymentStatus;
  adjustmentReason?: string;
}

export interface Payment extends AuditFields {
  receiptNumber: string;
  invoiceId: string;
  invoiceNumber: string;
  visitId: string;
  patientId: string;
  patientName: string;
  patientRm: string;
  amount: number;
  receivedAmount: number;
  changeAmount: number;
  method: PaymentMethod;
  referenceNumber?: string;
  status: 'Sukses' | 'Dibatalkan' | 'Dikembalikan';
  cashierName: string;
  cancelReason?: string;
  paymentDate: string;
}

export interface Refund extends AuditFields {
  paymentId: string;
  receiptNumber: string;
  invoiceId: string;
  patientName: string;
  amount: number;
  reason: string;
  status: 'Menunggu Persetujuan' | 'Disetujui' | 'Ditolak';
  approvedBy?: string;
  approvedAt?: string;
}

export interface CashSession extends AuditFields {
  sessionDate: string;
  openedBy: string;
  openedAt: string;
  openingBalance: number;
  cashInTotal: number;
  cashOutTotal: number;
  expectedBalance: number;
  actualClosingBalance?: number;
  variance?: number;
  closedBy?: string;
  closedAt?: string;
  notes?: string;
  status: 'Terbuka' | 'Ditutup';
}

export interface CashTransaction extends AuditFields {
  sessionId?: string;
  type: 'Masuk' | 'Keluar';
  category: string;
  amount: number;
  method: PaymentMethod;
  description: string;
  referenceId?: string;
  transactionDate: string;
}

export interface Expense extends AuditFields {
  category: string;
  description: string;
  amount: number;
  expenseDate: string;
  vendor?: string;
  paymentMethod: PaymentMethod;
}

export interface PracticeScheduleSlot {
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  doctorId: string;
  doctorName: string;
  quota: number;
  active: boolean;
}

export interface Appointment extends AuditFields {
  patientId: string;
  patientName: string;
  patientRm: string;
  patientPhone: string;
  doctorId: string;
  doctorName: string;
  scheduledDate: string;
  scheduledTime: string;
  purpose: string;
  status: 'Terjadwal' | 'Hadir' | 'Dijadwalkan Ulang' | 'Dibatalkan';
  reminderSent: boolean;
  reminderSentAt?: string;
  cancelReason?: string;
  rescheduleHistory?: string[];
}

export interface DocumentRecord extends AuditFields {
  patientId: string;
  patientName: string;
  patientRm: string;
  visitId?: string;
  docType:
    | 'Rekam Medis'
    | 'Hasil USG'
    | 'Hasil Laboratorium'
    | 'Resep'
    | 'Surat Keterangan'
    | 'Surat Rujukan'
    | 'Kuitansi'
    | 'Dokumen Administrasi';
  title: string;
  content: string;
  fileUrl?: string;
  signedBy?: string;
}

export interface NotificationItem extends AuditFields {
  category:
    | 'Pasien Baru'
    | 'Antrean'
    | 'Pembayaran'
    | 'Kontrol'
    | 'Laboratorium'
    | 'Pemeriksaan'
    | 'Keuangan'
    | 'Keamanan';
  title: string;
  message: string;
  severity: 'info' | 'warning' | 'critical';
  targetRoles: RoleCode[];
  read: boolean;
  linkView?: string;
}

export interface AuditLog {
  id: string;
  userId: string;
  userName: string;
  role: RoleCode;
  action: string;
  entity: string;
  entityId?: string;
  beforeData?: string;
  afterData?: string;
  deviceInfo: string;
  createdAt: string;
}

export interface DocumentTemplates {
  kuitansiFooter: string;
  resepHeaderNote: string;
  usgDisclaimer: string;
  suratKeteranganBody: string;
  suratRujukanHeader: string;
  laporanFooter: string;
}

export interface SystemSettings extends AuditFields {
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
  maxLoginAttempts: number;
  dataRetentionYears: number;
  autoBackupEnabled: boolean;
  e2eeRequired: boolean;
  e2eeKeyVersion: number;
  e2eeKeyFingerprint: string;
  scheduleSlots: PracticeScheduleSlot[];
  templates: DocumentTemplates;
}

export interface IntegrationConfig extends AuditFields {
  provider: 'SATUSEHAT_FHIR' | 'WHATSAPP_API' | 'FIREBASE_CLOUD';
  name: string;
  endpointUrl: string;
  organizationId?: string;
  clientId?: string;
  senderNumber?: string;
  enabled: boolean;
  statusNote: string;
  lastTestedAt?: string;
}

export interface BackupRecord extends AuditFields {
  label: string;
  encrypted: boolean;
  recordCount: number;
  sizeKb: number;
  triggerType: 'Manual' | 'Terjadwal';
}

export interface PracticeDatabase {
  users: UserAccount[];
  roles: RoleDefinition[];
  permissions: PermissionDefinition[];
  practice_settings: PracticeSettings[];
  patients: Patient[];
  patient_contacts: PatientContact[];
  visits: Visit[];
  queues: QueueEntry[];
  medical_records: MedicalRecord[];
  medical_record_versions: MedicalRecordVersion[];
  pregnancies: Pregnancy[];
  antenatal_visits: AntenatalVisit[];
  ultrasound_records: UltrasoundRecord[];
  diagnoses: DiagnosisRecord[];
  icd10_codes: Icd10Code[];
  procedures: ProcedureRecord[];
  services: ServiceTariff[];
  medicines: Medicine[];
  prescriptions: Prescription[];
  laboratory_orders: LaboratoryOrder[];
  laboratory_results: LaboratoryResult[];
  invoices: Invoice[];
  invoice_items: InvoiceItem[];
  payments: Payment[];
  refunds: Refund[];
  cash_sessions: CashSession[];
  cash_transactions: CashTransaction[];
  expenses: Expense[];
  appointments: Appointment[];
  documents: DocumentRecord[];
  notifications: NotificationItem[];
  audit_logs: AuditLog[];
  system_settings: SystemSettings[];
  integrations: IntegrationConfig[];
  backups: BackupRecord[];
}

export type CollectionName = keyof PracticeDatabase;

export type NavView =
  | 'dashboard'
  | 'patients'
  | 'patient-register'
  | 'visits'
  | 'queue'
  | 'rme'
  | 'obstetric'
  | 'gynecology'
  | 'pregnancy'
  | 'usg'
  | 'procedures'
  | 'prescriptions'
  | 'laboratory'
  | 'schedule'
  | 'appointments'
  | 'documents'
  | 'notifications'
  | 'cashier'
  | 'invoices'
  | 'payments'
  | 'receivables'
  | 'cash-in'
  | 'cash-out'
  | 'cash-close'
  | 'finance-reports'
  | 'report-patients'
  | 'report-visits'
  | 'report-medical'
  | 'report-services'
  | 'report-revenue'
  | 'settings-practice'
  | 'settings-tariffs'
  | 'settings-users'
  | 'settings-permissions'
  | 'settings-templates'
  | 'settings-integrations'
  | 'settings-backup'
  | 'settings-audit';
