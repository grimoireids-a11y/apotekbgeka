import type { NavView, RoleCode, RoleDefinition } from '../types/models';

export interface PermissionCatalogItem {
  key: string;
  module: string;
  label: string;
}

export const PERMISSION_CATALOG: PermissionCatalogItem[] = [
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

export const DEFAULT_ROLE_PERMISSIONS: Record<RoleCode, string[]> = {
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

export const ROLE_LABELS: Record<RoleCode, string> = {
  SUPER_ADMIN: 'Super Admin',
  DOKTER_SPOG: 'Dokter Sp.OG',
  ASISTEN_DOKTER: 'Asisten Dokter'
};

export function hasPermission(
  role: RoleCode,
  permissionKey: string,
  customRoles?: RoleDefinition[]
): boolean {
  if (role === 'SUPER_ADMIN') return true;
  // Hard clinical/financial separation invariants that cannot be accidentally violated
  if (role === 'ASISTEN_DOKTER' && ['rme.write', 'rme.sign_lock', 'prescriptions.write', 'patients.delete', 'cashier.refund_approve'].includes(permissionKey)) {
    return false;
  }
  if (role === 'DOKTER_SPOG' && ['cashier.operate', 'cashier.refund_approve'].includes(permissionKey)) {
    return false;
  }
  const found = customRoles?.find((r) => r.code === role);
  const perms = found?.permissions?.length ? found.permissions : DEFAULT_ROLE_PERMISSIONS[role];
  return perms.includes(permissionKey);
}

export function canEditMedicalRecord(role: RoleCode, recordStatus: 'draft' | 'signed' | 'locked'): boolean {
  if (role === 'ASISTEN_DOKTER') return false;
  if (recordStatus === 'locked') return role === 'SUPER_ADMIN';
  return role === 'DOKTER_SPOG' || role === 'SUPER_ADMIN';
}

export function canModifyProcessedPayment(role: RoleCode): boolean {
  return role === 'SUPER_ADMIN' || role === 'ASISTEN_DOKTER';
}

export function canApproveRefund(role: RoleCode): boolean {
  return role === 'SUPER_ADMIN';
}

export interface SidebarGroup {
  title: string;
  items: { view: NavView; label: string; roles: RoleCode[] }[];
}

export const SIDEBAR_MENU: SidebarGroup[] = [
  {
    title: 'UTAMA',
    items: [
      { view: 'dashboard', label: 'Dashboard', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'MANAJEMEN PASIEN',
    items: [
      { view: 'patients', label: 'Data Pasien', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'patient-register', label: 'Registrasi Pasien', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'visits', label: 'Kunjungan', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'queue', label: 'Antrean', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'PELAYANAN MEDIS',
    items: [
      { view: 'rme', label: 'Rekam Medis', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'obstetric', label: 'Pemeriksaan Obstetri', roles: ['SUPER_ADMIN', 'DOKTER_SPOG'] },
      { view: 'gynecology', label: 'Pemeriksaan Ginekologi', roles: ['SUPER_ADMIN', 'DOKTER_SPOG'] },
      { view: 'pregnancy', label: 'Manajemen Kehamilan', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'usg', label: 'USG', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'procedures', label: 'Tindakan Medis', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'prescriptions', label: 'Resep', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'laboratory', label: 'Laboratorium', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'ADMINISTRASI',
    items: [
      { view: 'schedule', label: 'Jadwal Praktik', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'appointments', label: 'Jadwal Kontrol', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'documents', label: 'Dokumen', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'notifications', label: 'Notifikasi', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'KEUANGAN',
    items: [
      { view: 'cashier', label: 'Kasir', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'invoices', label: 'Tagihan', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'payments', label: 'Pembayaran', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'receivables', label: 'Piutang', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'cash-in', label: 'Kas Masuk', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'cash-out', label: 'Kas Keluar', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'cash-close', label: 'Tutup Kas', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] },
      { view: 'finance-reports', label: 'Laporan Keuangan', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'LAPORAN',
    items: [
      { view: 'report-patients', label: 'Laporan Pasien', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'report-visits', label: 'Laporan Kunjungan', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'report-medical', label: 'Laporan Medis', roles: ['SUPER_ADMIN', 'DOKTER_SPOG'] },
      { view: 'report-services', label: 'Laporan Pelayanan', roles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'] },
      { view: 'report-revenue', label: 'Laporan Pendapatan', roles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'] }
    ]
  },
  {
    title: 'PENGATURAN',
    items: [
      { view: 'settings-practice', label: 'Identitas Praktik', roles: ['SUPER_ADMIN'] },
      { view: 'settings-tariffs', label: 'Tarif Pelayanan', roles: ['SUPER_ADMIN'] },
      { view: 'settings-users', label: 'Pengguna', roles: ['SUPER_ADMIN'] },
      { view: 'settings-permissions', label: 'Hak Akses', roles: ['SUPER_ADMIN'] },
      { view: 'settings-templates', label: 'Template Dokumen', roles: ['SUPER_ADMIN'] },
      { view: 'settings-integrations', label: 'Integrasi API', roles: ['SUPER_ADMIN'] },
      { view: 'settings-backup', label: 'Backup Database', roles: ['SUPER_ADMIN'] },
      { view: 'settings-audit', label: 'Audit Log', roles: ['SUPER_ADMIN'] }
    ]
  }
];

export function canAccessView(role: RoleCode, view: NavView): boolean {
  for (const group of SIDEBAR_MENU) {
    const item = group.items.find((i) => i.view === view);
    if (item) return item.roles.includes(role);
  }
  return false;
}
