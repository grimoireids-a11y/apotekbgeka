import React, { useMemo, useState } from 'react';
import {
  Building2,
  Cloud,
  DatabaseBackup,
  Download,
  KeyRound,
  Link2,
  Lock,
  Plus,
  Save,
  ScrollText,
  Shield,
  Trash2,
  Upload,
  UserPlus
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type {
  BackupRecord,
  DocumentTemplates,
  Icd10Code,
  IntegrationConfig,
  PracticeSettings,
  RoleCode,
  ServiceTariff
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

export const SettingsModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    firebaseUser,
    practice,
    systemSettings,
    e2eeFingerprint,
    upsertRecord,
    createStaffAccount,
    updateStaffAccount,
    loadDemoData,
    clearDemoData,
    restoreBackupData,
    connectFirebaseCloud,
    notifyToast
  } = usePractice();

  // Practice Profile form state
  const [practiceForm, setPracticeForm] = useState<PracticeSettings>(practice);

  // Tariff form state
  const [newTariff, setNewTariff] = useState({
    code: '',
    name: '',
    category: 'Konsultasi' as ServiceTariff['category'],
    price: 250000,
    durationMinutes: 20,
    description: ''
  });
  const [newIcd, setNewIcd] = useState({ code: '', name: '', category: 'Obstetri' });

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
  const [resetTargetUserId, setResetTargetUserId] = useState<string | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // Templates form state
  const [templatesForm, setTemplatesForm] = useState<DocumentTemplates>(systemSettings.templates);

  // Audit Log filters
  const [auditSearch, setAuditSearch] = useState('');
  const [auditRoleFilter, setAuditRoleFilter] = useState<string>('ALL');

  const demoCount = useMemo(
    () =>
      dbState.patients.filter((p) => p.isDemo).length +
      dbState.visits.filter((v) => v.isDemo).length,
    [dbState.patients, dbState.visits]
  );

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

  // ==================== VIEW: PRACTICE IDENTITY ====================
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

    const handleSavePractice = async (e: React.FormEvent) => {
      e.preventDefault();
      await upsertRecord('practice_settings', { ...practiceForm, id: practice.id || 'main' });
      notifyToast('Identitas praktik, penomoran otomatis, dan profil dokter berhasil diperbarui.', 'success');
    };

    return (
      <form onSubmit={handleSavePractice} className="space-y-6 max-w-4xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Identitas Praktik &amp; Format Penomoran</h1>
            <p className="text-sm text-slate-500">
              Ubah nama aplikasi/klinik, profil Dokter Sp.OG, alamat, logo resmi kop surat, dan format penomoran otomatis.
            </p>
          </div>
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            <Save className="w-3.5 h-3.5" />
            Simpan Perubahan
          </button>
        </div>

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
                <label className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 cursor-pointer">
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
      </form>
    );
  }

  // ==================== VIEW: TARIFFS & ICD-10 ====================
  if (activeView === 'settings-tariffs') {
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
      notifyToast('Tarif pelayanan ditambahkan.', 'success');
    };

    const handleAddIcd = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newIcd.code.trim() || !newIcd.name.trim()) return;
      const nowIso = new Date().toISOString();
      const item: Icd10Code = {
        id: `icd-${Date.now()}`,
        code: newIcd.code.trim().toUpperCase(),
        name: newIcd.name.trim(),
        category: newIcd.category,
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('icd10_codes', item);
      setNewIcd({ code: '', name: '', category: 'Obstetri' });
      notifyToast('Kode ICD-10 ditambahkan.', 'success');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Tarif Pelayanan &amp; Master ICD-10</h1>
          <p className="text-sm text-slate-500">Atur tarif konsultasi, USG, tindakan obstetri-ginekologi, dan katalog diagnosis ICD-10.</p>
        </div>

        <form
          onSubmit={handleAddTariff}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
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
              {['Konsultasi', 'Obstetri', 'Ginekologi', 'USG', 'Tindakan', 'Laboratorium', 'Administrasi'].map((c) => (
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
          <button
            type="submit"
            className="inline-flex items-center justify-center gap-1.5 py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah Tarif
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kode</th>
                <th className="px-4 py-3 text-left font-semibold">Nama Layanan</th>
                <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                <th className="px-4 py-3 text-right font-semibold">Tarif</th>
                <th className="px-4 py-3 text-left font-semibold">Status</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {dbState.services.map((s) => (
                <tr key={s.id}>
                  <td className="px-4 py-3 font-mono font-semibold text-teal-800">{s.code}</td>
                  <td className="px-4 py-3 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.category}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">
                    {formatCurrencyIDR(s.price)}
                  </td>
                  <td className="px-4 py-3">
                    <span className={s.active ? 'text-emerald-700 font-semibold' : 'text-slate-400'}>
                      {s.active ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => upsertRecord('services', { ...s, active: !s.active })}
                      className="text-xs font-semibold text-teal-700 hover:text-teal-900"
                    >
                      {s.active ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* ICD-10 Mini Manager */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Master Kode ICD-10 OBGYN ({dbState.icd10_codes.length})</h2>
          <form onSubmit={handleAddIcd} className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <input
              type="text"
              value={newIcd.code}
              onChange={(e) => setNewIcd({ ...newIcd, code: e.target.value })}
              placeholder="Kode (mis. O14.1)"
              className="px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono"
            />
            <input
              type="text"
              value={newIcd.name}
              onChange={(e) => setNewIcd({ ...newIcd, name: e.target.value })}
              placeholder="Deskripsi diagnosis ICD-10"
              className="sm:col-span-2 px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
            >
              Tambah ICD-10
            </button>
          </form>
        </div>
      </div>
    );
  }

  // ==================== VIEW: USERS & E2EE ACCOUNTS ====================
  if (activeView === 'settings-users') {
    const handleCreateUser = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newUser.username.trim() || !newUser.password.trim() || !newUser.displayName.trim()) {
        notifyToast('Username, password (min. 6 karakter), dan nama lengkap wajib diisi.', 'error');
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

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Pengguna &amp; Enkripsi E2EE Per Akun</h1>
          <p className="text-sm text-slate-500">
            Setiap akun staf menerima kunci vault AES-256-GCM terbungkus PBKDF2-SHA256 unik. Fingerprint Vault Aktif:{' '}
            <span className="font-mono text-teal-800 font-semibold">{e2eeFingerprint || 'N/A'}</span>
          </p>
        </div>

        <form
          onSubmit={handleCreateUser}
          className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
        >
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <UserPlus className="w-4 h-4 text-teal-700" />
            Buat Akun Staf Baru (Dokter / Asisten / Super Admin)
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <input
              type="text"
              required
              value={newUser.username}
              onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
              placeholder="Username login"
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
              placeholder="Email staf"
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
              Buat Akun + Kunci E2EE
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Username</th>
                  <th className="px-4 py-3 text-left font-semibold">Nama &amp; Email</th>
                  <th className="px-4 py-3 text-left font-semibold">Role</th>
                  <th className="px-4 py-3 text-left font-semibold">Kunci E2EE</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.users.map((u) => (
                  <React.Fragment key={u.id}>
                    <tr>
                      <td className="px-4 py-3 font-mono font-semibold text-slate-900">{u.username}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{u.displayName}</p>
                        <p className="text-[11px] text-slate-500">{u.email}</p>
                      </td>
                      <td className="px-4 py-3 font-semibold text-teal-800">{ROLE_LABELS[u.role]}</td>
                      <td className="px-4 py-3 font-mono text-[11px] text-slate-600">
                        {u.e2eeFingerprint ? `AES-256-GCM · ${u.e2eeFingerprint}` : 'Terlindung'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={u.active ? 'text-emerald-700 font-semibold' : 'text-red-700 font-semibold'}>
                          {u.active ? 'Aktif' : 'Nonaktif'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right space-x-3 whitespace-nowrap">
                        <button
                          type="button"
                          onClick={() => setResetTargetUserId(resetTargetUserId === u.id ? null : u.id)}
                          className="text-teal-700 hover:text-teal-900 font-semibold"
                        >
                          Reset Password
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            type="button"
                            onClick={() => updateStaffAccount(u.id, { active: !u.active })}
                            className="text-slate-600 hover:text-slate-900 font-semibold"
                          >
                            {u.active ? 'Nonaktifkan' : 'Aktifkan'}
                          </button>
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
                              onClick={() => handleResetPassword(u.id)}
                              className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
                            >
                              Simpan Password Baru
                            </button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: GRANULAR RBAC PERMISSIONS ====================
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
      notifyToast(`Hak akses ${ROLE_LABELS[roleCode]} diperbarui.`, 'success');
    };

    const dokterRole = dbState.roles.find((r) => r.code === 'DOKTER_SPOG');
    const asistenRole = dbState.roles.find((r) => r.code === 'ASISTEN_DOKTER');

    return (
      <div className="space-y-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Matriks Hak Akses Granular (RBAC)</h1>
          <p className="text-sm text-slate-500">
            Atur kewenangan spesifik per modul. Pemisahan mutlak medis vs kasir dikunci secara sistem untuk kepatuhan klinis.
          </p>
        </div>

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
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {PERMISSION_CATALOG.map((perm) => {
                  const docLocked = HARD_LOCKED_DOCTOR.includes(perm.key);
                  const astLocked = HARD_LOCKED_ASSISTANT.includes(perm.key);
                  const docChecked = Boolean(dokterRole?.permissions.includes(perm.key)) && !docLocked;
                  const astChecked = Boolean(asistenRole?.permissions.includes(perm.key)) && !astLocked;
                  return (
                    <tr key={perm.key} className="hover:bg-slate-50/70">
                      <td className="px-4 py-2.5 font-semibold text-slate-800">{perm.module}</td>
                      <td className="px-4 py-2.5 text-slate-700">{perm.label}</td>
                      <td className="px-4 py-2.5 text-center text-emerald-700 font-semibold">Penuh</td>
                      <td className="px-4 py-2.5 text-center">
                        {docLocked ? (
                          <span className="text-[11px] text-red-700 font-semibold">Dilarang (Kasir)</span>
                        ) : (
                          <input
                            type="checkbox"
                            checked={docChecked}
                            onChange={() => togglePermission('DOKTER_SPOG', perm.key)}
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
                            onChange={() => togglePermission('ASISTEN_DOKTER', perm.key)}
                            aria-label={`Asisten Dokter ${perm.label}`}
                            className="w-4 h-4 accent-teal-700 cursor-pointer"
                          />
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
      notifyToast('Template dokumen resmi berhasil diperbarui.', 'success');
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

  // ==================== VIEW: INTEGRATIONS (SATUSEHAT / WHATSAPP / FIREBASE) ====================
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
      notifyToast(`Konfigurasi ${cfg.name} diperbarui.`, 'success');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Integrasi API, Cloud Firestore &amp; Kesiapan SATUSEHAT</h1>
          <p className="text-sm text-slate-500">
            Arsitektur siap integrasi HL7 FHIR R4, WhatsApp Business API, dan sinkronisasi Cloud Firestore. Catatan kepatuhan: integrasi SATUSEHAT memerlukan proses registrasi dan uji kepatuhan resmi Kemenkes sebelum produksi.
          </p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Cloud className="w-5 h-5 text-teal-700" />
            <div>
              <p className="text-sm font-bold text-slate-900">Firebase Cloud Firestore Real-Time Sync</p>
              <p className="text-xs text-slate-500">
                {firebaseUser
                  ? `Terhubung sebagai ${firebaseUser.email}`
                  : 'Hubungkan akun Google Anda untuk menyinkronkan database langsung ke Cloud Firestore.'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={connectFirebaseCloud}
            className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            {firebaseUser ? 'Sinkronkan Ulang Cloud' : 'Hubungkan Firebase Cloud'}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {dbState.integrations.map((cfg) => (
            <div key={cfg.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Link2 className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-bold text-slate-900">{cfg.name}</h2>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggleIntegration(cfg)}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold border whitespace-nowrap ${
                    cfg.enabled
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {cfg.enabled ? 'Aktif' : 'Nonaktif'}
                </button>
              </div>
              <p className="text-xs text-slate-600">{cfg.statusNote}</p>
              <div className="text-xs font-mono text-slate-500 break-all bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                Endpoint: {cfg.endpointUrl}
              </div>
            </div>
          ))}
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
      notifyToast('File backup database JSON berhasil diunduh dan dicatat.', 'success');
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
            Ekspor dan pulihkan seluruh koleksi database. Data demonstrasi dipisahkan secara ketat (flag isDemo) agar tidak bercampur permanen dengan data produksi.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
            <div className="flex items-center gap-2">
              <DatabaseBackup className="w-5 h-5 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Backup &amp; Restore Database</h2>
            </div>
            <p className="text-xs text-slate-600">
              Unduh salinan lengkap seluruh 35 koleksi operasional praktik atau pulihkan dari arsip JSON sebelumnya.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
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
                onClick={loadDemoData}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                Muat Dataset Demonstrasi
              </button>
              {demoCount > 0 && (
                <button
                  type="button"
                  onClick={clearDemoData}
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
