import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { usePractice } from '../context/PracticeContext';
import { calculateAgeYears, exportRowsToCsv, formatCurrencyIDR } from '../utils/obstetrics';

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const ReportsModule: React.FC = () => {
  const { activeView, dbState, setPrintPayload, notifyToast } = usePractice();
  const today = new Date().toISOString().slice(0, 10);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [endDate, setEndDate] = useState(today);

  const filteredVisits = useMemo(
    () => dbState.visits.filter((v) => v.visitDate >= startDate && v.visitDate <= endDate),
    [dbState.visits, startDate, endDate]
  );

  const filteredPayments = useMemo(
    () =>
      dbState.payments.filter(
        (p) => p.status === 'Sukses' && p.paymentDate >= startDate && p.paymentDate <= endDate
      ),
    [dbState.payments, startDate, endDate]
  );

  const DateFilterBar = ({
    title,
    subtitle,
    onCsv,
    onPrint
  }: {
    title: string;
    subtitle: string;
    onCsv: () => void;
    onPrint: () => void;
  }) => (
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        <p className="text-sm text-slate-500">{subtitle}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        />
        <span className="text-xs text-slate-500">s.d.</span>
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
        />
        <button
          type="button"
          onClick={onCsv}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
        <button
          type="button"
          onClick={onPrint}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
        >
          <Printer className="w-3.5 h-3.5" />
          Cetak PDF
        </button>
      </div>
    </div>
  );

  // ==================== REPORT: PATIENTS ====================
  if (activeView === 'report-patients') {
    const activePatients = dbState.patients.filter((p) => p.active);
    const bloodStats = ['A', 'B', 'AB', 'O'].map((bt) => ({
      bloodType: bt,
      count: dbState.patients.filter((p) => (p.bloodType || '').startsWith(bt)).length
    }));
    const withAllergies = dbState.patients.filter(
      (p) => p.allergies && p.allergies.trim() && p.allergies.toLowerCase() !== 'tidak ada'
    ).length;

    return (
      <div className="space-y-6">
        <DateFilterBar
          title="Laporan Data & Demografi Pasien"
          subtitle="Statistik pasien terdaftar, sebaran golongan darah, usia, dan catatan alergi."
          onCsv={() => {
            const csv = exportRowsToCsv(
              ['No. RM', 'Nama Lengkap', 'Tgl Lahir', 'Usia', 'Gol. Darah', 'Alergi', 'Status'],
              dbState.patients.map((p) => [
                p.rmNumber,
                p.fullName,
                p.birthDate,
                calculateAgeYears(p.birthDate),
                p.bloodType,
                p.allergies || 'Tidak ada',
                p.active ? 'Aktif' : 'Nonaktif'
              ])
            );
            downloadCsv(`laporan-pasien-${today}.csv`, csv);
            notifyToast('CSV Laporan Pasien diunduh.', 'success');
          }}
          onPrint={() =>
            setPrintPayload({
              type: 'laporan',
              title: 'LAPORAN DATA PASIEN',
              subtitle: `Per tanggal ${today}`,
              data: {
                content: [
                  `Total Pasien Terdaftar: ${dbState.patients.length}`,
                  `Pasien Aktif: ${activePatients.length}`,
                  `Pasien dengan Riwayat Alergi: ${withAllergies}`,
                  '',
                  'Daftar Ringkas Pasien:',
                  ...dbState.patients
                    .slice(0, 30)
                    .map(
                      (p) =>
                        `${p.rmNumber} · ${p.fullName} (${calculateAgeYears(p.birthDate)} th) · Gol. ${p.bloodType || '-'}`
                    )
                ].join('\n')
              }
            })
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total Pasien Terdaftar</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">{dbState.patients.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Pasien Aktif</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-teal-800 mt-1">{activePatients.length}</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Memiliki Catatan Alergi</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">{withAllergies}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Sebaran Golongan Darah Pasien</h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bloodStats}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="bloodType" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Jumlah Pasien" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // ==================== REPORT: VISITS ====================
  if (activeView === 'report-visits') {
    const byTypeMap = new Map<string, number>();
    for (const v of filteredVisits) {
      byTypeMap.set(v.visitType, (byTypeMap.get(v.visitType) || 0) + 1);
    }
    const visitTypeData = Array.from(byTypeMap.entries()).map(([visitType, total]) => ({
      visitType,
      total
    }));

    return (
      <div className="space-y-6">
        <DateFilterBar
          title="Laporan Kunjungan & Operasional"
          subtitle="Analisis volume kunjungan pasien berdasarkan jenis pemeriksaan dan status layanan."
          onCsv={() => {
            const csv = exportRowsToCsv(
              ['Tanggal', 'No. Kunjungan', 'No. RM', 'Pasien', 'Jenis Kunjungan', 'Dokter', 'Status'],
              filteredVisits.map((v) => [
                v.visitDate,
                v.visitNumber,
                v.patientRm,
                v.patientName,
                v.visitType,
                v.doctorName,
                v.status
              ])
            );
            downloadCsv(`laporan-kunjungan-${startDate}-${endDate}.csv`, csv);
            notifyToast('CSV Laporan Kunjungan diunduh.', 'success');
          }}
          onPrint={() =>
            setPrintPayload({
              type: 'laporan',
              title: 'LAPORAN KUNJUNGAN PASIEN',
              subtitle: `${startDate} s.d. ${endDate}`,
              data: {
                content: [
                  `Periode: ${startDate} s.d. ${endDate}`,
                  `Total Kunjungan: ${filteredVisits.length}`,
                  `Kunjungan Selesai: ${filteredVisits.filter((v) => v.status === 'Selesai').length}`,
                  '',
                  'Rincian per Jenis Kunjungan:',
                  ...visitTypeData.map((d) => `- ${d.visitType}: ${d.total} kunjungan`)
                ].join('\n')
              }
            })
          }
        />

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <h2 className="text-sm font-bold text-slate-900 mb-4">Kunjungan Berdasarkan Jenis Layanan</h2>
          {visitTypeData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-8">Belum ada data kunjungan pada periode ini.</p>
          ) : (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={visitTypeData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="visitType" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="total" name="Kunjungan" fill="#0f766e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ==================== REPORT: MEDICAL ====================
  if (activeView === 'report-medical') {
    const diagCounter = new Map<string, { code: string; desc: string; count: number }>();
    for (const r of dbState.medical_records) {
      for (const d of r.diagnoses || []) {
        const prev = diagCounter.get(d.icd10Code);
        diagCounter.set(d.icd10Code, {
          code: d.icd10Code,
          desc: d.description,
          count: (prev?.count || 0) + 1
        });
      }
    }
    const topDiagnoses = Array.from(diagCounter.values()).sort((a, b) => b.count - a.count);
    const highRiskPregnancies = dbState.pregnancies.filter(
      (p) => p.status === 'Aktif' && p.riskLevel === 'Tinggi'
    ).length;

    return (
      <div className="space-y-6">
        <DateFilterBar
          title="Laporan Pelayanan Medis & Morbiditas (ICD-10)"
          subtitle="Statistik diagnosis obstetri-ginekologi, kehamilan risiko tinggi, USG, dan rekam medis tersahkan."
          onCsv={() => {
            const csv = exportRowsToCsv(
              ['Kode ICD-10', 'Deskripsi Diagnosis', 'Jumlah Kasus'],
              topDiagnoses.map((d) => [d.code, d.desc, d.count])
            );
            downloadCsv(`laporan-medis-icd10-${today}.csv`, csv);
            notifyToast('CSV Laporan Medis ICD-10 diunduh.', 'success');
          }}
          onPrint={() =>
            setPrintPayload({
              type: 'laporan',
              title: 'LAPORAN PELAYANAN MEDIS SPOG',
              subtitle: `${startDate} s.d. ${endDate}`,
              data: {
                content: [
                  `Total Rekam Medis Elektronik: ${dbState.medical_records.length}`,
                  `Pemeriksaan USG Tercatat: ${dbState.ultrasound_records.length}`,
                  `Kehamilan Aktif Dipantau: ${dbState.pregnancies.filter((p) => p.status === 'Aktif').length}`,
                  `Kehamilan Risiko Tinggi: ${highRiskPregnancies}`,
                  '',
                  '10 Besar Diagnosis ICD-10:',
                  ...topDiagnoses.slice(0, 10).map((d) => `- ${d.code} (${d.desc}): ${d.count} kasus`)
                ].join('\n')
              }
            })
          }
        />

        <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Total RME Tersimpan</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {dbState.medical_records.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Pemeriksaan USG</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-teal-800 mt-1">
              {dbState.ultrasound_records.length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Kehamilan Aktif</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-slate-900 mt-1">
              {dbState.pregnancies.filter((p) => p.status === 'Aktif').length}
            </p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl p-5">
            <p className="text-xs text-slate-500">Kehamilan Risiko Tinggi</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-red-700 mt-1">{highRiskPregnancies}</p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Peringkat Diagnosis ICD-10</h2>
          </div>
          <table className="w-full text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Kode ICD-10</th>
                <th className="px-4 py-3 text-left font-semibold">Nama Diagnosis</th>
                <th className="px-4 py-3 text-right font-semibold">Jumlah Kasus</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {topDiagnoses.map((d) => (
                <tr key={d.code}>
                  <td className="px-4 py-3 font-mono font-bold text-teal-800">{d.code}</td>
                  <td className="px-4 py-3 text-slate-900">{d.desc}</td>
                  <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold">{d.count}</td>
                </tr>
              ))}
              {topDiagnoses.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-8 text-center text-slate-500">
                    Belum ada diagnosis terekam pada Rekam Medis.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==================== REPORT: SERVICES ====================
  if (activeView === 'report-services') {
    const serviceSummary = [
      { name: 'Tindakan Medis', count: dbState.procedures.length },
      { name: 'Pemeriksaan USG', count: dbState.ultrasound_records.length },
      { name: 'Resep Obat', count: dbState.prescriptions.length },
      { name: 'Order Laboratorium', count: dbState.laboratory_orders.length }
    ];
    return (
      <div className="space-y-6">
        <DateFilterBar
          title="Laporan Volume Pelayanan Klinik"
          subtitle="Rekap tindakan medis, USG, farmasi/resep, dan pemeriksaan laboratorium."
          onCsv={() => {
            const csv = exportRowsToCsv(
              ['Jenis Pelayanan', 'Jumlah'],
              serviceSummary.map((s) => [s.name, s.count])
            );
            downloadCsv(`laporan-pelayanan-${today}.csv`, csv);
            notifyToast('CSV Laporan Pelayanan diunduh.', 'success');
          }}
          onPrint={() =>
            setPrintPayload({
              type: 'laporan',
              title: 'LAPORAN PELAYANAN KLINIK',
              subtitle: `${startDate} s.d. ${endDate}`,
              data: {
                content: serviceSummary.map((s) => `- ${s.name}: ${s.count} layanan`).join('\n')
              }
            })
          }
        />

        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serviceSummary}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="count" name="Jumlah Layanan" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    );
  }

  // ==================== REPORT: REVENUE ====================
  const dailyRevMap = new Map<string, number>();
  for (const p of filteredPayments) {
    dailyRevMap.set(p.paymentDate, (dailyRevMap.get(p.paymentDate) || 0) + p.amount);
  }
  const dailyRevData = Array.from(dailyRevMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, revenue]) => ({ date, revenue }));
  const totalPeriodRev = filteredPayments.reduce((s, p) => s + p.amount, 0);

  return (
    <div className="space-y-6">
      <DateFilterBar
        title="Laporan Pendapatan Praktik"
        subtitle="Tren penerimaan harian dan rekapitulasi kuitansi lunas."
        onCsv={() => {
          const csv = exportRowsToCsv(
            ['Tanggal', 'No. Kuitansi', 'Pasien', 'Metode', 'Nominal'],
            filteredPayments.map((p) => [p.paymentDate, p.receiptNumber, p.patientName, p.method, p.amount])
          );
          downloadCsv(`laporan-pendapatan-${startDate}-${endDate}.csv`, csv);
          notifyToast('CSV Laporan Pendapatan diunduh.', 'success');
        }}
        onPrint={() =>
          setPrintPayload({
            type: 'laporan',
            title: 'LAPORAN PENDAPATAN PRAKTIK',
            subtitle: `${startDate} s.d. ${endDate}`,
            data: {
              content: [
                `Total Transaksi Sukses: ${filteredPayments.length}`,
                `Total Pendapatan: ${formatCurrencyIDR(totalPeriodRev)}`,
                '',
                ...dailyRevData.map((d) => `${d.date}: ${formatCurrencyIDR(d.revenue)}`)
              ].join('\n')
            }
          })
        }
      />

      <div className="bg-white border border-slate-200 rounded-xl p-5 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-500">Total Pendapatan Periode Dipilih</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-teal-800 mt-1">
            {formatCurrencyIDR(totalPeriodRev)}
          </p>
        </div>
        <p className="text-xs font-mono tabular-nums text-slate-600">{filteredPayments.length} kuitansi sukses</p>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Grafik Pendapatan Harian</h2>
        {dailyRevData.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-8">Belum ada penerimaan pada rentang tanggal ini.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyRevData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip formatter={(val) => formatCurrencyIDR(Number(val ?? 0))} />
                <Bar dataKey="revenue" name="Pendapatan" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
