import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Clock,
  Cloud,
  DatabaseBackup,
  Download,
  Edit3,
  Link2,
  Lock,
  PenTool,
  Pill,
  Plus,
  Save,
  ScrollText,
  Shield,
  Sliders,
  Trash2,
  Upload,
  UserCheck,
  UserPlus,
  UserX,
  X
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import { SignatureInput } from './SignatureInput';
import type {
  AccessRequest,
  BackupRecord,
  DocumentTemplates,
  Icd10Code,
  IntegrationConfig,
  Medicine,
  PermissionDefinition,
  PracticeScheduleSlot,
  PracticeSettings,
  RoleCode,
  RoleDefinition,
  ServiceTariff,
  SystemSettings,
  UserAccount
} from '../types/models';
import { DEFAULT_LOGO_PATH } from '../data/defaults';
import { buildFhirPatientPreview, formatCurrencyIDR } from '../utils/obstetrics';
import { PERMISSION_CATALOG, ROLE_LABELS } from '../utils/rbac';

const HARD_LOCKED_ASSISTANT = [
  'rme.write',
  'rme.sign_lock',
  'prescriptions.write',
  'patients.delete',
  'cashier.refund_approve'
];
const HARD_LOCKED_DOCTOR = ['cashier.operate', 'cashier.refund_approve'];
const DAYS_OF_WEEK = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];
const SERVICE_CATEGORIES: ServiceTariff['category'][] = [
  'Konsultasi',
  'Obstetri',
  'Ginekologi',
  'USG',
  'Tindakan',
  'Laboratorium',
  'Administrasi'
];

export const SettingsModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    firebaseUser,
    cloudSynced,
    practice,
    systemSettings,
    e2eeFingerprint,
    upsertRecord,
    deleteRecord,
    createStaffAccount,
    updateStaffAccount,
    deleteStaffAccount,
    approveAccessRequest,
    rejectAccessRequest,
    loadDemoData,
    clearDemoData,
    restoreBackupData,
    notifyToast
  } = usePractice();

  // Practice Profile & System Policy form state (synced with live Firestore snapshots)
  const [practiceForm, setPracticeForm] = useState<PracticeSettings>(practice);
  const [systemForm, setSystemForm] = useState<SystemSettings>(systemSettings);
  const [templatesForm, setTemplatesForm] = useState<DocumentTemplates>(systemSettings.templates);

  useEffect(() => {
    setPracticeForm(practice);
  }, [practice]);

  useEffect(() => {
    setSystemForm(systemSettings);
    setTemplatesForm(systemSettings.templates);
  }, [systemSettings]);

  // Schedule slot editor state (inside settings-practice)
  const [newSlot, setNewSlot] = useState<PracticeScheduleSlot>({
    dayOfWeek: 'Senin',
    startTime: '09:00',
    endTime: '14:00',
    doctorId: 'usr-dokter',
    doctorName: practice.doctorName ? `${practice.doctorName}, ${practice.doctorTitle}` : 'Dokter Sp.OG',
    quota: 20,
    active: true
  });

  // Tariffs / Medicines / ICD-10 tab state
  const [catalogTab, setCatalogTab] = useState<'services' | 'medicines' | 'icd10'>('services');
  const [catalogSearch, setCatalogSearch] = useState('');
  const [confirmDeleteKey, setConfirmDeleteKey] = useState<string | null>(null);

  // Service Tariff Add & Edit state
  const [newTariff, setNewTariff] = useState({
    code: '',
    name: '',
    category: 'Konsultasi' as ServiceTariff['category'],
    price: 250000,
    durationMinutes: 20,
    description: ''
  });
  const [editingService, setEditingService] = useState<ServiceTariff | null>(null);

  // Medicine Add & Edit state
  const [newMed, setNewMed] = useState({
    code: '',
    name: '',
    genericName: '',
    brand: '',
    dosageForm: 'Tablet',
    strength: '',
    unit: 'Tablet',
    price: 5000,
    stock: 100,
    expiryDate: '2027-12-31'
  });
  const [editingMed, setEditingMed] = useState<Medicine | null>(null);

  // ICD-10 Add & Edit state
  const [newIcd, setNewIcd] = useState({ code: '', name: '', category: 'Obstetri' });
  const [editingIcd, setEditingIcd] = useState<Icd10Code | null>(null);

  // User CRUD form state
  const [newUser, setNewUser] = useState({
    username: '',
    password: '',
    displayName: '',
    email: '',
    role: 'DOKTER_SPOG' as RoleCode,
    strNumber: '',
    sipNumber: ''
  });
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);
  const [resetTargetUserId, setResetTargetUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [sigModalUser, setSigModalUser] = useState<UserAccount | null>(null);
  const [sigDraft, setSigDraft] = useState('');
  const [savingUserSig, setSavingUserSig] = useState(false);

  // Access Request Approval state
  const [approvalRoles, setApprovalRoles] = useState<Record<string, RoleCode>>({});
  const [approvalStr, setApprovalStr] = useState<Record<string, string>>({});
  const [approvalSip, setApprovalSip] = useState<Record<string, string>>({});
  const [rejectingReqId, setRejectingReqId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [processingReqId, setProcessingReqId] = useState<string | null>(null);
  const [showReviewedRequests, setShowReviewedRequests] = useState(false);

  // Role & Custom Permission editor state
  const [editingRole, setEditingRole] = useState<RoleDefinition | null>(null);
  const [newPerm, setNewPerm] = useState({ key: '', module: 'Pengaturan', label: '' });

  // Integration Add & Edit state
  const [editingIntegration, setEditingIntegration] = useState<IntegrationConfig | null>(null);
  const [newIntegration, setNewIntegration] = useState({
    name: '',
    provider: 'CUSTOM_API',
    endpointUrl: '',
    organizationId: '',
    clientId: '',
    senderNumber: '',
    statusNote: ''
  });

  // Audit Log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('ALL');

  const demoCount = useMemo(
    () =>
      dbState.patients.filter((p) => p.isDemo).length +
      dbState.visits.filter((v) => v.isDemo).length,
    [dbState.patients, dbState.visits]
  );

  const mergedPermissions = useMemo(() => {
    const byKey = new Map<string, { id?: string; key: string; module: string; label: string; isCustom: boolean }>();
    for (const p of PERMISSION_CATALOG) {
      byKey.set(p.key, { key: p.key, module: p.module, label: p.label, isCustom: false });
    }
    for (const p of dbState.permissions) {
      if (!byKey.has(p.key)) {
        byKey.set(p.key, { id: p.id, key: p.key, module: p.module, label: p.label, isCustom: true });
      }
    }
    return Array.from(byKey.values());
  }, [dbState.permissions]);

  if (!currentUser || currentUser.role !== 'SUPER_ADMIN') {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-xl mx-auto mt-6">
        <Lock className="w-8 h-8 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Hanya Untuk Super Admin</h2>
        <p className="text-sm text-slate-600 mt-1.5">
          Pengaturan identitas praktik, manajemen pengguna, hak akses granular, backup database, dan audit log hanya dapat diakses oleh Super Admin.
        </p>
      </div>
    );
  }

  // ==================== VIEW: PRACTICE IDENTITY, SYSTEM POLICY & SCHEDULE SLOTS ====================
  if (activeView === 'settings-practice') {
    const handleLogoFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 1_200_000) {
        notifyToast('Ukuran gambar logo maksimal 1.2 MB.', 'error');
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          setPracticeForm((prev) => ({ ...prev, logoUrl: reader.result as string }));
        }
      };
      reader.readAsDataURL(file);
    };

    const handleSavePracticeAndSystem = async (e: React.FormEvent) => {
      e.preventDefault();
      await upsertRecord('practice_settings', { ...practiceForm, id: practice.id || 'main' });
      await upsertRecord('system_settings', {
        ...systemSettings,
        ...systemForm,
        id: systemSettings.id || 'main',
        templates: systemSettings.templates
      });
      notifyToast('Identitas praktik, penomoran otomatis, kebijakan sistem, dan jadwal berhasil disimpan.', 'success');
    };

    const handleAddSlot = () => {
      if (!newSlot.startTime || !newSlot.endTime) return;
      const nextSlots = [...(systemForm.scheduleSlots || []), { ...newSlot }];
      setSystemForm((prev) => ({ ...prev, scheduleSlots: nextSlots }));
    };

    const handleUpdateSlot = (index: number, patch: Partial<PracticeScheduleSlot>) => {
      const nextSlots = (systemForm.scheduleSlots || []).map((slot, idx) =>
        idx === index ? { ...slot, ...patch } : slot
      );
      setSystemForm((prev) => ({ ...prev, scheduleSlots: nextSlots }));
    };

    const handleDeleteSlot = (index: number) => {
      const nextSlots = (systemForm.scheduleSlots || []).filter((_, idx) => idx !== index);
      setSystemForm((prev) => ({ ...prev, scheduleSlots: nextSlots }));
    };

    return (
      <form onSubmit={handleSavePracticeAndSystem} className="space-y-6 max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Identitas Praktik, Penomoran &amp; Variabel Sistem</h1>
            <p className="text-sm text-slate-500">
              Super Admin dapat mengubah seluruh identitas klinik, profil dokter, prefix nomor otomatis, kebijakan keamanan, dan slot jadwal praktik.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap shrink-0"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Semua Variabel
          </button>
        </div>

        {/* Section 1: Practice Identity */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-5 pb-5 border-b border-slate-100">
            <img
              src={practiceForm.logoUrl || DEFAULT_LOGO_PATH}
              alt="Logo Praktik"
              className="w-16 h-16 rounded-xl object-contain border border-slate-200 p-1 bg-slate-50"
            />
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-800">Logo Resmi Praktik (Kop Surat &amp; Sidebar)</p>
              <div className="flex flex-wrap items-center gap-2">
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                  Unggah Logo Baru
                  <input type="file" accept="image/*" onChange={handleLogoFileUpload} className="hidden" />
                </label>
                <input
                  type="text"
                  value={practiceForm.logoUrl}
                  onChange={(e) => setPracticeForm({ ...practiceForm, logoUrl: e.target.value })}
                  placeholder="Atau URL gambar logo"
                  className="px-3 py-1.5 text-xs border border-slate-200 rounded-lg w-64"
                />
              </div>
            </div>
          </div>

          <div className="pb-5 border-b border-slate-100">
            <SignatureInput
              value={practiceForm.doctorSignatureUrl || ''}
              onChange={(val) => setPracticeForm((prev) => ({ ...prev, doctorSignatureUrl: val }))}
              label="Tanda Tangan Resmi Dokter Penanggung Jawab (Untuk Semua Dokumen Cetak)"
              helperText="Tanda tangan ini otomatis ditampilkan pada Resep, Laporan USG, Surat Keterangan, Rujukan, RME, dan Kuitansi saat menggunakan penandatangan Dokter Praktik."
              compact
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Nama Praktik / Aplikasi (Ditampilkan di Sidebar, Login &amp; Kop Dokumen)
              </label>
              <input
                type="text"
                required
                value={practiceForm.practiceName}
                onChange={(e) => setPracticeForm({ ...practiceForm, practiceName: e.target.value })}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Dokter Penanggung Jawab</label>
              <input
                type="text"
                value={practiceForm.doctorName}
                onChange={(e) => setPracticeForm({ ...practiceForm, doctorName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Gelar Spesialis</label>
              <input
                type="text"
                value={practiceForm.doctorTitle}
                onChange={(e) => setPracticeForm({ ...practiceForm, doctorTitle: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor STR</label>
              <input
                type="text"
                value={practiceForm.strNumber}
                onChange={(e) => setPracticeForm({ ...practiceForm, strNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor SIP</label>
              <input
                type="text"
                value={practiceForm.sipNumber}
                onChange={(e) => setPracticeForm({ ...practiceForm, sipNumber: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap Praktik</label>
              <textarea
                rows={2}
                value={practiceForm.address}
                onChange={(e) => setPracticeForm({ ...practiceForm, address: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor Telepon / WhatsApp Klinik</label>
              <input
                type="text"
                value={practiceForm.phone}
                onChange={(e) => setPracticeForm({ ...practiceForm, phone: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Email Resmi Praktik</label>
              <input
                type="email"
                value={practiceForm.email}
                onChange={(e) => setPracticeForm({ ...practiceForm, email: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
            <div className="md:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">Jam Operasional</label>
              <input
                type="text"
                value={practiceForm.operationalHours}
                onChange={(e) => setPracticeForm({ ...practiceForm, operationalHours: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">
              Format Prefix Nomor Otomatis &amp; Pajak
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">No. RM</label>
                <input
                  type="text"
                  value={practiceForm.rmFormat}
                  onChange={(e) => setPracticeForm({ ...practiceForm, rmFormat: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kunjungan</label>
                <input
                  type="text"
                  value={practiceForm.visitFormat}
                  onChange={(e) => setPracticeForm({ ...practiceForm, visitFormat: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Tagihan</label>
                <input
                  type="text"
                  value={practiceForm.invoiceFormat}
                  onChange={(e) => setPracticeForm({ ...practiceForm, invoiceFormat: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kuitansi</label>
                <input
                  type="text"
                  value={practiceForm.receiptFormat}
                  onChange={(e) => setPracticeForm({ ...practiceForm, receiptFormat: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Resep</label>
                <input
                  type="text"
                  value={practiceForm.rxFormat}
                  onChange={(e) => setPracticeForm({ ...practiceForm, rxFormat: e.target.value })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Pajak (%)</label>
                <input
                  type="number"
                  min={0}
                  max={30}
                  value={practiceForm.taxRatePercent}
                  onChange={(e) => setPracticeForm({ ...practiceForm, taxRatePercent: Number(e.target.value) })}
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Diskon Def. (%)</label>
                <input
                  type="number"
                  min={0}
                  max={50}
                  value={practiceForm.defaultDiscountPercent}
                  onChange={(e) =>
                    setPracticeForm({ ...practiceForm, defaultDiscountPercent: Number(e.target.value) })
                  }
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 2: System & Security Policy Variables */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-teal-700" />
            <h2 className="text-sm font-bold text-slate-900">Variabel Kebijakan Sistem &amp; Keamanan</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Minimal Panjang Password</label>
              <input
                type="number"
                min={6}
                max={32}
                value={systemForm.passwordMinLength}
                onChange={(e) => setSystemForm({ ...systemForm, passwordMinLength: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Timeout Sesi (Menit)</label>
              <input
                type="number"
                min={10}
                max={480}
                value={systemForm.sessionTimeoutMinutes}
                onChange={(e) => setSystemForm({ ...systemForm, sessionTimeoutMinutes: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Maks. Percobaan Login</label>
              <input
                type="number"
                min={3}
                max={20}
                value={systemForm.maxLoginAttempts}
                onChange={(e) => setSystemForm({ ...systemForm, maxLoginAttempts: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Masa Retensi Data (Tahun)</label>
              <input
                type="number"
                min={1}
                max={50}
                value={systemForm.dataRetentionYears}
                onChange={(e) => setSystemForm({ ...systemForm, dataRetentionYears: Number(e.target.value) })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-6 pt-2">
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={systemForm.autoBackupEnabled}
                onChange={(e) => setSystemForm({ ...systemForm, autoBackupEnabled: e.target.checked })}
                className="w-4 h-4 accent-teal-700"
              />
              Aktifkan Kebijakan Backup Terjadwal Otomatis
            </label>
            <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={systemForm.e2eeRequired}
                onChange={(e) => setSystemForm({ ...systemForm, e2eeRequired: e.target.checked })}
                className="w-4 h-4 accent-teal-700"
              />
              Wajibkan Enkripsi E2EE (AES-256-GCM) untuk PII &amp; Catatan Medis
            </label>
          </div>
        </div>

        {/* Section 3: Practice Schedule Slots Variable Manager */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="w-4 h-4 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">
                Variabel Slot Jadwal Praktik ({(systemForm.scheduleSlots || []).length})
              </h2>
            </div>
            <span className="text-[11px] text-slate-500">Klik &ldquo;Simpan Semua Variabel&rdquo; di atas untuk menyimpan ke database online.</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end bg-slate-50 p-3.5 rounded-lg border border-slate-200">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Hari</label>
              <select
                value={newSlot.dayOfWeek}
                onChange={(e) => setNewSlot({ ...newSlot, dayOfWeek: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              >
                {DAYS_OF_WEEK.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Mulai</label>
              <input
                type="time"
                value={newSlot.startTime}
                onChange={(e) => setNewSlot({ ...newSlot, startTime: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Selesai</label>
              <input
                type="time"
                value={newSlot.endTime}
                onChange={(e) => setNewSlot({ ...newSlot, endTime: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Dokter</label>
              <input
                type="text"
                value={newSlot.doctorName}
                onChange={(e) => setNewSlot({ ...newSlot, doctorName: e.target.value })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">Kuota</label>
              <input
                type="number"
                min={1}
                max={200}
                value={newSlot.quota}
                onChange={(e) => setNewSlot({ ...newSlot, quota: Number(e.target.value) })}
                className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <button
              type="button"
              onClick={handleAddSlot}
              className="inline-flex items-center justify-center gap-1 py-1.5 px-3 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              Tambah Slot
            </button>
          </div>

          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold">Hari</th>
                  <th className="px-3 py-2 text-left font-semibold">Jam Praktik</th>
                  <th className="px-3 py-2 text-left font-semibold">Dokter</th>
                  <th className="px-3 py-2 text-right font-semibold">Kuota</th>
                  <th className="px-3 py-2 text-center font-semibold">Aktif</th>
                  <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(systemForm.scheduleSlots || []).map((slot, idx) => (
                  <tr key={`${slot.dayOfWeek}-${slot.startTime}-${idx}`}>
                    <td className="px-3 py-2">
                      <select
                        value={slot.dayOfWeek}
                        onChange={(e) => handleUpdateSlot(idx, { dayOfWeek: e.target.value })}
                        className="px-2 py-1 text-xs border border-slate-200 rounded bg-white"
                      >
                        {DAYS_OF_WEEK.map((d) => (
                          <option key={d} value={d}>
                            {d}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-3 py-2 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <input
                          type="time"
                          value={slot.startTime}
                          onChange={(e) => handleUpdateSlot(idx, { startTime: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                        />
                        <span>-</span>
                        <input
                          type="time"
                          value={slot.endTime}
                          onChange={(e) => handleUpdateSlot(idx, { endTime: e.target.value })}
                          className="px-2 py-1 text-xs border border-slate-200 rounded font-mono"
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2">
                      <input
                        type="text"
                        value={slot.doctorName}
                        onChange={(e) => handleUpdateSlot(idx, { doctorName: e.target.value })}
                        className="w-full min-w-[160px] px-2 py-1 text-xs border border-slate-200 rounded"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <input
                        type="number"
                        min={1}
                        max={200}
                        value={slot.quota}
                        onChange={(e) => handleUpdateSlot(idx, { quota: Number(e.target.value) })}
                        className="w-16 px-2 py-1 text-xs border border-slate-200 rounded text-right font-mono tabular-nums"
                      />
                    </td>
                    <td className="px-3 py-2 text-center">
                      <input
                        type="checkbox"
                        checked={slot.active}
                        onChange={(e) => handleUpdateSlot(idx, { active: e.target.checked })}
                        className="w-4 h-4 accent-teal-700"
                      />
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteSlot(idx)}
                        className="text-red-600 hover:text-red-800 font-semibold"
                      >
                        Hapus
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </form>
    );
  }

  // ==================== VIEW: TARIFFS, MEDICINES & ICD-10 MASTER DATA ====================
  if (activeView === 'settings-tariffs') {
    const q = catalogSearch.trim().toLowerCase();

    const filteredServices = dbState.services.filter(
      (s) =>
        !q ||
        s.code.toLowerCase().includes(q) ||
        s.name.toLowerCase().includes(q) ||
        s.category.toLowerCase().includes(q)
    );
    const filteredMeds = dbState.medicines.filter(
      (m) =>
        !q ||
        m.code.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        m.genericName.toLowerCase().includes(q) ||
        m.brand.toLowerCase().includes(q)
    );
    const filteredIcds = dbState.icd10_codes.filter(
      (i) =>
        !q ||
        i.code.toLowerCase().includes(q) ||
        i.name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q)
    );

    const handleAddTariff = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newTariff.code.trim() || !newTariff.name.trim()) {
        notifyToast('Isi kode dan nama layanan.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const item: ServiceTariff = {
        id: `srv-${Date.now()}`,
        code: newTariff.code.trim().toUpperCase(),
        name: newTariff.name.trim(),
        category: newTariff.category,
        price: Math.max(0, Number(newTariff.price)),
        durationMinutes: Math.max(5, Number(newTariff.durationMinutes)),
        description: newTariff.description.trim(),
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('services', item);
      setNewTariff({ code: '', name: '', category: 'Konsultasi', price: 250000, durationMinutes: 20, description: '' });
      notifyToast('Tarif pelayanan ditambahkan dan disimpan online.', 'success');
    };

    const handleSaveEditService = async () => {
      if (!editingService) return;
      if (!editingService.code.trim() || !editingService.name.trim()) {
        notifyToast('Kode dan nama layanan wajib diisi.', 'error');
        return;
      }
      await upsertRecord('services', {
        ...editingService,
        code: editingService.code.trim().toUpperCase(),
        name: editingService.name.trim(),
        price: Math.max(0, Number(editingService.price)),
        durationMinutes: Math.max(5, Number(editingService.durationMinutes))
      });
      setEditingService(null);
      notifyToast('Tarif pelayanan diperbarui.', 'success');
    };

    const handleAddMed = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMed.code.trim() || !newMed.name.trim()) {
        notifyToast('Kode dan nama obat wajib diisi.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const item: Medicine = {
        id: `med-${Date.now()}`,
        code: newMed.code.trim().toUpperCase(),
        name: newMed.name.trim(),
        genericName: newMed.genericName.trim() || newMed.name.trim(),
        brand: newMed.brand.trim() || 'Generik',
        dosageForm: newMed.dosageForm.trim() || 'Tablet',
        strength: newMed.strength.trim() || '-',
        unit: newMed.unit.trim() || 'Tablet',
        price: Math.max(0, Number(newMed.price)),
        stock: Math.max(0, Number(newMed.stock)),
        expiryDate: newMed.expiryDate || '2027-12-31',
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('medicines', item);
      setNewMed({
        code: '',
        name: '',
        genericName: '',
        brand: '',
        dosageForm: 'Tablet',
        strength: '',
        unit: 'Tablet',
        price: 5000,
        stock: 100,
        expiryDate: '2027-12-31'
      });
      notifyToast('Master obat berhasil ditambahkan dan disimpan online.', 'success');
    };

    const handleSaveEditMed = async () => {
      if (!editingMed) return;
      if (!editingMed.code.trim() || !editingMed.name.trim()) {
        notifyToast('Kode dan nama obat wajib diisi.', 'error');
        return;
      }
      await upsertRecord('medicines', {
        ...editingMed,
        code: editingMed.code.trim().toUpperCase(),
        name: editingMed.name.trim(),
        price: Math.max(0, Number(editingMed.price)),
        stock: Math.max(0, Number(editingMed.stock))
      });
      setEditingMed(null);
      notifyToast('Data master obat diperbarui.', 'success');
    };

    const handleAddIcd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newIcd.code.trim() || !newIcd.name.trim()) {
        notifyToast('Kode dan nama diagnosis ICD-10 wajib diisi.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const item: Icd10Code = {
        id: `icd-${Date.now()}`,
        code: newIcd.code.trim().toUpperCase(),
        name: newIcd.name.trim(),
        category: newIcd.category.trim() || 'Obstetri',
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('icd10_codes', item);
      setNewIcd({ code: '', name: '', category: 'Obstetri' });
      notifyToast('Kode ICD-10 ditambahkan dan disimpan online.', 'success');
    };

    const handleSaveEditIcd = async () => {
      if (!editingIcd) return;
      if (!editingIcd.code.trim() || !editingIcd.name.trim()) {
        notifyToast('Kode dan deskripsi ICD-10 wajib diisi.', 'error');
        return;
      }
      await upsertRecord('icd10_codes', {
        ...editingIcd,
        code: editingIcd.code.trim().toUpperCase(),
        name: editingIcd.name.trim()
      });
      setEditingIcd(null);
      notifyToast('Kode ICD-10 diperbarui.', 'success');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Master Tarif Pelayanan, Obat &amp; Kode ICD-10</h1>
            <p className="text-sm text-slate-500">
              Tambah, edit, aktifkan/nonaktifkan, dan hapus seluruh variabel layanan, farmasi, dan katalog diagnosis ICD-10.
            </p>
          </div>
          <input
            type="search"
            value={catalogSearch}
            onChange={(e) => setCatalogSearch(e.target.value)}
            placeholder="Cari kode atau nama..."
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg w-60"
          />
        </div>

        {/* Sub-Tabs */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
          <button
            type="button"
            onClick={() => setCatalogTab('services')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              catalogTab === 'services'
                ? 'bg-teal-700 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Tarif Pelayanan ({dbState.services.length})
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('medicines')}
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              catalogTab === 'medicines'
                ? 'bg-teal-700 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            Master Obat ({dbState.medicines.length})
          </button>
          <button
            type="button"
            onClick={() => setCatalogTab('icd10')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap ${
              catalogTab === 'icd10'
                ? 'bg-teal-700 text-white'
                : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            Master ICD-10 ({dbState.icd10_codes.length})
          </button>
        </div>

        {/* TAB 1: SERVICES / TARIFFS */}
        {catalogTab === 'services' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddTariff}
              className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode</label>
                <input
                  type="text"
                  value={newTariff.code}
                  onChange={(e) => setNewTariff({ ...newTariff, code: e.target.value })}
                  placeholder="USG-4D"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="lg:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Layanan</label>
                <input
                  type="text"
                  value={newTariff.name}
                  onChange={(e) => setNewTariff({ ...newTariff, name: e.target.value })}
                  placeholder="USG Fetomaternal 4D + Print"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <select
                  value={newTariff.category}
                  onChange={(e) => setNewTariff({ ...newTariff, category: e.target.value as ServiceTariff['category'] })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
                >
                  {SERVICE_CATEGORIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Tarif (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={newTariff.price}
                  onChange={(e) => setNewTariff({ ...newTariff, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Durasi (Mnt)</label>
                <input
                  type="number"
                  min={5}
                  value={newTariff.durationMinutes}
                  onChange={(e) => setNewTariff({ ...newTariff, durationMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Tarif
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Kode</th>
                      <th className="px-4 py-3 text-left font-semibold">Nama Layanan &amp; Keterangan</th>
                      <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                      <th className="px-4 py-3 text-right font-semibold">Tarif</th>
                      <th className="px-4 py-3 text-right font-semibold">Durasi</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredServices.map((s) => {
                      const isEditing = editingService?.id === s.id;
                      const deleteKey = `srv:${s.id}`;
                      return (
                        <tr key={s.id} className={isEditing ? 'bg-teal-50/40' : ''}>
                          <td className="px-4 py-3 font-mono font-semibold text-teal-800">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingService.code}
                                onChange={(e) => setEditingService({ ...editingService, code: e.target.value })}
                                className="w-24 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                              />
                            ) : (
                              s.code
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editingService.name}
                                  onChange={(e) => setEditingService({ ...editingService, name: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                                <input
                                  type="text"
                                  value={editingService.description}
                                  onChange={(e) => setEditingService({ ...editingService, description: e.target.value })}
                                  placeholder="Deskripsi layanan"
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] bg-white"
                                />
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-slate-900">{s.name}</p>
                                {s.description && <p className="text-[11px] text-slate-500">{s.description}</p>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {isEditing ? (
                              <select
                                value={editingService.category}
                                onChange={(e) =>
                                  setEditingService({ ...editingService, category: e.target.value as ServiceTariff['category'] })
                                }
                                className="px-2 py-1 border border-slate-300 rounded bg-white"
                              >
                                {SERVICE_CATEGORIES.map((c) => (
                                  <option key={c} value={c}>
                                    {c}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              s.category
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={editingService.price}
                                onChange={(e) => setEditingService({ ...editingService, price: Number(e.target.value) })}
                                className="w-28 px-2 py-1 border border-slate-300 rounded text-right bg-white"
                              />
                            ) : (
                              formatCurrencyIDR(s.price)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums text-slate-600">
                            {isEditing ? (
                              <input
                                type="number"
                                min={5}
                                value={editingService.durationMinutes}
                                onChange={(e) =>
                                  setEditingService({ ...editingService, durationMinutes: Number(e.target.value) })
                                }
                                className="w-16 px-2 py-1 border border-slate-300 rounded text-right bg-white"
                              />
                            ) : (
                              `${s.durationMinutes} mnt`
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={s.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                              {s.active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEditService()}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-700 text-white font-semibold hover:bg-teal-800"
                                >
                                  <Check className="w-3 h-3" />
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingService(null)}
                                  className="px-2 py-1 rounded border border-slate-300 text-slate-600 hover:bg-white"
                                >
                                  Batal
                                </button>
                              </>
                            ) : confirmDeleteKey === deleteKey ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteRecord('services', s.id);
                                    setConfirmDeleteKey(null);
                                    notifyToast(`Tarif ${s.name} dihapus.`, 'info');
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="text-slate-600 hover:text-slate-900"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingService({ ...s })}
                                  className="text-teal-700 hover:text-teal-900 font-semibold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void upsertRecord('services', { ...s, active: !s.active })}
                                  className="text-slate-600 hover:text-slate-900 font-semibold"
                                >
                                  {s.active ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEDICINES MASTER */}
        {catalogTab === 'medicines' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddMed}
              className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode Obat</label>
                <input
                  type="text"
                  required
                  value={newMed.code}
                  onChange={(e) => setNewMed({ ...newMed, code: e.target.value })}
                  placeholder="OBT-011"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Obat</label>
                <input
                  type="text"
                  required
                  value={newMed.name}
                  onChange={(e) => setNewMed({ ...newMed, name: e.target.value })}
                  placeholder="Asam Folat 400mcg"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Zat Aktif / Generik</label>
                <input
                  type="text"
                  value={newMed.genericName}
                  onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })}
                  placeholder="Folic Acid"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Merek / Pabrikan</label>
                <input
                  type="text"
                  value={newMed.brand}
                  onChange={(e) => setNewMed({ ...newMed, brand: e.target.value })}
                  placeholder="Generik / Dexa"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Bentuk &amp; Kekuatan</label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={newMed.dosageForm}
                    onChange={(e) => setNewMed({ ...newMed, dosageForm: e.target.value })}
                    placeholder="Tablet"
                    className="w-1/2 px-2.5 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                  <input
                    type="text"
                    value={newMed.strength}
                    onChange={(e) => setNewMed({ ...newMed, strength: e.target.value })}
                    placeholder="500 mg"
                    className="w-1/2 px-2.5 py-2 text-xs border border-slate-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Satuan</label>
                <input
                  type="text"
                  value={newMed.unit}
                  onChange={(e) => setNewMed({ ...newMed, unit: e.target.value })}
                  placeholder="Tablet / Kapsul"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Harga (Rp)</label>
                <input
                  type="number"
                  min={0}
                  value={newMed.price}
                  onChange={(e) => setNewMed({ ...newMed, price: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Stok</label>
                <input
                  type="number"
                  min={0}
                  value={newMed.stock}
                  onChange={(e) => setNewMed({ ...newMed, stock: Number(e.target.value) })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kedaluwarsa</label>
                <input
                  type="date"
                  value={newMed.expiryDate}
                  onChange={(e) => setNewMed({ ...newMed, expiryDate: e.target.value })}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah Obat
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Kode</th>
                      <th className="px-4 py-3 text-left font-semibold">Nama Obat &amp; Generik</th>
                      <th className="px-4 py-3 text-left font-semibold">Sediaan</th>
                      <th className="px-4 py-3 text-right font-semibold">Harga</th>
                      <th className="px-4 py-3 text-right font-semibold">Stok</th>
                      <th className="px-4 py-3 text-left font-semibold">ED</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMeds.map((m) => {
                      const isEditing = editingMed?.id === m.id;
                      const deleteKey = `med:${m.id}`;
                      return (
                        <tr key={m.id} className={isEditing ? 'bg-teal-50/40' : ''}>
                          <td className="px-4 py-3 font-mono font-semibold text-teal-800">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingMed.code}
                                onChange={(e) => setEditingMed({ ...editingMed, code: e.target.value })}
                                className="w-24 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                              />
                            ) : (
                              m.code
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <div className="space-y-1">
                                <input
                                  type="text"
                                  value={editingMed.name}
                                  onChange={(e) => setEditingMed({ ...editingMed, name: e.target.value })}
                                  className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                                <input
                                  type="text"
                                  value={editingMed.genericName}
                                  onChange={(e) => setEditingMed({ ...editingMed, genericName: e.target.value })}
                                  placeholder="Generik"
                                  className="w-full px-2 py-1 border border-slate-200 rounded text-[11px] bg-white"
                                />
                              </div>
                            ) : (
                              <div>
                                <p className="font-medium text-slate-900">{m.name}</p>
                                <p className="text-[11px] text-slate-500">
                                  {m.genericName} · {m.brand}
                                </p>
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {isEditing ? (
                              <div className="flex gap-1">
                                <input
                                  type="text"
                                  value={editingMed.dosageForm}
                                  onChange={(e) => setEditingMed({ ...editingMed, dosageForm: e.target.value })}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                                <input
                                  type="text"
                                  value={editingMed.strength}
                                  onChange={(e) => setEditingMed({ ...editingMed, strength: e.target.value })}
                                  className="w-20 px-2 py-1 border border-slate-300 rounded bg-white"
                                />
                              </div>
                            ) : (
                              `${m.dosageForm} ${m.strength}`
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={editingMed.price}
                                onChange={(e) => setEditingMed({ ...editingMed, price: Number(e.target.value) })}
                                className="w-24 px-2 py-1 border border-slate-300 rounded text-right bg-white"
                              />
                            ) : (
                              formatCurrencyIDR(m.price)
                            )}
                          </td>
                          <td className="px-4 py-3 text-right font-mono tabular-nums">
                            {isEditing ? (
                              <input
                                type="number"
                                min={0}
                                value={editingMed.stock}
                                onChange={(e) => setEditingMed({ ...editingMed, stock: Number(e.target.value) })}
                                className="w-20 px-2 py-1 border border-slate-300 rounded text-right bg-white"
                              />
                            ) : (
                              `${m.stock} ${m.unit}`
                            )}
                          </td>
                          <td className="px-4 py-3 font-mono text-slate-600">
                            {isEditing ? (
                              <input
                                type="date"
                                value={editingMed.expiryDate}
                                onChange={(e) => setEditingMed({ ...editingMed, expiryDate: e.target.value })}
                                className="px-2 py-1 border border-slate-300 rounded bg-white"
                              />
                            ) : (
                              m.expiryDate
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={m.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                              {m.active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEditMed()}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-700 text-white font-semibold hover:bg-teal-800"
                                >
                                  <Check className="w-3 h-3" />
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingMed(null)}
                                  className="px-2 py-1 rounded border border-slate-300 text-slate-600"
                                >
                                  Batal
                                </button>
                              </>
                            ) : confirmDeleteKey === deleteKey ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteRecord('medicines', m.id);
                                    setConfirmDeleteKey(null);
                                    notifyToast(`Obat ${m.name} dihapus.`, 'info');
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="text-slate-600"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingMed({ ...m })}
                                  className="text-teal-700 hover:text-teal-900 font-semibold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void upsertRecord('medicines', { ...m, active: !m.active })}
                                  className="text-slate-600 hover:text-slate-900 font-semibold"
                                >
                                  {m.active ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: ICD-10 CODES */}
        {catalogTab === 'icd10' && (
          <div className="space-y-4">
            <form
              onSubmit={handleAddIcd}
              className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 items-end"
            >
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kode ICD-10</label>
                <input
                  type="text"
                  required
                  value={newIcd.code}
                  onChange={(e) => setNewIcd({ ...newIcd, code: e.target.value })}
                  placeholder="O14.1"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Diagnosis</label>
                <input
                  type="text"
                  required
                  value={newIcd.name}
                  onChange={(e) => setNewIcd({ ...newIcd, name: e.target.value })}
                  placeholder="Preeklampsia berat"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
                <input
                  type="text"
                  value={newIcd.category}
                  onChange={(e) => setNewIcd({ ...newIcd, category: e.target.value })}
                  placeholder="Obstetri / Ginekologi"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
              >
                <Plus className="w-3.5 h-3.5" />
                Tambah ICD-10
              </button>
            </form>

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Kode</th>
                      <th className="px-4 py-3 text-left font-semibold">Deskripsi Diagnosis</th>
                      <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                      <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredIcds.map((item) => {
                      const isEditing = editingIcd?.id === item.id;
                      const deleteKey = `icd:${item.id}`;
                      return (
                        <tr key={item.id} className={isEditing ? 'bg-teal-50/40' : ''}>
                          <td className="px-4 py-3 font-mono font-semibold text-teal-800">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingIcd.code}
                                onChange={(e) => setEditingIcd({ ...editingIcd, code: e.target.value })}
                                className="w-24 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                              />
                            ) : (
                              item.code
                            )}
                          </td>
                          <td className="px-4 py-3 font-medium text-slate-900">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingIcd.name}
                                onChange={(e) => setEditingIcd({ ...editingIcd, name: e.target.value })}
                                className="w-full px-2 py-1 border border-slate-300 rounded bg-white"
                              />
                            ) : (
                              item.name
                            )}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {isEditing ? (
                              <input
                                type="text"
                                value={editingIcd.category}
                                onChange={(e) => setEditingIcd({ ...editingIcd, category: e.target.value })}
                                className="w-36 px-2 py-1 border border-slate-300 rounded bg-white"
                              />
                            ) : (
                              item.category
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={item.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                              {item.active ? 'Aktif' : 'Nonaktif'}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-2.5">
                            {isEditing ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleSaveEditIcd()}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-700 text-white font-semibold"
                                >
                                  <Check className="w-3 h-3" />
                                  Simpan
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingIcd(null)}
                                  className="px-2 py-1 rounded border border-slate-300 text-slate-600"
                                >
                                  Batal
                                </button>
                              </>
                            ) : confirmDeleteKey === deleteKey ? (
                              <>
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await deleteRecord('icd10_codes', item.id);
                                    setConfirmDeleteKey(null);
                                    notifyToast(`Kode ICD-10 ${item.code} dihapus.`, 'info');
                                  }}
                                  className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(null)}
                                  className="text-slate-600"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => setEditingIcd({ ...item })}
                                  className="text-teal-700 hover:text-teal-900 font-semibold"
                                >
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => void upsertRecord('icd10_codes', { ...item, active: !item.active })}
                                  className="text-slate-600 hover:text-slate-900 font-semibold"
                                >
                                  {item.active ? 'Nonaktifkan' : 'Aktifkan'}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteKey(deleteKey)}
                                  className="text-red-600 hover:text-red-800 font-semibold"
                                >
                                  Hapus
                                </button>
                              </>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== VIEW: USERS & E2EE ACCOUNTS (FULL ADD / EDIT / RESET / DELETE) ====================
  if (activeView === 'settings-users') {
    const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username.trim() || !newUser.displayName.trim()) {
        notifyToast('Username dan nama lengkap wajib diisi.', 'error');
        return;
      }
      if (!newUser.password.trim() || newUser.password.length < 6) {
        notifyToast('Password minimal 6 karakter.', 'error');
        return;
      }
      try {
        await createStaffAccount({
          username: newUser.username.trim(),
          password: newUser.password,
          displayName: newUser.displayName.trim(),
          email: newUser.email.trim(),
          role: newUser.role,
          strNumber: newUser.strNumber.trim() || undefined,
          sipNumber: newUser.sipNumber.trim() || undefined
        });
        setNewUser({
          username: '',
          password: '',
          displayName: '',
          email: '',
          role: 'DOKTER_SPOG',
          strNumber: '',
          sipNumber: ''
        });
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal membuat akun.', 'error');
      }
    };

    const handleSaveEditUser = async () => {
      if (!editingUser) return;
      try {
        await updateStaffAccount(editingUser.id, {
          username: editingUser.username,
          displayName: editingUser.displayName,
          email: editingUser.email,
          role: editingUser.role,
          active: editingUser.active,
          strNumber: editingUser.strNumber || '',
          sipNumber: editingUser.sipNumber || ''
        });
        setEditingUser(null);
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal memperbarui akun.', 'error');
      }
    };

    const handleResetPassword = async (userId: string) => {
      if (resetPasswordValue.length < 6) {
        notifyToast('Password baru minimal 6 karakter.', 'error');
        return;
      }
      try {
        await updateStaffAccount(userId, { newPassword: resetPasswordValue });
        setResetTargetUserId(null);
        setResetPasswordValue('');
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal reset password.', 'error');
      }
    };

    const handleDeleteUser = async (userId: string) => {
      try {
        await deleteStaffAccount(userId);
        setConfirmDeleteKey(null);
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal menghapus pengguna.', 'error');
      }
    };

    const pendingRequests = (dbState.access_requests || []).filter((r) => r.status === 'pending');
    const reviewedRequests = (dbState.access_requests || []).filter((r) => r.status !== 'pending');

    const handleApproveReq = async (req: AccessRequest) => {
      const chosenRole = approvalRoles[req.id] || req.requestedRole || 'DOKTER_SPOG';
      setProcessingReqId(req.id);
      try {
        await approveAccessRequest(req, chosenRole, {
          strNumber: approvalStr[req.id] || '',
          sipNumber: approvalSip[req.id] || ''
        });
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal menyetujui akun.', 'error');
      } finally {
        setProcessingReqId(null);
      }
    };

    const handleRejectReq = async (req: AccessRequest) => {
      setProcessingReqId(req.id);
      try {
        await rejectAccessRequest(req, rejectReason);
        setRejectingReqId(null);
        setRejectReason('');
      } catch (err) {
        notifyToast(err instanceof Error ? err.message : 'Gagal menolak permintaan.', 'error');
      } finally {
        setProcessingReqId(null);
      }
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Pengguna &amp; Enkripsi E2EE Per Akun</h1>
          <p className="text-sm text-slate-500">
            Setujui pendaftaran akun baru dan tentukan role secara real-time, atau tambah/edit/hapus akun staf. Fingerprint Vault:{' '}
            <span className="font-mono text-teal-800 font-semibold">{e2eeFingerprint || 'N/A'}</span>
          </p>
        </div>

        {/* Access Requests Approval Queue */}
        <div
          className={`bg-white rounded-xl p-5 space-y-4 border ${
            pendingRequests.length > 0 ? 'border-amber-300 ring-1 ring-amber-100' : 'border-slate-200'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div
                className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                  pendingRequests.length > 0 ? 'bg-amber-50 text-amber-700' : 'bg-slate-100 text-slate-600'
                }`}
              >
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span>Permintaan Persetujuan Akun Baru</span>
                  {pendingRequests.length > 0 && (
                    <span className="px-2 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-mono tabular-nums">
                      {pendingRequests.length} Menunggu
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500">
                  Pengguna yang mendaftar lewat email atau masuk dengan Google baru wajib disetujui dan ditetapkan rolenya di sini.
                </p>
              </div>
            </div>
            {reviewedRequests.length > 0 && (
              <button
                type="button"
                onClick={() => setShowReviewedRequests((v) => !v)}
                className="text-xs font-semibold text-teal-700 hover:text-teal-900"
              >
                {showReviewedRequests
                  ? 'Sembunyikan Riwayat'
                  : `Lihat Riwayat (${reviewedRequests.length})`}
              </button>
            )}
          </div>

          {pendingRequests.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 px-4 py-5 text-center text-xs text-slate-500">
              Tidak ada permintaan akun baru yang menunggu persetujuan saat ini.
            </div>
          ) : (
            <div className="space-y-3">
              {pendingRequests.map((req) => {
                const selectedRole = approvalRoles[req.id] || req.requestedRole || 'DOKTER_SPOG';
                const isRejecting = rejectingReqId === req.id;
                const isBusy = processingReqId === req.id;

                return (
                  <div
                    key={req.id}
                    className="rounded-xl border border-amber-200 bg-amber-50/30 p-4 space-y-3.5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-0.5 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-bold text-slate-900">{req.displayName}</span>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                            {req.authProvider === 'google' ? 'Google' : 'Email & Sandi'}
                          </span>
                          {req.requestedRole && (
                            <span className="text-[11px] px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-medium">
                              Usulan: {ROLE_LABELS[req.requestedRole]}
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-mono text-slate-600 break-all">
                          {req.email} · username: {req.username}
                        </p>
                        {req.requestedNote && (
                          <p className="text-xs text-slate-600 pt-0.5">
                            <span className="font-semibold text-slate-700">Catatan:</span> {req.requestedNote}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-mono tabular-nums text-slate-500 shrink-0">
                        {new Date(req.createdAt).toLocaleString('id-ID')}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 items-end pt-2 border-t border-amber-200/70">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                          Tetapkan Role Akun
                        </label>
                        <select
                          value={selectedRole}
                          onChange={(e) =>
                            setApprovalRoles((prev) => ({ ...prev, [req.id]: e.target.value as RoleCode }))
                          }
                          className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg bg-white font-medium text-slate-900"
                        >
                          <option value="DOKTER_SPOG">Dokter Sp.OG</option>
                          <option value="ASISTEN_DOKTER">Asisten Dokter</option>
                          <option value="SUPER_ADMIN">Super Admin</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          No. STR (Opsional)
                        </label>
                        <input
                          type="text"
                          value={approvalStr[req.id] || ''}
                          onChange={(e) =>
                            setApprovalStr((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Nomor STR"
                          className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                          No. SIP (Opsional)
                        </label>
                        <input
                          type="text"
                          value={approvalSip[req.id] || ''}
                          onChange={(e) =>
                            setApprovalSip((prev) => ({ ...prev, [req.id]: e.target.value }))
                          }
                          placeholder="Nomor SIP"
                          className="w-full h-9 px-2.5 text-xs border border-slate-300 rounded-lg bg-white font-mono"
                        />
                      </div>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleApproveReq(req)}
                        className="h-9 px-3.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        {isBusy ? 'Memproses...' : 'Setujui & Aktifkan'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setRejectingReqId(isRejecting ? null : req.id);
                          setRejectReason('');
                        }}
                        className="h-9 px-3.5 rounded-lg border border-red-200 bg-white hover:bg-red-50 disabled:opacity-60 text-red-700 text-xs font-semibold inline-flex items-center justify-center gap-1.5 whitespace-nowrap"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        Tolak
                      </button>
                    </div>

                    {isRejecting && (
                      <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-red-200/70">
                        <input
                          type="text"
                          value={rejectReason}
                          onChange={(e) => setRejectReason(e.target.value)}
                          placeholder="Alasan penolakan (opsional, akan terlihat oleh pendaftar)..."
                          className="flex-1 h-9 px-3 text-xs border border-red-300 rounded-lg bg-white"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void handleRejectReq(req)}
                            className="h-9 px-3.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold whitespace-nowrap"
                          >
                            Konfirmasi Tolak
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setRejectingReqId(null);
                              setRejectReason('');
                            }}
                            className="h-9 px-3 rounded-lg border border-slate-200 bg-white text-slate-600 text-xs font-semibold"
                          >
                            Batal
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {showReviewedRequests && reviewedRequests.length > 0 && (
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <p className="text-xs font-semibold text-slate-700">Riwayat Keputusan Persetujuan</p>
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold">Pendaftar</th>
                      <th className="px-3 py-2 text-left font-semibold">Status</th>
                      <th className="px-3 py-2 text-left font-semibold">Role / Catatan</th>
                      <th className="px-3 py-2 text-left font-semibold">Diproses Oleh</th>
                      <th className="px-3 py-2 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reviewedRequests.map((req) => (
                      <tr key={req.id}>
                        <td className="px-3 py-2">
                          <p className="font-semibold text-slate-900">{req.displayName}</p>
                          <p className="text-[11px] font-mono text-slate-500">{req.email}</p>
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={`font-semibold ${
                              req.status === 'approved' ? 'text-emerald-700' : 'text-red-700'
                            }`}
                          >
                            {req.status === 'approved' ? 'Disetujui' : 'Ditolak'}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {req.status === 'approved' && req.assignedRole
                            ? ROLE_LABELS[req.assignedRole]
                            : req.rejectionReason || '-'}
                        </td>
                        <td className="px-3 py-2 text-slate-500">
                          {req.reviewedByName || '-'}
                          {req.reviewedAt ? ` · ${new Date(req.reviewedAt).toLocaleDateString('id-ID')}` : ''}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteRecord('access_requests', req.id);
                              notifyToast('Riwayat permintaan dihapus.', 'info');
                            }}
                            className="text-slate-500 hover:text-red-700 font-semibold"
                          >
                            Hapus
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleCreateUser} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700" />
            Tambah Akun Pengguna Baru (Dokter / Asisten / Super Admin)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              placeholder="Username login (min. 3 karakter)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <input
              type="password"
              required
              minLength={6}
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              placeholder="Password (min. 6 karakter)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              required
              value={newUser.displayName}
              onChange={(e) => setNewUser({ ...newUser, displayName: e.target.value })}
              placeholder="Nama lengkap & gelar"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <select
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as RoleCode })}
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              <option value="DOKTER_SPOG">Dokter Sp.OG</option>
              <option value="ASISTEN_DOKTER">Asisten Dokter</option>
              <option value="SUPER_ADMIN">Super Admin</option>
            </select>
            <input
              type="email"
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              placeholder="Email Google / Staf"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={newUser.strNumber}
              onChange={(e) => setNewUser({ ...newUser, strNumber: e.target.value })}
              placeholder="Nomor STR (opsional)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={newUser.sipNumber}
              onChange={(e) => setNewUser({ ...newUser, sipNumber: e.target.value })}
              placeholder="Nomor SIP (opsional)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              Buat Akun Pengguna
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Username</th>
                  <th className="px-4 py-3 text-left font-semibold">Nama, Email &amp; STR/SIP</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Kunci E2EE</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.users.map((u) => {
                  const isSelf = u.id === currentUser.id;
                  const isEditing = editingUser?.id === u.id;
                  const deleteKey = `usr:${u.id}`;
                  return (
                    <React.Fragment key={u.id}>
                      <tr className={isEditing ? 'bg-teal-50/40' : ''}>
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editingUser.username}
                              onChange={(e) => setEditingUser({ ...editingUser, username: e.target.value })}
                              className="w-32 px-2 py-1 border border-slate-300 rounded font-mono bg-white"
                            />
                          ) : (
                            u.username
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {isEditing ? (
                            <div className="space-y-1.5 min-w-[220px]">
                              <input
                                type="text"
                                value={editingUser.displayName}
                                onChange={(e) => setEditingUser({ ...editingUser, displayName: e.target.value })}
                                placeholder="Nama lengkap"
                                className="w-full px-2 py-1 border border-slate-300 rounded bg-white font-semibold"
                              />
                              <input
                                type="email"
                                value={editingUser.email}
                                onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                                placeholder="Email Google / staf"
                                className="w-full px-2 py-1 border border-slate-300 rounded bg-white text-[11px]"
                              />
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  value={editingUser.strNumber || ''}
                                  onChange={(e) => setEditingUser({ ...editingUser, strNumber: e.target.value })}
                                  placeholder="No. STR"
                                  className="px-2 py-1 border border-slate-200 rounded bg-white font-mono text-[11px]"
                                />
                                <input
                                  type="text"
                                  value={editingUser.sipNumber || ''}
                                  onChange={(e) => setEditingUser({ ...editingUser, sipNumber: e.target.value })}
                                  placeholder="No. SIP"
                                  className="px-2 py-1 border border-slate-200 rounded bg-white font-mono text-[11px]"
                                />
                              </div>
                            </div>
                          ) : (
                            <div>
                              <p className="font-semibold text-slate-900">{u.displayName}</p>
                              <p className="text-[11px] text-slate-500">{u.email}</p>
                              {(u.strNumber || u.sipNumber) && (
                                <p className="text-[10px] font-mono text-slate-400 mt-0.5">
                                  {u.strNumber ? `STR: ${u.strNumber}` : ''}
                                  {u.strNumber && u.sipNumber ? ' · ' : ''}
                                  {u.sipNumber ? `SIP: ${u.sipNumber}` : ''}
                                </p>
                              )}
                              <p className="text-[10px] mt-0.5 text-slate-500">
                                TTD Digital:{' '}
                                <span className={u.signatureUrl ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                                  {u.signatureUrl ? 'Tersimpan' : 'Belum diatur'}
                                </span>
                              </p>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3 font-semibold text-teal-800">
                          {isEditing && !isSelf ? (
                            <select
                              value={editingUser.role}
                              onChange={(e) => setEditingUser({ ...editingUser, role: e.target.value as RoleCode })}
                              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
                            >
                              <option value="DOKTER_SPOG">Dokter Sp.OG</option>
                              <option value="ASISTEN_DOKTER">Asisten Dokter</option>
                              <option value="SUPER_ADMIN">Super Admin</option>
                            </select>
                          ) : (
                            ROLE_LABELS[u.role]
                          )}
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                          {u.e2eeFingerprint ? `AES-256-GCM · ${u.e2eeFingerprint}` : 'Terlindung'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={u.active ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                            {u.active ? 'Aktif' : 'Nonaktif'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2.5 whitespace-nowrap">
                          {isEditing ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleSaveEditUser()}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-teal-700 text-white font-semibold hover:bg-teal-800"
                              >
                                <Check className="w-3 h-3" />
                                Simpan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingUser(null)}
                                className="px-2 py-1 rounded border border-slate-300 text-slate-600"
                              >
                                Batal
                              </button>
                            </>
                          ) : confirmDeleteKey === deleteKey ? (
                            <>
                              <button
                                type="button"
                                onClick={() => void handleDeleteUser(u.id)}
                                className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                              >
                                Ya, Hapus
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteKey(null)}
                                className="text-slate-600"
                              >
                                Batal
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetUserId(null);
                                  setEditingUser({ ...u });
                                }}
                                className="text-teal-700 hover:text-teal-900 font-semibold"
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setSigModalUser(u);
                                  setSigDraft(u.signatureUrl || '');
                                }}
                                className="text-teal-800 hover:text-teal-950 font-semibold"
                              >
                                TTD
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingUser(null);
                                  setResetTargetUserId(resetTargetUserId === u.id ? null : u.id);
                                }}
                                className="text-slate-700 hover:text-slate-900 font-semibold"
                              >
                                Reset Password
                              </button>
                              {!isSelf && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => void updateStaffAccount(u.id, { active: !u.active })}
                                    className="text-slate-600 hover:text-slate-900 font-semibold"
                                  >
                                    {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteKey(deleteKey)}
                                    className="text-red-600 hover:text-red-800 font-semibold"
                                  >
                                    Hapus
                                  </button>
                                </>
                              )}
                            </>
                          )}
                        </td>
                      </tr>
                      {resetTargetUserId === u.id && (
                        <tr className="bg-slate-50">
                          <td colSpan={6} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="password"
                                value={resetPasswordValue}
                                onChange={(e) => setResetPasswordValue(e.target.value)}
                                placeholder="Password baru (min. 6 karakter, re-wrap E2EE otomatis)"
                                className="flex-1 min-w-[240px] px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => void handleResetPassword(u.id)}
                                className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
                              >
                                Simpan Password Baru
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setResetTargetUserId(null);
                                  setResetPasswordValue('');
                                }}
                                className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs text-slate-600"
                              >
                                Batal
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {sigModalUser && (
          <div
            className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4"
            role="dialog"
            aria-modal="true"
            aria-label={`Atur Tanda Tangan ${sigModalUser.displayName}`}
          >
            <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <PenTool className="w-4 h-4 text-teal-700" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Tanda Tangan Digital — {sigModalUser.displayName}
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSigModalUser(null)}
                  className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <SignatureInput
                value={sigDraft}
                onChange={setSigDraft}
                label={`Tanda Tangan (${ROLE_LABELS[sigModalUser.role]})`}
                helperText="Akan tampil otomatis di setiap dokumen yang dicetak oleh pengguna ini."
              />
              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setSigModalUser(null)}
                  className="px-3.5 py-2 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Batal
                </button>
                <button
                  type="button"
                  disabled={savingUserSig}
                  onClick={async () => {
                    setSavingUserSig(true);
                    try {
                      await updateStaffAccount(sigModalUser.id, { signatureUrl: sigDraft });
                      setSigModalUser(null);
                    } catch (err) {
                      notifyToast(err instanceof Error ? err.message : 'Gagal menyimpan tanda tangan.', 'error');
                    } finally {
                      setSavingUserSig(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
                >
                  {savingUserSig ? 'Menyimpan...' : 'Simpan Tanda Tangan'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== VIEW: GRANULAR RBAC PERMISSIONS & ROLE EDITOR ====================
  if (activeView === 'settings-permissions') {
    const togglePermission = async (roleCode: 'DOKTER_SPOG' | 'ASISTEN_DOKTER', permKey: string) => {
      if (roleCode === 'ASISTEN_DOKTER' && HARD_LOCKED_ASSISTANT.includes(permKey)) return;
      if (roleCode === 'DOKTER_SPOG' && HARD_LOCKED_DOCTOR.includes(permKey)) return;
      const roleDef = dbState.roles.find((r) => r.code === roleCode);
      if (!roleDef) return;
      const exists = roleDef.permissions.includes(permKey);
      const nextPerms = exists
        ? roleDef.permissions.filter((p) => p !== permKey)
        : [...roleDef.permissions, permKey];
      await upsertRecord('roles', { ...roleDef, permissions: nextPerms });
      notifyToast(`Hak akses ${roleDef.name} diperbarui.`, 'success');
    };

    const handleSaveRoleMeta = async () => {
      if (!editingRole) return;
      await upsertRecord('roles', {
        ...editingRole,
        name: editingRole.name.trim() || ROLE_LABELS[editingRole.code],
        description: editingRole.description.trim()
      });
      setEditingRole(null);
      notifyToast('Detail role berhasil diperbarui dan disimpan online.', 'success');
    };

    const handleAddPermission = async (e: React.FormEvent) => {
      e.preventDefault();
      const keyNorm = newPerm.key.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '');
      if (!keyNorm || !newPerm.label.trim()) {
        notifyToast('Isi kode key dan label kewenangan.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const item: PermissionDefinition = {
        id: `perm-${keyNorm.replace(/\./g, '-')}-${Date.now().toString(36)}`,
        key: keyNorm,
        module: newPerm.module.trim() || 'Kustom',
        label: newPerm.label.trim(),
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('permissions', item);
      setNewPerm({ key: '', module: 'Pengaturan', label: '' });
      notifyToast(`Variabel hak akses "${item.key}" ditambahkan.`, 'success');
    };

    const dokterRole = dbState.roles.find((r) => r.code === 'DOKTER_SPOG');
    const asistenRole = dbState.roles.find((r) => r.code === 'ASISTEN_DOKTER');

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Role &amp; Matriks Hak Akses Granular (RBAC)</h1>
          <p className="text-sm text-slate-500">
            Ubah nama/deskripsi role, tambah variabel hak akses baru, dan atur kewenangan per modul secara granular.
          </p>
        </div>

        {/* Editable Role Descriptions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {dbState.roles.map((r) => {
            const isEditing = editingRole?.id === r.id;
            return (
              <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] font-semibold text-teal-800">{r.code}</span>
                  {isEditing ? (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void handleSaveRoleMeta()}
                        className="px-2 py-1 rounded bg-teal-700 text-white text-[11px] font-semibold"
                      >
                        Simpan
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingRole(null)}
                        className="px-2 py-1 rounded border border-slate-200 text-[11px] text-slate-600"
                      >
                        Batal
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingRole({ ...r })}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-teal-700 hover:text-teal-900"
                    >
                      <Edit3 className="w-3 h-3" />
                      Edit
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={editingRole.name}
                      onChange={(e) => setEditingRole({ ...editingRole, name: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs font-semibold border border-slate-300 rounded-lg"
                    />
                    <textarea
                      rows={3}
                      value={editingRole.description}
                      onChange={(e) => setEditingRole({ ...editingRole, description: e.target.value })}
                      className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-sm font-bold text-slate-900">{r.name}</h2>
                    <p className="text-xs text-slate-600 leading-relaxed">{r.description}</p>
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* Add Custom Permission Variable */}
        <form
          onSubmit={handleAddPermission}
          className="bg-white border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-4 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Key Kewenangan Baru</label>
            <input
              type="text"
              value={newPerm.key}
              onChange={(e) => setNewPerm({ ...newPerm, key: e.target.value })}
              placeholder="mis. reports.export_excel"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Modul</label>
            <input
              type="text"
              value={newPerm.module}
              onChange={(e) => setNewPerm({ ...newPerm, module: e.target.value })}
              placeholder="Laporan"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Label Deskripsi</label>
            <input
              type="text"
              value={newPerm.label}
              onChange={(e) => setNewPerm({ ...newPerm, label: e.target.value })}
              placeholder="Ekspor laporan bulanan"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Hak Akses
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Modul</th>
                  <th className="px-4 py-3 text-left font-semibold">Kewenangan</th>
                  <th className="px-4 py-3 text-center font-semibold">Super Admin</th>
                  <th className="px-4 py-3 text-center font-semibold">Dokter Sp.OG</th>
                  <th className="px-4 py-3 text-center font-semibold">Asisten Dokter</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {mergedPermissions.map((perm) => {
                  const docLocked = HARD_LOCKED_DOCTOR.includes(perm.key);
                  const astLocked = HARD_LOCKED_ASSISTANT.includes(perm.key);
                  const docChecked = Boolean(dokterRole?.permissions.includes(perm.key)) && !docLocked;
                  const astChecked = Boolean(asistenRole?.permissions.includes(perm.key)) && !astLocked;
                  return (
                    <tr key={perm.key} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{perm.module}</td>
                      <td className="px-4 py-2.5">
                        <p className="text-slate-700">{perm.label}</p>
                        <p className="text-[10px] font-mono text-slate-400">{perm.key}</p>
                      </td>
                      <td className="px-4 py-2.5 text-center text-emerald-700 font-semibold">Penuh</td>
                      <td className="px-4 py-2.5 text-center">
                        {docLocked ? (
                          <span className="text-[11px] text-red-700 font-semibold">Dilarang (Kasir)</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={docChecked}
                            onChange={() => void togglePermission('DOKTER_SPOG', perm.key)}
                            aria-label={`Dokter Sp.OG ${perm.label}`}
                            className="w-4 h-4 accent-teal-700 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        {astLocked ? (
                          <span className="text-[11px] text-red-700 font-semibold">Dilarang (Medis)</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={astChecked}
                            onChange={() => void togglePermission('ASISTEN_DOKTER', perm.key)}
                            aria-label={`Asisten Dokter ${perm.label}`}
                            className="w-4 h-4 accent-teal-700 cursor-pointer"
                          />
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        {perm.isCustom && perm.id ? (
                          <button
                            type="button"
                            onClick={async () => {
                              await deleteRecord('permissions', perm.id!);
                              notifyToast(`Hak akses kustom "${perm.key}" dihapus.`, 'info');
                            }}
                            className="text-red-600 hover:text-red-800 font-semibold"
                          >
                            Hapus
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-400">Standar</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: DOCUMENT TEMPLATES ====================
  if (activeView === 'settings-templates') {
    const handleSaveTemplates = async (e: React.FormEvent) => {
      e.preventDefault();
      await upsertRecord('system_settings', {
        ...systemSettings,
        templates: templatesForm
      });
      notifyToast('Template dokumen resmi berhasil diperbarui dan disimpan online.', 'success');
    };

    return (
      <form onSubmit={handleSaveTemplates} className="space-y-5 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Template Dokumen Resmi Praktik</h1>
            <p className="text-sm text-slate-500">
              Sesuaikan catatan kaki kuitansi, resep, disclaimer USG, surat keterangan, rujukan, dan laporan.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Template
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4">
          {(
            [
              ['kuitansiFooter', 'Catatan Kaki Kuitansi Pembayaran'],
              ['resepHeaderNote', 'Catatan Header Resep Obat'],
              ['usgDisclaimer', 'Disclaimer Laporan Hasil USG'],
              ['suratKeteranganBody', 'Isi Standar Surat Keterangan Medis'],
              ['suratRujukanHeader', 'Header Surat Rujukan Medis'],
              ['laporanFooter', 'Catatan Kaki Laporan Medis & Keuangan']
            ] as [keyof DocumentTemplates, string][]
          ).map(([key, label]) => (
            <div key={key}>
              <label className="block text-xs font-semibold text-slate-700 mb-1">{label}</label>
              <textarea
                rows={2}
                value={templatesForm[key]}
                onChange={(e) => setTemplatesForm({ ...templatesForm, [key]: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
              />
            </div>
          ))}
        </div>
      </form>
    );
  }

  // ==================== VIEW: INTEGRATIONS (ADD / EDIT / DELETE + CLOUD SYNC) ====================
  if (activeView === 'settings-integrations') {
    const samplePatient = dbState.patients[0];
    const satusehatCfg = dbState.integrations.find((i) => i.provider === 'SATUSEHAT_FHIR');
    const fhirPreview = samplePatient
      ? JSON.stringify(buildFhirPatientPreview(samplePatient, satusehatCfg?.organizationId || 'ORG-LOCAL'), null, 2)
      : JSON.stringify({ info: 'Tambahkan pasien terlebih dahulu untuk melihat pratinjau FHIR R4.' }, null, 2);

    const handleToggleIntegration = async (cfg: IntegrationConfig) => {
      await upsertRecord('integrations', {
        ...cfg,
        enabled: !cfg.enabled,
        lastTestedAt: new Date().toISOString()
      });
      notifyToast(`Status ${cfg.name} diperbarui.`, 'success');
    };

    const handleSaveEditIntegration = async () => {
      if (!editingIntegration) return;
      await upsertRecord('integrations', {
        ...editingIntegration,
        name: editingIntegration.name.trim(),
        endpointUrl: editingIntegration.endpointUrl.trim(),
        lastTestedAt: new Date().toISOString()
      });
      setEditingIntegration(null);
      notifyToast('Variabel konfigurasi integrasi disimpan ke database online.', 'success');
    };

    const handleAddIntegration = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newIntegration.name.trim() || !newIntegration.endpointUrl.trim()) {
        notifyToast('Nama integrasi dan URL endpoint wajib diisi.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const item: IntegrationConfig = {
        id: `int-${Date.now()}`,
        provider: newIntegration.provider.trim().toUpperCase() || 'CUSTOM_API',
        name: newIntegration.name.trim(),
        endpointUrl: newIntegration.endpointUrl.trim(),
        organizationId: newIntegration.organizationId.trim() || undefined,
        clientId: newIntegration.clientId.trim() || undefined,
        senderNumber: newIntegration.senderNumber.trim() || undefined,
        statusNote: newIntegration.statusNote.trim() || 'Integrasi eksternal terdaftar.',
        enabled: false,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('integrations', item);
      setNewIntegration({
        name: '',
        provider: 'CUSTOM_API',
        endpointUrl: '',
        organizationId: '',
        clientId: '',
        senderNumber: '',
        statusNote: ''
      });
      notifyToast('Konfigurasi integrasi baru ditambahkan.', 'success');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Integrasi API, Database Online Cloud Firestore &amp; SATUSEHAT</h1>
          <p className="text-sm text-slate-500">
            Kelola koneksi database online real-time serta tambah dan ubah seluruh variabel endpoint integrasi eksternal (SATUSEHAT FHIR R4, WhatsApp API, atau API kustom).
          </p>
        </div>

        {/* Automatic Cloud Firestore Sync Info Card (No Manual Connect Buttons) */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-start gap-3">
          <Cloud className={`w-5 h-5 mt-0.5 shrink-0 ${cloudSynced ? 'text-emerald-600' : 'text-teal-700'}`} />
          <div className="space-y-1">
            <p className="text-sm font-bold text-slate-900">
              Sinkronisasi Otomatis Cloud Firestore{' '}
              <span className={cloudSynced ? 'text-emerald-700' : 'text-slate-500'}>
                ({cloudSynced ? 'Aktif Real-Time' : 'Otomatis saat Login Google'})
              </span>
            </p>
            <p className="text-xs text-slate-600 leading-relaxed">
              {firebaseUser
                ? `Terhubung otomatis sebagai ${firebaseUser.email}. Seluruh operasi tambah, ubah, dan hapus data langsung tersimpan ke database online Cloud Firestore secara real-time tanpa tombol manual.`
                : 'Koneksi database online Cloud Firestore berjalan otomatis saat masuk dengan akun Google terdaftar. Pastikan domain situs Anda sudah dimasukkan ke Authorized Domains di Firebase Console.'}
            </p>
          </div>
        </div>

        {/* Add New Integration Form */}
        <form onSubmit={handleAddIntegration} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Plus className="w-4 h-4 text-teal-700" />
            Tambah Variabel Integrasi API Baru
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newIntegration.name}
              onChange={(e) => setNewIntegration({ ...newIntegration, name: e.target.value })}
              placeholder="Nama Integrasi (mis. BPJS / Lab Eksternal)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <input
              type="text"
              value={newIntegration.provider}
              onChange={(e) => setNewIntegration({ ...newIntegration, provider: e.target.value })}
              placeholder="Kode Provider (mis. CUSTOM_API)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="url"
              required
              value={newIntegration.endpointUrl}
              onChange={(e) => setNewIntegration({ ...newIntegration, endpointUrl: e.target.value })}
              placeholder="https://api.example.com/v1"
              className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={newIntegration.organizationId}
              onChange={(e) => setNewIntegration({ ...newIntegration, organizationId: e.target.value })}
              placeholder="Organization ID (opsional)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={newIntegration.clientId}
              onChange={(e) => setNewIntegration({ ...newIntegration, clientId: e.target.value })}
              placeholder="Client ID (opsional)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={newIntegration.statusNote}
              onChange={(e) => setNewIntegration({ ...newIntegration, statusNote: e.target.value })}
              placeholder="Catatan konfigurasi"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              className="py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
            >
              Simpan Integrasi Baru
            </button>
          </div>
        </form>

        {/* Editable Integration Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {dbState.integrations.map((cfg) => {
            const isEditing = editingIntegration?.id === cfg.id;
            const deleteKey = `int:${cfg.id}`;
            return (
              <div key={cfg.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Link2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <h2 className="text-sm font-bold text-slate-900 truncate">{cfg.name}</h2>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => void handleToggleIntegration(cfg)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                        cfg.enabled
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                          : 'border-slate-200 bg-slate-50 text-slate-600'
                      }`}
                    >
                      {cfg.enabled ? 'Aktif' : 'Nonaktif'}
                    </button>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => setEditingIntegration({ ...cfg })}
                        className="px-2.5 py-1 rounded-lg border border-slate-200 text-xs font-semibold text-teal-700 hover:bg-slate-50"
                      >
                        Edit
                      </button>
                    )}
                  </div>
                </div>

                {isEditing ? (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Nama Integrasi</label>
                        <input
                          type="text"
                          value={editingIntegration.name}
                          onChange={(e) => setEditingIntegration({ ...editingIntegration, name: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Kode Provider</label>
                        <input
                          type="text"
                          value={editingIntegration.provider}
                          onChange={(e) => setEditingIntegration({ ...editingIntegration, provider: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Endpoint URL</label>
                      <input
                        type="text"
                        value={editingIntegration.endpointUrl}
                        onChange={(e) => setEditingIntegration({ ...editingIntegration, endpointUrl: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Organization ID</label>
                        <input
                          type="text"
                          value={editingIntegration.organizationId || ''}
                          onChange={(e) =>
                            setEditingIntegration({ ...editingIntegration, organizationId: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Client ID</label>
                        <input
                          type="text"
                          value={editingIntegration.clientId || ''}
                          onChange={(e) => setEditingIntegration({ ...editingIntegration, clientId: e.target.value })}
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Nomor Pengirim</label>
                        <input
                          type="text"
                          value={editingIntegration.senderNumber || ''}
                          onChange={(e) =>
                            setEditingIntegration({ ...editingIntegration, senderNumber: e.target.value })
                          }
                          className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg font-mono"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-0.5">Catatan Status</label>
                      <textarea
                        rows={2}
                        value={editingIntegration.statusNote}
                        onChange={(e) => setEditingIntegration({ ...editingIntegration, statusNote: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-lg"
                      />
                    </div>
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        onClick={() => setEditingIntegration(null)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-600"
                      >
                        <X className="w-3.5 h-3.5" />
                        Batal
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSaveEditIntegration()}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
                      >
                        <Save className="w-3.5 h-3.5" />
                        Simpan Variabel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-slate-600">{cfg.statusNote}</p>
                    <div className="text-xs font-mono text-slate-500 break-all bg-slate-50 p-2.5 rounded-lg border border-slate-200 space-y-1">
                      <div>Endpoint: {cfg.endpointUrl}</div>
                      {cfg.organizationId && <div>Org ID: {cfg.organizationId}</div>}
                      {cfg.clientId && <div>Client ID: {cfg.clientId}</div>}
                      {cfg.senderNumber && <div>Sender: {cfg.senderNumber}</div>}
                    </div>
                    {cfg.provider !== 'FIREBASE_CLOUD' && (
                      <div className="flex justify-end">
                        {confirmDeleteKey === deleteKey ? (
                          <div className="flex items-center gap-2 text-xs">
                            <button
                              type="button"
                              onClick={async () => {
                                await deleteRecord('integrations', cfg.id);
                                setConfirmDeleteKey(null);
                                notifyToast(`Integrasi ${cfg.name} dihapus.`, 'info');
                              }}
                              className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteKey(null)}
                              className="text-slate-600"
                            >
                              Batal
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteKey(deleteKey)}
                            className="text-xs font-semibold text-red-600 hover:text-red-800"
                          >
                            Hapus Integrasi
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Pratinjau Payload HL7 FHIR R4 (Patient Resource)</h2>
          <pre className="text-[11px] font-mono bg-slate-900 text-teal-200 p-4 rounded-lg overflow-x-auto max-h-72">
            {fhirPreview}
          </pre>
        </div>
      </div>
    );
  }

  // ==================== VIEW: BACKUP & DEMO DATA ====================
  if (activeView === 'settings-backup') {
    const handleExportBackup = async () => {
      const jsonStr = JSON.stringify(dbState, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `obgyn-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      const nowIso = new Date().toISOString();
      const totalRecords = Object.values(dbState).reduce(
        (sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0),
        0
      );
      const rec: BackupRecord = {
        id: `bkp-${Date.now()}`,
        label: `Backup Manual ${new Date().toLocaleString('id-ID')}`,
        encrypted: true,
        recordCount: totalRecords,
        sizeKb: Math.max(1, Math.round(jsonStr.length / 1024)),
        triggerType: 'Manual',
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('backups', rec);
      notifyToast('File backup database JSON berhasil diunduh dan dicatat online.', 'success');
    };

    const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const parsed = JSON.parse(String(reader.result));
          await restoreBackupData(parsed);
        } catch {
          notifyToast('File backup JSON tidak valid.', 'error');
        }
      };
      reader.readAsText(file);
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Backup, Pemulihan Database &amp; Dataset Demonstrasi</h1>
          <p className="text-sm text-slate-500">
            Ekspor dan pulihkan seluruh koleksi database online. Data demonstrasi dipisahkan secara ketat (flag isDemo) agar tidak bercampur permanen dengan data produksi.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <DatabaseBackup className="w-5 h-5 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Backup &amp; Restore Database</h2>
            </div>
            <p className="text-xs text-slate-600">
              Unduh salinan lengkap seluruh 35 koleksi operasional praktik atau pulihkan dari arsip JSON sebelumnya langsung ke database online.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void handleExportBackup()}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                Unduh Backup JSON
              </button>
              <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer whitespace-nowrap">
                <Upload className="w-3.5 h-3.5" />
                Pulihkan dari File JSON
                <input type="file" accept="application/json" onChange={handleImportBackup} className="hidden" />
              </label>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Dataset Demonstrasi Terisolasi</h2>
            </div>
            <p className="text-xs text-slate-600">
              Muat contoh pasien, kunjungan, RME, kehamilan, USG, dan transaksi berlabel demo untuk pelatihan staf, lalu bersihkan kapan saja tanpa menghapus data pasien asli.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => void loadDemoData()}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                Muat Dataset Demonstrasi
              </button>
              {demoCount > 0 && (
                <button
                  type="button"
                  onClick={() => void clearDemoData()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border border-red-200 bg-red-50 text-red-700 text-xs font-semibold hover:bg-red-100 whitespace-nowrap"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Bersihkan Data Demo ({demoCount})
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Backup Tercatat</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Waktu</th>
                <th className="px-4 py-3 text-left font-semibold">Label</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah Record</th>
                <th className="px-4 py-3 text-right font-semibold">Ukuran</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dbState.backups.map((b) => (
                <tr key={b.id}>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-600">
                    {new Date(b.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-3 font-medium text-slate-900">{b.label}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{b.recordCount}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums">{b.sizeKb} KB</td>
                </tr>
              ))}
              {dbState.backups.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-slate-500">
                    Belum ada riwayat backup manual.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== VIEW: IMMUTABLE AUDIT LOG ====================
  const filteredLogs = dbState.audit_logs.filter((log) => {
    const matchesRole = auditRoleFilter === 'ALL' || log.role === auditRoleFilter;
    const q = auditSearch.trim().toLowerCase();
    const matchesQuery =
      !q ||
      log.userName.toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q) ||
      log.entity.toLowerCase().includes(q) ||
      (log.entityId || '').toLowerCase().includes(q);
    return matchesRole && matchesQuery;
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-teal-700" />
            Audit Log Sistem (Read-Only / Immutable)
          </h1>
          <p className="text-sm text-slate-500">
            Seluruh aktivitas login, akses, perubahan data pasien, rekam medis, dan transaksi keuangan terekam permanen.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={auditSearch}
            onChange={(e) => setAuditSearch(e.target.value)}
            placeholder="Cari pengguna, aksi, entitas..."
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg w-56"
          />
          <select
            value={auditRoleFilter}
            onChange={(e) => setAuditRoleFilter(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
          >
            <option value="ALL">Semua Role</option>
            <option value="SUPER_ADMIN">Super Admin</option>
            <option value="DOKTER_SPOG">Dokter Sp.OG</option>
            <option value="ASISTEN_DOKTER">Asisten Dokter</option>
          </select>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Waktu</th>
                <th className="px-4 py-3 text-left font-semibold">Pengguna</th>
                <th className="px-4 py-3 text-left font-semibold">Role</th>
                <th className="px-4 py-3 text-left font-semibold">Aksi</th>
                <th className="px-4 py-3 text-left font-semibold">Entitas</th>
                <th className="px-4 py-3 text-left font-semibold">Perangkat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.slice(0, 150).map((log) => (
                <tr key={log.id}>
                  <td className="px-4 py-2.5 font-mono tabular-nums text-slate-500 whitespace-nowrap">
                    {new Date(log.createdAt).toLocaleString('id-ID')}
                  </td>
                  <td className="px-4 py-2.5 font-semibold text-slate-900">{log.userName}</td>
                  <td className="px-4 py-2.5 text-teal-800 font-medium">{ROLE_LABELS[log.role]}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-800">{log.action}</td>
                  <td className="px-4 py-2.5 font-mono text-slate-600">
                    {log.entity}
                    {log.entityId ? `/${log.entityId}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-slate-500 max-w-[200px] truncate">{log.deviceInfo}</td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    Tidak ada catatan audit yang cocok.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
