import React, { useState } from 'react';
import {
  Bell,
  Calendar,
  CalendarClock,
  CheckCheck,
  FileText,
  MessageSquare,
  Plus,
  Printer,
  Send
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { Appointment, DocumentRecord, PracticeScheduleSlot } from '../types/models';

export const AdminOpsModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    practice,
    systemSettings,
    upsertRecord,
    notifyToast,
    setPrintPayload,
    can
  } = usePractice();

  // Schedule state
  const [slots, setSlots] = useState<PracticeScheduleSlot[]>(systemSettings.scheduleSlots);

  // Appointment form
  const [aptForm, setAptForm] = useState({
    patientId: dbState.patients[0]?.id || '',
    scheduledDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    scheduledTime: '10:00',
    purpose: 'Kontrol ANC Rutin'
  });

  // Document generator form
  const [docForm, setDocForm] = useState({
    patientId: dbState.patients[0]?.id || '',
    docType: 'Surat Keterangan' as DocumentRecord['docType'],
    title: 'Surat Keterangan Pemeriksaan Kehamilan',
    content: systemSettings.templates.suratKeteranganBody
  });

  // ==================== 1. JADWAL PRAKTIK ====================
  if (activeView === 'schedule') {
    const saveSchedule = async () => {
      await upsertRecord('system_settings', { ...systemSettings, scheduleSlots: slots });
      notifyToast('Jadwal praktik & kuota pasien berhasil disimpan.', 'success');
    };

    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Jadwal Praktik Dokter &amp; Kuota</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Konfigurasi hari praktik, jam operasional, dan kuota pasien harian ({practice.operationalHours}).
            </p>
          </div>
          {can('schedule.manage') && (
            <button type="button" onClick={() => void saveSchedule()} className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap">
              Simpan Jadwal Praktik
            </button>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Hari</th>
                  <th className="px-4 py-3 text-left font-semibold">Dokter Sp.OG</th>
                  <th className="px-4 py-3 text-left font-semibold">Jam Mulai</th>
                  <th className="px-4 py-3 text-left font-semibold">Jam Selesai</th>
                  <th className="px-4 py-3 text-left font-semibold">Kuota Pasien</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {slots.map((s, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{s.dayOfWeek}</td>
                    <td className="px-4 py-3 text-slate-700">{s.doctorName}</td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        disabled={!can('schedule.manage')}
                        value={s.startTime}
                        onChange={(e) => setSlots((prev) => prev.map((x, i) => (i === idx ? { ...x, startTime: e.target.value } : x)))}
                        className="h-8 px-2 rounded border border-slate-300 font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="time"
                        disabled={!can('schedule.manage')}
                        value={s.endTime}
                        onChange={(e) => setSlots((prev) => prev.map((x, i) => (i === idx ? { ...x, endTime: e.target.value } : x)))}
                        className="h-8 px-2 rounded border border-slate-300 font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <input
                        type="number"
                        min={1}
                        disabled={!can('schedule.manage')}
                        value={s.quota}
                        onChange={(e) => setSlots((prev) => prev.map((x, i) => (i === idx ? { ...x, quota: Number(e.target.value) } : x)))}
                        className="w-20 h-8 px-2 rounded border border-slate-300 font-mono"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={!can('schedule.manage')}
                          checked={s.active}
                          onChange={(e) => setSlots((prev) => prev.map((x, i) => (i === idx ? { ...x, active: e.target.checked } : x)))}
                          className="rounded border-slate-300 text-teal-700"
                        />
                        <span>{s.active ? 'Aktif' : 'Libur'}</span>
                      </label>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. JADWAL KONTROL ====================
  if (activeView === 'appointments') {
    const handleCreateApt = async (e: React.FormEvent) => {
      e.preventDefault();
      const patient = dbState.patients.find((p) => p.id === aptForm.patientId);
      if (!patient || !currentUser) {
        notifyToast('Pilih pasien terlebih dahulu.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const apt: Appointment = {
        id: `apt-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.fullName,
        patientRm: patient.rmNumber,
        patientPhone: patient.phone,
        doctorId: 'usr-dokter',
        doctorName: `${practice.doctorName}, ${practice.doctorTitle}`,
        scheduledDate: aptForm.scheduledDate,
        scheduledTime: aptForm.scheduledTime,
        purpose: aptForm.purpose.trim() || 'Kontrol Ulang',
        status: 'Terjadwal',
        reminderSent: false,
        rescheduleHistory: [],
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('appointments', apt);
      notifyToast(`Jadwal kontrol ${patient.fullName} pada ${apt.scheduledDate} tersimpan.`, 'success');
    };

    const handleSendReminder = async (apt: Appointment) => {
      const waIntegration = dbState.integrations.find((i) => i.provider === 'WHATSAPP_API');
      await upsertRecord('appointments', {
        ...apt,
        reminderSent: true,
        reminderSentAt: new Date().toISOString()
      });
      notifyToast(
        waIntegration?.enabled
          ? `Pengingat WhatsApp API dikirim ke ${apt.patientPhone}.`
          : `Pengingat kontrol untuk ${apt.patientName} ditandai terkirim (mode internal — aktifkan WhatsApp Official API di Integrasi untuk pengiriman otomatis).`,
        'info'
      );
    };

    const handleUpdateAptStatus = async (apt: Appointment, status: Appointment['status']) => {
      await upsertRecord('appointments', { ...apt, status });
      notifyToast(`Status kontrol ${apt.patientName} diubah menjadi ${status}.`, 'info');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Jadwal Kontrol &amp; Pengingat Pasien</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola jadwal kontrol ANC/ginekologi, penjadwalan ulang, pembatalan, dan pengingat WhatsApp resmi.
          </p>
        </div>

        <form onSubmit={handleCreateApt} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs items-end">
          <div className="sm:col-span-2">
            <label className="block font-medium text-slate-700 mb-1">Pasien</label>
            <select value={aptForm.patientId} onChange={(e) => setAptForm({ ...aptForm, patientId: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
              <option value="">-- Pilih Pasien --</option>
              {dbState.patients.map((p) => (
                <option key={p.id} value={p.id}>{p.rmNumber} — {p.fullName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Tanggal Kontrol</label>
            <input type="date" value={aptForm.scheduledDate} onChange={(e) => setAptForm({ ...aptForm, scheduledDate: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" />
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Tujuan Kontrol</label>
            <input value={aptForm.purpose} onChange={(e) => setAptForm({ ...aptForm, purpose: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" />
          </div>
          <button type="submit" className="h-9 px-4 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 whitespace-nowrap inline-flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> Jadwalkan
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Tanggal &amp; Jam</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-left font-semibold">Keperluan</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Pengingat &amp; Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.appointments.map((apt) => (
                  <tr key={apt.id}>
                    <td className="px-4 py-3 font-mono text-slate-800 whitespace-nowrap">{apt.scheduledDate} · {apt.scheduledTime}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{apt.patientName}</p>
                      <p className="text-slate-500 font-mono">{apt.patientRm} · {apt.patientPhone}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{apt.purpose}</td>
                    <td className="px-4 py-3">
                      <select value={apt.status} onChange={(e) => void handleUpdateAptStatus(apt, e.target.value as Appointment['status'])} className="h-8 px-2 rounded border border-slate-300 bg-white">
                        {['Terjadwal', 'Hadir', 'Dijadwalkan Ulang', 'Dibatalkan'].map((st) => (
                          <option key={st} value={st}>{st}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => void handleSendReminder(apt)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100"
                      >
                        {apt.reminderSent ? <MessageSquare className="w-3.5 h-3.5 text-emerald-700" /> : <Send className="w-3.5 h-3.5" />}
                        {apt.reminderSent ? 'Kirim Ulang Pengingat' : 'Kirim Pengingat'}
                      </button>
                    </td>
                  </tr>
                ))}
                {dbState.appointments.length === 0 && (
                  <tr><td colSpan={5} className="py-10 text-center text-slate-400"><CalendarClock className="w-6 h-6 mx-auto mb-1 text-slate-300" />Belum ada jadwal kontrol pasien.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 3. PUSAT DOKUMEN DIGITAL ====================
  if (activeView === 'documents') {
    const handleCreateDocument = async (e: React.FormEvent) => {
      e.preventDefault();
      const patient = dbState.patients.find((p) => p.id === docForm.patientId);
      if (!patient || !docForm.title.trim() || !currentUser) {
        notifyToast('Pilih pasien dan isi judul dokumen.', 'error');
        return;
      }
      if ((docForm.docType === 'Surat Keterangan' || docForm.docType === 'Surat Rujukan') && !can('documents.medical')) {
        notifyToast('Hanya Dokter Sp.OG atau Super Admin yang berwenang menerbitkan surat keterangan medis/rujukan.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const rec: DocumentRecord = {
        id: `doc-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.fullName,
        patientRm: patient.rmNumber,
        docType: docForm.docType,
        title: docForm.title.trim(),
        content: docForm.content.trim(),
        signedBy: currentUser.displayName,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('documents', rec);
      notifyToast(`Dokumen "${rec.title}" berhasil dibuat.`, 'success');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pusat Dokumen Digital</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Penerbitan surat keterangan medis, surat rujukan dokter, dan arsip dokumen pasien dengan kop resmi praktik.
          </p>
        </div>

        <form onSubmit={handleCreateDocument} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
          <h2 className="text-sm font-bold text-slate-900">Buat Dokumen / Surat Medis Baru</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Pasien</label>
              <select value={docForm.patientId} onChange={(e) => setDocForm({ ...docForm, patientId: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                <option value="">-- Pilih Pasien --</option>
                {dbState.patients.map((p) => (
                  <option key={p.id} value={p.id}>{p.rmNumber} — {p.fullName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Jenis Dokumen</label>
              <select
                value={docForm.docType}
                onChange={(e) => {
                  const dt = e.target.value as DocumentRecord['docType'];
                  setDocForm({
                    ...docForm,
                    docType: dt,
                    title: dt === 'Surat Rujukan' ? 'Surat Rujukan Dokter Sp.OG' : dt === 'Surat Keterangan' ? 'Surat Keterangan Medis / Kehamilan' : dt,
                    content:
                      dt === 'Surat Rujukan'
                        ? systemSettings.templates.suratRujukanHeader
                        : systemSettings.templates.suratKeteranganBody
                  });
                }}
                className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
              >
                <option value="Surat Keterangan">Surat Keterangan Medis</option>
                <option value="Surat Rujukan">Surat Rujukan</option>
                <option value="Dokumen Administrasi">Dokumen Administrasi</option>
              </select>
            </div>
            <div>
              <label className="block font-medium text-slate-700 mb-1">Judul Dokumen</label>
              <input value={docForm.title} onChange={(e) => setDocForm({ ...docForm, title: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300" />
            </div>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Isi Dokumen</label>
            <textarea rows={4} value={docForm.content} onChange={(e) => setDocForm({ ...docForm, content: e.target.value })} className="w-full p-3 rounded-lg border border-slate-300" />
          </div>
          <div className="flex justify-end">
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">
              Terbitkan &amp; Arsipkan Dokumen
            </button>
          </div>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Arsip Dokumen ({dbState.documents.length})</h2>
          </div>
          <div className="divide-y divide-slate-100 text-xs">
            {dbState.documents.map((docItem) => (
              <div key={docItem.id} className="p-4 flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-slate-900">{docItem.title}</p>
                  <p className="text-slate-500">
                    {docItem.docType} · {docItem.patientName} ({docItem.patientRm}) · {docItem.createdAt.slice(0, 10)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setPrintPayload({
                      type: docItem.docType === 'Surat Rujukan' ? 'surat_rujukan' : 'surat_keterangan',
                      title: docItem.title.toUpperCase(),
                      subtitle: docItem.docType,
                      data: docItem as unknown as Record<string, unknown>
                    })
                  }
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak PDF
                </button>
              </div>
            ))}
            {dbState.documents.length === 0 && (
              <div className="py-10 text-center text-slate-400">
                <FileText className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                Belum ada dokumen tersimpan.
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== 4. NOTIFIKASI INTERNAL ====================
  const myNotifs = currentUser
    ? dbState.notifications.filter((n) => n.targetRoles.includes(currentUser.role))
    : [];

  const markAllRead = async () => {
    for (const n of myNotifs.filter((x) => !x.read)) {
      await upsertRecord('notifications', { ...n, read: true });
    }
    notifyToast('Seluruh notifikasi ditandai sudah dibaca.', 'info');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pusat Notifikasi Internal</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pemberitahuan real-time pasien baru, antrean, tagihan belum dibayar, jadwal kontrol, hasil lab &amp; perubahan data penting.
          </p>
        </div>
        <button type="button" onClick={() => void markAllRead()} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
          <CheckCheck className="w-4 h-4 text-teal-700" />
          Tandai Semua Dibaca
        </button>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl divide-y divide-slate-100">
        {myNotifs.map((n) => (
          <div key={n.id} className={`p-4 flex items-start justify-between gap-4 text-xs ${n.read ? 'opacity-65' : 'bg-teal-50/25'}`}>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className={`font-bold ${n.severity === 'critical' ? 'text-red-700' : n.severity === 'warning' ? 'text-amber-700' : 'text-teal-800'}`}>
                  {n.title}
                </span>
                <span className="text-slate-400">· {n.category}</span>
              </div>
              <p className="text-slate-700">{n.message}</p>
            </div>
            <div className="text-right shrink-0 space-y-1">
              <p className="font-mono text-slate-400">{n.createdAt.slice(0, 16).replace('T', ' ')}</p>
              {!n.read && (
                <button
                  type="button"
                  onClick={() => void upsertRecord('notifications', { ...n, read: true })}
                  className="text-teal-700 font-semibold hover:underline"
                >
                  Tandai Dibaca
                </button>
              )}
            </div>
          </div>
        ))}
        {myNotifs.length === 0 && (
          <div className="py-12 text-center text-slate-400 text-xs">
            <Bell className="w-7 h-7 mx-auto mb-2 text-slate-300" />
            Tidak ada notifikasi untuk role Anda saat ini.
          </div>
        )}
      </div>
    </div>
  );
};
