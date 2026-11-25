import React, { useMemo, useState } from 'react';
import {
  Activity,
  Baby,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  CalendarClock,
  ChevronRight,
  ClipboardList,
  CreditCard,
  DatabaseBackup,
  FileCheck2,
  FileSpreadsheet,
  FileText,
  FlaskConical,
  HeartPulse,
  KeyRound,
  LayoutDashboard,
  Link2,
  Lock,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  PenTool,
  Pill,
  Receipt,
  ScanLine,
  ScrollText,
  Search,
  Shield,
  Stethoscope,
  UserPlus,
  Users,
  Wallet,
  X
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { NavView } from '../types/models';
import { ROLE_LABELS, SIDEBAR_MENU } from '../utils/rbac';
import { DEFAULT_LOGO_PATH } from '../data/defaults';
import { SignatureInput } from './SignatureInput';

const VIEW_ICONS: Record<NavView, React.ComponentType<{ className?: string }>> = {
  dashboard: LayoutDashboard,
  patients: Users,
  'patient-register': UserPlus,
  visits: ClipboardList,
  queue: Activity,
  rme: FileCheck2,
  obstetric: HeartPulse,
  gynecology: Stethoscope,
  pregnancy: Baby,
  usg: ScanLine,
  procedures: Activity,
  prescriptions: Pill,
  laboratory: FlaskConical,
  schedule: Calendar,
  appointments: CalendarClock,
  documents: FileText,
  notifications: Bell,
  cashier: CreditCard,
  invoices: Receipt,
  payments: Wallet,
  receivables: FileSpreadsheet,
  'cash-in': Wallet,
  'cash-out': Wallet,
  'cash-close': Lock,
  'finance-reports': BarChart3,
  'report-patients': BarChart3,
  'report-visits': BarChart3,
  'report-medical': BarChart3,
  'report-services': BarChart3,
  'report-revenue': BarChart3,
  'settings-practice': Building2,
  'settings-tariffs': Receipt,
  'settings-users': Users,
  'settings-permissions': Shield,
  'settings-templates': FileText,
  'settings-integrations': Link2,
  'settings-backup': DatabaseBackup,
  'settings-audit': ScrollText
};

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    currentUser,
    dbState,
    practice,
    activeView,
    setActiveView,
    setSelectedPatientId,
    e2eeUnlocked,
    e2eeFingerprint,
    firebaseUser,
    logout,
    toasts,
    dismissToast,
    upsertRecord,
    updateMySignature
  } = usePractice();

  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [quickSearch, setQuickSearch] = useState('');
  const [notifOpen, setNotifOpen] = useState(false);
  const [e2eeModalOpen, setE2eeModalOpen] = useState(false);
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [mySigDraft, setMySigDraft] = useState('');
  const [savingMySig, setSavingMySig] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);

  const openMySignatureModal = () => {
    setMySigDraft(currentUser?.signatureUrl || '');
    setSigModalOpen(true);
  };

  const visibleMenu = useMemo(() => {
    if (!currentUser) return [];
    return SIDEBAR_MENU.map((group) => ({
      ...group,
      items: group.items.filter((item) => item.roles.includes(currentUser.role))
    })).filter((group) => group.items.length > 0);
  }, [currentUser]);

  const currentBreadcrumb = useMemo(() => {
    for (const g of SIDEBAR_MENU) {
      const found = g.items.find((i) => i.view === activeView);
      if (found) return { group: g.title, label: found.label };
    }
    return { group: 'UTAMA', label: 'Dashboard' };
  }, [activeView]);

  const quickResults = useMemo(() => {
    const q = quickSearch.trim().toLowerCase();
    if (q.length < 2) return [];
    return dbState.patients
      .filter(
        (p) =>
          p.fullName.toLowerCase().includes(q) ||
          p.rmNumber.toLowerCase().includes(q) ||
          (p.phone || '').toLowerCase().includes(q)
      )
      .slice(0, 6);
  }, [dbState.patients, quickSearch]);

  const myNotifications = useMemo(() => {
    if (!currentUser) return [];
    return dbState.notifications.filter((n) => n.targetRoles.includes(currentUser.role));
  }, [dbState.notifications, currentUser]);

  const unreadCount = useMemo(() => myNotifications.filter((n) => !n.read).length, [myNotifications]);

  const handleSelectNav = (view: NavView) => {
    setActiveView(view);
    setMobileMenuOpen(false);
  };

  const markNotifRead = async (id: string) => {
    const target = dbState.notifications.find((n) => n.id === id);
    if (!target) return;
    await upsertRecord('notifications', { ...target, read: true });
  };

  const renderSidebarContent = () => (
    <div className="flex flex-col h-full bg-white border-r border-slate-200">
      {/* Brand Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 shrink-0">
        <button
          type="button"
          onClick={() => handleSelectNav('dashboard')}
          className="flex items-center gap-2.5 min-w-0 text-left"
        >
          <div className="w-8 h-8 rounded-lg border border-slate-200 bg-white p-1 flex items-center justify-center shrink-0">
            {!logoBroken ? (
              <img
                src={practice.logoUrl || DEFAULT_LOGO_PATH}
                alt="Logo Praktik"
                referrerPolicy="no-referrer"
                onError={() => setLogoBroken(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <Stethoscope className="w-4 h-4 text-teal-700" />
            )}
          </div>
          <span className="text-xs font-bold tracking-tight text-slate-900 truncate">
            {practice.practiceName}
          </span>
        </button>
        <button
          type="button"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Tutup menu navigasi"
          className="lg:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-md"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Navigation Groups */}
      <nav aria-label="Menu Utama Praktik" className="flex-1 overflow-y-auto px-3 py-4 space-y-5">
        {visibleMenu.map((group) => (
          <div key={group.title} className="space-y-1">
            <p className="px-2.5 text-[11px] font-semibold tracking-wider text-slate-400">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = VIEW_ICONS[item.view];
                const isActive = activeView === item.view;
                return (
                  <button
                    key={item.view}
                    type="button"
                    onClick={() => handleSelectNav(item.view)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm transition-colors text-left ${
                      isActive
                        ? 'bg-teal-50 text-teal-800 font-semibold'
                        : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900 font-normal'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 shrink-0 ${
                        isActive ? 'text-teal-700' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Bottom User Card */}
      {currentUser && (
        <div className="p-3 border-t border-slate-200 bg-slate-50/70 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-slate-900 truncate">{currentUser.displayName}</p>
              <p className="text-[11px] text-teal-700 font-medium truncate">
                {ROLE_LABELS[currentUser.role]}
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={openMySignatureModal}
                aria-label="Atur tanda tangan digital saya"
                title="Tanda Tangan Saya"
                className="p-2 rounded-lg text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <PenTool className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => void logout()}
                aria-label="Keluar dari sistem"
                title="Keluar"
                className="p-2 rounded-lg text-slate-500 hover:text-red-700 hover:bg-red-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Collapsible Sidebar */}
      <aside
        className={`hidden lg:block shrink-0 transition-all duration-200 no-print ${
          sidebarOpen ? 'w-64' : 'w-0 overflow-hidden'
        }`}
      >
        <div className="w-64 h-screen sticky top-0">{renderSidebarContent()}</div>
      </aside>

      {/* Mobile Drawer Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex no-print">
          <div
            className="fixed inset-0 bg-slate-900/40"
            onClick={() => setMobileMenuOpen(false)}
            aria-hidden="true"
          />
          <div className="relative w-72 max-w-[82vw] h-full z-10">{renderSidebarContent()}</div>
        </div>
      )}

      {/* Main Content Shell */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top Bar */}
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-30 no-print">
          {/* Zone 1: Sidebar Toggle + Breadcrumb */}
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Buka menu samping"
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button
              type="button"
              onClick={() => setSidebarOpen((v) => !v)}
              aria-label={sidebarOpen ? 'Sembunyikan sidebar' : 'Tampilkan sidebar'}
              className="hidden lg:inline-flex p-2 rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition-colors"
            >
              {sidebarOpen ? (
                <PanelLeftClose className="w-4 h-4" />
              ) : (
                <PanelLeftOpen className="w-4 h-4" />
              )}
            </button>
            <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm min-w-0">
              <span className="text-slate-400 text-xs font-medium hidden sm:inline truncate">
                {currentBreadcrumb.group}
              </span>
              <ChevronRight className="w-3.5 h-3.5 text-slate-300 hidden sm:inline shrink-0" />
              <span className="font-semibold text-slate-900 truncate">{currentBreadcrumb.label}</span>
            </nav>
          </div>

          {/* Zone 2: Quick Patient Search */}
          <div className="relative flex-1 max-w-sm hidden md:block">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              aria-label="Cari cepat pasien berdasarkan nama atau nomor RM"
              value={quickSearch}
              onChange={(e) => setQuickSearch(e.target.value)}
              placeholder="Cari pasien (Nama / No. RM / Telepon)..."
              className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-200 bg-slate-50 text-sm text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
            />
            {quickResults.length > 0 && (
              <div className="absolute left-0 right-0 top-11 bg-white border border-slate-200 rounded-lg shadow-lg py-1.5 z-40">
                {quickResults.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      setSelectedPatientId(p.id);
                      setActiveView('patients');
                      setQuickSearch('');
                    }}
                    className="w-full px-3.5 py-2 text-left hover:bg-slate-50 flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.fullName}</p>
                      <p className="text-xs text-slate-500 font-mono tabular-nums">{p.rmNumber}</p>
                    </div>
                    <span className="text-xs text-teal-700 font-medium shrink-0">Buka</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Zone 3: Personal Signature + E2EE Vault Button + Notifications */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={openMySignatureModal}
              className="hidden md:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <PenTool className="w-3.5 h-3.5 text-teal-700" />
              <span>{currentUser?.signatureUrl ? 'TTD Saya' : 'Atur TTD'}</span>
            </button>
            <button
              type="button"
              onClick={() => setE2eeModalOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-700 hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              <KeyRound className="w-3.5 h-3.5 text-teal-700" />
              <span>{e2eeUnlocked ? 'E2EE Aktif' : 'E2EE Terkunci'}</span>
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((v) => !v)}
                aria-label={`Notifikasi (${unreadCount} belum dibaca)`}
                className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              >
                <Bell className="w-4 h-4" />
                {unreadCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-600 text-white text-[10px] font-mono tabular-nums flex items-center justify-center">
                    {unreadCount}
                  </span>
                )}
              </button>

              {notifOpen && (
                <div className="absolute right-0 top-11 w-80 bg-white border border-slate-200 rounded-xl shadow-lg z-40 overflow-hidden">
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-900">Notifikasi Internal</span>
                    <button
                      type="button"
                      onClick={() => {
                        setNotifOpen(false);
                        setActiveView('notifications');
                      }}
                      className="text-xs text-teal-700 hover:underline font-medium"
                    >
                      Lihat semua
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                    {myNotifications.length === 0 ? (
                      <p className="p-4 text-xs text-slate-500 text-center">Tidak ada notifikasi baru.</p>
                    ) : (
                      myNotifications.slice(0, 6).map((n) => (
                        <button
                          key={n.id}
                          type="button"
                          onClick={() => {
                            void markNotifRead(n.id);
                            setNotifOpen(false);
                            if (n.linkView) setActiveView(n.linkView as NavView);
                          }}
                          className={`w-full text-left p-3.5 hover:bg-slate-50 transition-colors ${
                            n.read ? 'opacity-65' : 'bg-teal-50/30'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span
                              className={`text-xs font-semibold ${
                                n.severity === 'critical'
                                  ? 'text-red-700'
                                  : n.severity === 'warning'
                                  ? 'text-amber-700'
                                  : 'text-teal-800'
                              }`}
                            >
                              {n.title}
                            </span>
                            <span className="text-[10px] text-slate-400 shrink-0">{n.category}</span>
                          </div>
                          <p className="text-xs text-slate-600 mt-1 line-clamp-2">{n.message}</p>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Main Viewport */}
        <main className="flex-1 p-4 sm:p-6 max-w-[1600px] w-full mx-auto">{children}</main>
      </div>

      {/* E2EE Vault Inspector Modal */}
      {e2eeModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Informasi Enkripsi End-to-End"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <KeyRound className="w-5 h-5 text-teal-700" />
                <h3 className="text-base font-bold text-slate-900">Keamanan Enkripsi End-to-End (E2EE)</h3>
              </div>
              <button
                type="button"
                onClick={() => setE2eeModalOpen(false)}
                aria-label="Tutup modal E2EE"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-sm text-slate-600">
              <p>
                Seluruh akun pengguna memiliki kunci enkripsi terpisah berbasis{' '}
                <strong className="text-slate-900">PBKDF2-SHA256 (100.000 iterasi)</strong> untuk membuka Practice Vault Key{' '}
                <strong className="text-slate-900">AES-256-GCM</strong> secara lokal di peramban.
              </p>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 space-y-2 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-500">Status Vault Sesi</span>
                  <span className="font-semibold text-emerald-700">
                    {e2eeUnlocked ? 'Terbuka di Memori (Aktif)' : 'Terkunci'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Sidik Jari Kunci (SHA-256)</span>
                  <span className="font-mono tabular-nums text-slate-900">
                    {e2eeFingerprint || '-'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Algoritma Field Medis &amp; PII</span>
                  <span className="font-mono text-slate-900">AES-256-GCM (IV 96-bit acak)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Kepatuhan Privasi</span>
                  <span className="text-slate-900">UU No. 27/2022 PDP &amp; Permenkes 24/2022</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Cloud Firestore</span>
                  <span className="text-slate-900">
                    {firebaseUser ? `Tersinkron (${firebaseUser.email})` : 'Mode Server Terautentikasi'}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setE2eeModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Personal Digital Signature Modal */}
      {sigModalOpen && currentUser && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 no-print"
          role="dialog"
          aria-modal="true"
          aria-label="Atur Tanda Tangan Digital Saya"
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-5 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <PenTool className="w-5 h-5 text-teal-700" />
                <div>
                  <h3 className="text-base font-bold text-slate-900">Tanda Tangan Digital Saya</h3>
                  <p className="text-xs text-slate-500">
                    {currentUser.displayName} · {ROLE_LABELS[currentUser.role]}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSigModalOpen(false)}
                aria-label="Tutup modal tanda tangan"
                className="p-1.5 text-slate-500 hover:text-slate-900 rounded-md"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <SignatureInput
              value={mySigDraft}
              onChange={setMySigDraft}
              label="Tanda Tangan untuk Dokumen Cetak"
              helperText="Tersimpan ke database online dan otomatis tampil saat Anda mencetak dokumen sebagai user login."
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSigModalOpen(false)}
                className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={savingMySig}
                onClick={async () => {
                  setSavingMySig(true);
                  try {
                    await updateMySignature(mySigDraft);
                    setSigModalOpen(false);
                  } finally {
                    setSavingMySig(false);
                  }
                }}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-60"
              >
                {savingMySig ? 'Menyimpan...' : 'Simpan Tanda Tangan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2 max-w-xs w-full pointer-events-none no-print">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className={`pointer-events-auto flex items-start justify-between gap-2.5 px-3.5 py-2.5 rounded-lg border shadow-md text-xs bg-white ${
              t.type === 'error'
                ? 'border-red-300 text-red-800'
                : t.type === 'warning'
                ? 'border-amber-300 text-amber-900'
                : t.type === 'info'
                ? 'border-slate-300 text-slate-800'
                : 'border-teal-300 text-teal-900'
            }`}
          >
            <span className="leading-snug">{t.text}</span>
            <button
              type="button"
              onClick={() => dismissToast(t.id)}
              aria-label="Tutup pesan"
              className="text-slate-400 hover:text-slate-700 shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
};
