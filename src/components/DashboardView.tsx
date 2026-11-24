import React, { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Baby,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  CreditCard,
  Database,
  FilePlus2,
  Stethoscope,
  TrendingUp,
  UserPlus,
  Users,
  Wallet
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import { formatCurrencyIDR } from '../utils/obstetrics';
import { ROLE_LABELS } from '../utils/rbac';

const CHART_COLORS = ['#0F766E', '#10B981', '#0EA5E9', '#64748B', '#D97706'];

export const DashboardView: React.FC = () => {
  const {
    currentUser,
    dbState,
    practice,
    systemSettings,
    setActiveView,
    setSelectedPatientId,
    setSelectedVisitId,
    loadDemoData,
    clearDemoData
  } = usePractice();

  const [demoBusy, setDemoBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const metrics = useMemo(() => {
    const totalPatients = dbState.patients.filter((p) => p.active).length;
    const newPatientsMonth = dbState.patients.filter((p) => p.createdAt.startsWith(currentMonth)).length;
    const todayVisits = dbState.visits.filter((v) => v.visitDate === today);
    const waitingVisits = todayVisits.filter((v) => ['Terdaftar', 'Menunggu', 'Dipanggil'].includes(v.status));
    const inExamVisits = todayVisits.filter((v) => v.status === 'Sedang Diperiksa');
    const finishedVisits = todayVisits.filter((v) =>
      ['Pemeriksaan Selesai', 'Menunggu Pembayaran', 'Selesai'].includes(v.status)
    );

    const validPayments = dbState.payments.filter((p) => p.status === 'Sukses');
    const todayRevenue = validPayments
      .filter((p) => p.paymentDate === today)
      .reduce((acc, p) => acc + p.amount, 0);
    const monthRevenue = validPayments
      .filter((p) => p.paymentDate.startsWith(currentMonth))
      .reduce((acc, p) => acc + p.amount, 0);

    const unpaidInvoices = dbState.invoices.filter((i) =>
      ['Belum Dibayar', 'Dibayar Sebagian', 'Piutang'].includes(i.status)
    );
    const totalReceivables = unpaidInvoices.reduce((acc, i) => acc + i.remainingAmount, 0);
    const cashReceivedToday = validPayments
      .filter((p) => p.paymentDate === today && p.method === 'Tunai')
      .reduce((acc, p) => acc + p.amount, 0);

    const highRiskPregnancies = dbState.pregnancies.filter(
      (p) => p.status === 'Aktif' && (p.riskLevel === 'Tinggi' || p.riskLevel === 'Sedang')
    );

    const upcomingAppointments = dbState.appointments
      .filter((a) => a.status === 'Terjadwal' && a.scheduledDate >= today)
      .sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate));

    return {
      totalPatients,
      newPatientsMonth,
      todayVisits,
      waitingVisits,
      inExamVisits,
      finishedVisits,
      todayRevenue,
      monthRevenue,
      unpaidInvoices,
      totalReceivables,
      cashReceivedToday,
      highRiskPregnancies,
      upcomingAppointments
    };
  }, [dbState, today, currentMonth]);

  // 7-day visit & revenue series
  const trendSeries = useMemo(() => {
    const days: { date: string; label: string; kunjungan: number; pendapatan: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const iso = d.toISOString().slice(0, 10);
      const label = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      const kunjungan = dbState.visits.filter((v) => v.visitDate === iso).length;
      const pendapatan = dbState.payments
        .filter((p) => p.status === 'Sukses' && p.paymentDate === iso)
        .reduce((acc, p) => acc + p.amount, 0);
      days.push({ date: iso, label, kunjungan, pendapatan });
    }
    return days;
  }, [dbState.visits, dbState.payments]);

  // Service category distribution
  const serviceStats = useMemo(() => {
    const counts = new Map<string, number>();
    for (const v of dbState.visits) {
      const key = v.serviceCategory || v.visitType;
      counts.set(key, (counts.get(key) || 0) + 1);
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }));
  }, [dbState.visits]);

  const hasDemoData = useMemo(() => dbState.patients.some((p) => p.isDemo), [dbState.patients]);

  const handleLoadDemo = async () => {
    setDemoBusy(true);
    try {
      await loadDemoData();
    } finally {
      setDemoBusy(false);
    }
  };

  const handleClearDemo = async () => {
    setDemoBusy(true);
    try {
      await clearDemoData();
    } finally {
      setDemoBusy(false);
    }
  };

  if (!currentUser) return null;

  return (
    <div className="space-y-6">
      {/* Header Row */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-teal-700">
            {practice.practiceName} · {ROLE_LABELS[currentUser.role]}
          </p>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 mt-0.5">
            {currentUser.role === 'SUPER_ADMIN'
              ? 'Dashboard Manajemen Praktik'
              : currentUser.role === 'DOKTER_SPOG'
              ? 'Dashboard Pelayanan Medis Sp.OG'
              : 'Dashboard Administrasi & Kasir'}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {currentUser.role !== 'DOKTER_SPOG' && (
            <button
              type="button"
              onClick={() => setActiveView('patient-register')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Registrasi Pasien
            </button>
          )}
          {currentUser.role === 'DOKTER_SPOG' && (
            <button
              type="button"
              onClick={() => setActiveView('rme')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 transition-colors whitespace-nowrap"
            >
              <Stethoscope className="w-4 h-4" />
              Buka Rekam Medis
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveView('queue')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors whitespace-nowrap"
          >
            <Activity className="w-4 h-4 text-teal-700" />
            Antrean Real-Time
          </button>
        </div>
      </div>

      {/* Isolated Demo Dataset Control Banner (Super Admin) */}
      {currentUser.role === 'SUPER_ADMIN' && dbState.patients.length === 0 && (
        <div className="p-5 bg-white border border-teal-200 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Database className="w-5 h-5 text-teal-700 shrink-0 mt-0.5" />
            <div>
              <h2 className="text-sm font-semibold text-slate-900">
                Database Praktik Siap Digunakan (Produksi Bersih)
              </h2>
              <p className="text-xs text-slate-600 mt-0.5">
                Belum ada pasien terdaftar. Mulai daftarkan pasien pertama atau muat dataset demonstrasi terpisah untuk menguji seluruh alur klinis &amp; kasir.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={demoBusy}
              onClick={handleLoadDemo}
              className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
            >
              {demoBusy ? 'Memuat...' : 'Muat Data Demonstrasi'}
            </button>
          </div>
        </div>
      )}

      {currentUser.role === 'SUPER_ADMIN' && hasDemoData && (
        <div className="px-4 py-3 bg-slate-100 border border-slate-200 rounded-lg flex flex-wrap items-center justify-between gap-3 text-xs">
          <span className="text-slate-700">
            Mode Pengujian: Dataset demonstrasi terpisah sedang aktif dan terenkripsi E2EE (tidak bercampur permanen dengan data produksi).
          </span>
          <button
            type="button"
            disabled={demoBusy}
            onClick={handleClearDemo}
            className="font-semibold text-red-700 hover:underline whitespace-nowrap"
          >
            Bersihkan Data Demonstrasi
          </button>
        </div>
      )}

      {/* ==================== SUPER ADMIN DASHBOARD ==================== */}
      {currentUser.role === 'SUPER_ADMIN' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Pasien Terdaftar</span>
                <Users className="w-4 h-4 text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.totalPatients}
              </p>
              <p className="text-xs text-emerald-700 mt-1 font-mono tabular-nums">
                +{metrics.newPatientsMonth} pasien baru bulan ini
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Kunjungan Hari Ini</span>
                <ClipboardList className="w-4 h-4 text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.todayVisits.length}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {metrics.waitingVisits.length} menunggu · {metrics.finishedVisits.length} selesai diperiksa
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Pendapatan Hari Ini</span>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {formatCurrencyIDR(metrics.todayRevenue)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Bulan ini: {formatCurrencyIDR(metrics.monthRevenue)}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Piutang Pasien</span>
                <Wallet className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {formatCurrencyIDR(metrics.totalReceivables)}
              </p>
              <p className="text-xs text-amber-700 mt-1 font-mono tabular-nums">
                {metrics.unpaidInvoices.length} tagihan belum lunas
              </p>
            </div>
          </div>

          {/* Interactive Charts */}
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="xl:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-sm font-bold text-slate-900">Tren Kunjungan &amp; Pendapatan (7 Hari Terakhir)</h2>
                  <p className="text-xs text-slate-500">Data tersinkronisasi dari modul kunjungan dan pembayaran kasir</p>
                </div>
              </div>
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={trendSeries} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                    <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                    <YAxis yAxisId="left" tick={{ fontSize: 11, fill: '#64748B' }} allowDecimals={false} />
                    <YAxis
                      yAxisId="right"
                      orientation="right"
                      tick={{ fontSize: 11, fill: '#64748B' }}
                      tickFormatter={(v) => `${Math.round(v / 1000)}rb`}
                    />
                    <Tooltip
                      formatter={(val, name) =>
                        String(name) === 'pendapatan' ? formatCurrencyIDR(Number(val ?? 0)) : `${Number(val ?? 0)} pasien`
                      }
                    />
                    <Area
                      yAxisId="right"
                      type="monotone"
                      dataKey="pendapatan"
                      name="pendapatan"
                      stroke="#0F766E"
                      fill="#CCFBF1"
                      strokeWidth={2}
                    />
                    <Area
                      yAxisId="left"
                      type="monotone"
                      dataKey="kunjungan"
                      name="kunjungan"
                      stroke="#10B981"
                      fill="#D1FAE5"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div>
                <h2 className="text-sm font-bold text-slate-900">Statistik Jenis Pelayanan</h2>
                <p className="text-xs text-slate-500">Distribusi kategori kunjungan pasien</p>
              </div>
              {serviceStats.length === 0 ? (
                <div className="h-56 flex items-center justify-center text-xs text-slate-400">
                  Belum ada data pelayanan tercatat.
                </div>
              ) : (
                <>
                  <div className="h-44 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={serviceStats}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          innerRadius={42}
                          outerRadius={68}
                          paddingAngle={3}
                        >
                          {serviceStats.map((entry, idx) => (
                            <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-1.5 text-xs">
                    {serviceStats.slice(0, 5).map((s, idx) => (
                      <div key={s.name} className="flex items-center justify-between">
                        <span className="flex items-center gap-2 text-slate-700 truncate">
                          <span
                            className="w-2.5 h-2.5 rounded-sm shrink-0"
                            style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                          />
                          {s.name}
                        </span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Recent User Activities (Audit Log) & High-Risk Monitoring */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Aktivitas Pengguna Terbaru</h2>
                <button
                  type="button"
                  onClick={() => setActiveView('settings-audit')}
                  className="text-xs font-medium text-teal-700 hover:underline inline-flex items-center gap-1"
                >
                  Audit Log <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {dbState.audit_logs.slice(0, 6).map((log) => (
                  <div key={log.id} className="py-2.5 flex items-start justify-between gap-3 text-xs">
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 truncate">
                        {log.userName} · <span className="text-teal-700 font-mono">{log.action}</span>
                      </p>
                      <p className="text-slate-500 truncate mt-0.5">
                        Modul: {log.entity} {log.entityId ? `(${log.entityId})` : ''}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-slate-400 shrink-0">
                      {new Date(log.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
                {dbState.audit_logs.length === 0 && (
                  <p className="py-6 text-xs text-slate-400 text-center">Belum ada log aktivitas.</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Kehamilan Dalam Pemantauan</h2>
                <button
                  type="button"
                  onClick={() => setActiveView('pregnancy')}
                  className="text-xs font-medium text-teal-700 hover:underline inline-flex items-center gap-1"
                >
                  Manajemen Kehamilan <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {dbState.pregnancies
                  .filter((p) => p.status === 'Aktif')
                  .slice(0, 5)
                  .map((preg) => (
                    <div key={preg.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-slate-900 truncate">
                          {preg.patientName}{' '}
                          <span className="text-slate-400 font-mono">({preg.patientRm})</span>
                        </p>
                        <p className="text-slate-500 mt-0.5">
                          G{preg.gravida}P{preg.para}A{preg.abortus} · UK {preg.gestationalAgeWeeks} mgg · HPL{' '}
                          <span className="font-mono">{preg.hpl}</span>
                        </p>
                      </div>
                      <span
                        className={`font-semibold shrink-0 ${
                          preg.riskLevel === 'Tinggi'
                            ? 'text-red-700'
                            : preg.riskLevel === 'Sedang'
                            ? 'text-amber-700'
                            : 'text-emerald-700'
                        }`}
                      >
                        Risiko {preg.riskLevel}
                      </span>
                    </div>
                  ))}
                {dbState.pregnancies.filter((p) => p.status === 'Aktif').length === 0 && (
                  <p className="py-6 text-xs text-slate-400 text-center">
                    Belum ada kehamilan aktif yang tercatat.
                  </p>
                )}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== DOKTER SPOG DASHBOARD ==================== */}
      {currentUser.role === 'DOKTER_SPOG' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Pasien Menunggu</span>
                <Activity className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.waitingVisits.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Siap dipanggil ke ruang periksa</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Sedang Diperiksa</span>
                <Stethoscope className="w-4 h-4 text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.inExamVisits.length}
              </p>
              <p className="text-xs text-teal-700 mt-1">Konsultasi &amp; RME aktif</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Selesai Diperiksa Hari Ini</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.finishedVisits.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">Dari {metrics.todayVisits.length} total antrean</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Kehamilan Perlu Pemantauan</span>
                <Baby className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.highRiskPregnancies.length}
              </p>
              <p className="text-xs text-red-700 mt-1">Risiko sedang / tinggi aktif</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Antrean &amp; Konsultasi Medis Hari Ini</h2>
                <button
                  type="button"
                  onClick={() => setActiveView('queue')}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  Kelola Antrean
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 text-slate-500">
                      <th className="py-2 text-left font-semibold">No. Antrean</th>
                      <th className="py-2 text-left font-semibold">Pasien</th>
                      <th className="py-2 text-left font-semibold">Pelayanan</th>
                      <th className="py-2 text-left font-semibold">Status</th>
                      <th className="py-2 text-right font-semibold">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {metrics.todayVisits.map((v) => (
                      <tr key={v.id} className="hover:bg-slate-50">
                        <td className="py-2.5 font-mono font-bold text-teal-800">{v.queueNumber}</td>
                        <td className="py-2.5">
                          <p className="font-semibold text-slate-900">{v.patientName}</p>
                          <p className="text-slate-400 font-mono">{v.patientRm}</p>
                        </td>
                        <td className="py-2.5 text-slate-700">{v.visitType}</td>
                        <td className="py-2.5 font-medium text-slate-800">{v.status}</td>
                        <td className="py-2.5 text-right">
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedPatientId(v.patientId);
                              setSelectedVisitId(v.id);
                              setActiveView('rme');
                            }}
                            className="text-teal-700 font-semibold hover:underline"
                          >
                            Buka RME
                          </button>
                        </td>
                      </tr>
                    ))}
                    {metrics.todayVisits.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-8 text-center text-slate-400">
                          Belum ada kunjungan terdaftar hari ini.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-4">
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Jadwal Praktik Aktif</h2>
                <div className="space-y-2 text-xs">
                  {systemSettings.scheduleSlots
                    .filter((s) => s.active)
                    .slice(0, 5)
                    .map((slot, idx) => (
                      <div key={idx} className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
                        <span className="font-medium text-slate-800">{slot.dayOfWeek}</span>
                        <span className="font-mono tabular-nums text-slate-600">
                          {slot.startTime} - {slot.endTime} · Kuota {slot.quota}
                        </span>
                      </div>
                    ))}
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-red-700">
                  <AlertTriangle className="w-4 h-4" />
                  <h2 className="text-sm font-bold text-slate-900">Pemantauan Kehamilan Risiko</h2>
                </div>
                <div className="space-y-2.5 text-xs">
                  {metrics.highRiskPregnancies.map((p) => (
                    <div key={p.id} className="p-3 rounded-lg bg-red-50/70 border border-red-200">
                      <p className="font-semibold text-slate-900">{p.patientName}</p>
                      <p className="text-slate-600 mt-0.5">{p.riskFactors}</p>
                      <p className="text-red-700 font-mono mt-1">
                        UK {p.gestationalAgeWeeks} mgg · HPL {p.hpl}
                      </p>
                    </div>
                  ))}
                  {metrics.highRiskPregnancies.length === 0 && (
                    <p className="text-slate-400">Tidak ada pasien kehamilan risiko tinggi saat ini.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ==================== ASISTEN DOKTER DASHBOARD ==================== */}
      {currentUser.role === 'ASISTEN_DOKTER' && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Antrean Hari Ini</span>
                <Activity className="w-4 h-4 text-teal-700" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.todayVisits.length}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                {metrics.waitingVisits.length} menunggu · {metrics.finishedVisits.length} selesai periksa
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Belum Membayar</span>
                <CreditCard className="w-4 h-4 text-amber-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {metrics.unpaidInvoices.length}
              </p>
              <p className="text-xs text-amber-700 mt-1">Perlu verifikasi &amp; pelunasan kasir</p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Total Penerimaan Hari Ini</span>
                <Wallet className="w-4 h-4 text-emerald-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {formatCurrencyIDR(metrics.todayRevenue)}
              </p>
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                Tunai di laci: {formatCurrencyIDR(metrics.cashReceivedToday)}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between text-slate-500 text-xs font-medium">
                <span>Piutang Aktif</span>
                <FilePlus2 className="w-4 h-4 text-red-600" />
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-2">
                {formatCurrencyIDR(metrics.totalReceivables)}
              </p>
              <p className="text-xs text-slate-500 mt-1">Total sisa tagihan pasien</p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-slate-900">Tagihan Menunggu Pembayaran</h2>
                <button
                  type="button"
                  onClick={() => setActiveView('cashier')}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  Buka Kasir
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {metrics.unpaidInvoices.slice(0, 6).map((inv) => (
                  <div key={inv.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{inv.patientName}</p>
                      <p className="text-slate-500 font-mono">
                        {inv.invoiceNumber} · {inv.status}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrencyIDR(inv.remainingAmount)}
                      </p>
                      <button
                        type="button"
                        onClick={() => setActiveView('cashier')}
                        className="text-teal-700 hover:underline font-medium"
                      >
                        Proses Bayar
                      </button>
                    </div>
                  </div>
                ))}
                {metrics.unpaidInvoices.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">Seluruh tagihan sudah lunas.</p>
                )}
              </div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-teal-700" />
                  <h2 className="text-sm font-bold text-slate-900">Pengingat Jadwal Kontrol Pasien</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setActiveView('appointments')}
                  className="text-xs font-semibold text-teal-700 hover:underline"
                >
                  Kelola Jadwal
                </button>
              </div>
              <div className="divide-y divide-slate-100">
                {metrics.upcomingAppointments.slice(0, 6).map((apt) => (
                  <div key={apt.id} className="py-2.5 flex items-center justify-between gap-3 text-xs">
                    <div>
                      <p className="font-semibold text-slate-900">{apt.patientName}</p>
                      <p className="text-slate-500">{apt.purpose}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-mono tabular-nums text-slate-800">{apt.scheduledDate}</p>
                      <p className={apt.reminderSent ? 'text-emerald-700' : 'text-amber-700'}>
                        {apt.reminderSent ? 'Pengingat Terkirim' : 'Belum Dikirim'}
                      </p>
                    </div>
                  </div>
                ))}
                {metrics.upcomingAppointments.length === 0 && (
                  <p className="py-6 text-center text-xs text-slate-400">Belum ada jadwal kontrol mendatang.</p>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
            <h2 className="text-sm font-bold text-slate-900">Penerimaan Harian (7 Hari Terakhir)</h2>
            <div className="h-52 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendSeries}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `${Math.round(v / 1000)}rb`} />
                  <Tooltip formatter={(val) => formatCurrencyIDR(Number(val ?? 0))} />
                  <Bar dataKey="pendapatan" name="Pendapatan" fill="#0F766E" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
