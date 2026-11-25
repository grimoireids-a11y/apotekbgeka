import React, { useEffect, useMemo, useState } from 'react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import {
  Baby,
  CheckCircle2,
  FileUp,
  Plus,
  Printer,
  ScanLine,
  X
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { AntenatalVisit, Pregnancy, UltrasoundRecord } from '../types/models';
import {
  calculateGestationalAge,
  calculateHadlockEfw,
  calculateHplFromHpht
} from '../utils/obstetrics';

export const PregnancyUsgModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    upsertRecord,
    notifyToast,
    setPrintPayload,
    can
  } = usePractice();

  const canWriteClinical = can('pregnancy.manage');

  // Pregnancy state
  const [selectedPregnancyId, setSelectedPregnancyId] = useState<string>(dbState.pregnancies[0]?.id || '');

  useEffect(() => {
    if (dbState.pregnancies.length === 0) return;
    if (!selectedPregnancyId || !dbState.pregnancies.some((p) => p.id === selectedPregnancyId)) {
      setSelectedPregnancyId(dbState.pregnancies[0].id);
    }
  }, [dbState.pregnancies, selectedPregnancyId]);
  const [pregModalOpen, setPregModalOpen] = useState(false);
  const [ancModalOpen, setAncModalOpen] = useState(false);
  const [pregForm, setPregForm] = useState({
    patientId: '',
    hpht: '',
    gravida: 1,
    para: 0,
    abortus: 0,
    complications: '',
    riskFactors: '',
    riskLevel: 'Rendah' as 'Rendah' | 'Sedang' | 'Tinggi',
    deliveryHistory: '',
    miscarriageHistory: '',
    nextAncDate: ''
  });
  const [ancForm, setAncForm] = useState({
    visitDate: new Date().toISOString().slice(0, 10),
    gestationalAgeWeeks: 20,
    weightKg: 60,
    bloodPressure: '115/75',
    fundalHeightCm: 20,
    fetalHeartRate: 142,
    examNotes: '',
    usgSummary: '',
    diagnosis: 'Z34.0 ANC Normal',
    therapy: 'Folamil Genio 1x1',
    nextControlDate: ''
  });

  // USG state
  const [usgModalOpen, setUsgModalOpen] = useState(false);
  const [usgForm, setUsgForm] = useState({
    patientId: '',
    visitId: '',
    examDate: new Date().toISOString().slice(0, 10),
    examType: 'USG Obstetri' as UltrasoundRecord['examType'],
    gestationalAge: '',
    fetalCount: 1,
    presentation: 'Kepala',
    bpdMm: 78,
    hcMm: 285,
    acMm: 270,
    flMm: 60,
    fhrBpm: 142,
    placenta: 'Korpus posterior, tidak menutupi OUI',
    amnioticFluid: 'Cukup (AFI 12 cm)',
    fetalPosition: 'Punggung kiri',
    uterusSize: '',
    endometriumThicknessMm: 8,
    rightOvary: 'Normal, tidak tampak massa/kista',
    leftOvary: 'Normal, tidak tampak massa/kista',
    massSize: '',
    otherFindings: '',
    conclusion: '',
    mediaUrls: [] as { name: string; type: 'image' | 'video'; url: string }[]
  });

  const activePregnancy = useMemo(
    () => dbState.pregnancies.find((p) => p.id === selectedPregnancyId) || dbState.pregnancies[0] || null,
    [dbState.pregnancies, selectedPregnancyId]
  );

  const ancTimeline = useMemo(() => {
    if (!activePregnancy) return [];
    return dbState.antenatal_visits
      .filter((a) => a.pregnancyId === activePregnancy.id)
      .sort((a, b) => a.gestationalAgeWeeks - b.gestationalAgeWeeks);
  }, [dbState.antenatal_visits, activePregnancy]);

  const computedPregHpl = useMemo(() => calculateHplFromHpht(pregForm.hpht), [pregForm.hpht]);
  const computedPregGa = useMemo(() => calculateGestationalAge(pregForm.hpht), [pregForm.hpht]);

  const computedEfw = useMemo(
    () =>
      calculateHadlockEfw({
        bpdMm: usgForm.bpdMm,
        hcMm: usgForm.hcMm,
        acMm: usgForm.acMm,
        flMm: usgForm.flMm
      }),
    [usgForm.bpdMm, usgForm.hcMm, usgForm.acMm, usgForm.flMm]
  );

  const handleSavePregnancy = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = dbState.patients.find((p) => p.id === pregForm.patientId);
    if (!patient || !pregForm.hpht) {
      notifyToast('Pilih pasien dan masukkan tanggal HPHT.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const ga = calculateGestationalAge(pregForm.hpht);
    const hpl = calculateHplFromHpht(pregForm.hpht);
    const id = `preg-${Date.now()}`;
    const record: Pregnancy = {
      id,
      patientId: patient.id,
      patientName: patient.fullName,
      patientRm: patient.rmNumber,
      hpht: pregForm.hpht,
      hpl,
      gestationalAgeWeeks: ga.weeks,
      gestationalAgeDays: ga.days,
      gravida: Number(pregForm.gravida),
      para: Number(pregForm.para),
      abortus: Number(pregForm.abortus),
      complications: pregForm.complications.trim() || 'Tidak ada',
      riskFactors: pregForm.riskFactors.trim() || 'Risiko rendah',
      riskLevel: pregForm.riskLevel,
      deliveryHistory: pregForm.deliveryHistory.trim() || '-',
      miscarriageHistory: pregForm.miscarriageHistory.trim() || '-',
      status: 'Aktif',
      nextAncDate: pregForm.nextAncDate || undefined,
      doctorConfirmed: true,
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };
    await upsertRecord('pregnancies', record);
    setSelectedPregnancyId(id);
    setPregModalOpen(false);
    notifyToast(`Data kehamilan ${patient.fullName} (HPL ${hpl}) tersimpan.`, 'success');
  };

  const handleSaveAnc = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activePregnancy) return;
    const nowIso = new Date().toISOString();
    const rec: AntenatalVisit = {
      id: `anc-${Date.now()}`,
      pregnancyId: activePregnancy.id,
      patientId: activePregnancy.patientId,
      visitDate: ancForm.visitDate,
      gestationalAgeWeeks: Number(ancForm.gestationalAgeWeeks),
      weightKg: Number(ancForm.weightKg),
      bloodPressure: ancForm.bloodPressure,
      fundalHeightCm: Number(ancForm.fundalHeightCm),
      fetalHeartRate: Number(ancForm.fetalHeartRate),
      examNotes: ancForm.examNotes,
      usgSummary: ancForm.usgSummary,
      diagnosis: ancForm.diagnosis,
      therapy: ancForm.therapy,
      nextControlDate: ancForm.nextControlDate,
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };
    await upsertRecord('antenatal_visits', rec);
    if (ancForm.nextControlDate) {
      await upsertRecord('pregnancies', {
        ...activePregnancy,
        nextAncDate: ancForm.nextControlDate,
        gestationalAgeWeeks: rec.gestationalAgeWeeks
      });
    }
    setAncModalOpen(false);
    notifyToast('Kunjungan ANC ditambahkan ke timeline kehamilan.', 'success');
  };

  const handleUsgMediaUpload = (file: File | null) => {
    if (!file) return;
    if (file.size > 2000000) {
      notifyToast('Ukuran file media USG maksimal 2 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const type: 'image' | 'video' = file.type.startsWith('video/') ? 'video' : 'image';
        setUsgForm((prev) => ({
          ...prev,
          mediaUrls: [...prev.mediaUrls, { name: file.name, type, url: reader.result as string }]
        }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveUsg = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = dbState.patients.find((p) => p.id === usgForm.patientId);
    if (!patient || !usgForm.conclusion.trim()) {
      notifyToast('Pilih pasien dan isi kesimpulan pemeriksaan USG.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const isObstetric = usgForm.examType === 'USG Obstetri' || usgForm.examType === 'USG Transabdominal';
    const rec: UltrasoundRecord = {
      id: `usg-${Date.now()}`,
      patientId: patient.id,
      patientName: patient.fullName,
      patientRm: patient.rmNumber,
      visitId: usgForm.visitId || dbState.visits.find((v) => v.patientId === patient.id)?.id || 'manual',
      examDate: usgForm.examDate,
      examType: usgForm.examType,
      ...(isObstetric
        ? {
            gestationalAge: usgForm.gestationalAge || '-',
            fetalCount: Number(usgForm.fetalCount),
            presentation: usgForm.presentation,
            bpdMm: Number(usgForm.bpdMm),
            hcMm: Number(usgForm.hcMm),
            acMm: Number(usgForm.acMm),
            flMm: Number(usgForm.flMm),
            efwGrams: computedEfw,
            fhrBpm: Number(usgForm.fhrBpm),
            placenta: usgForm.placenta,
            amnioticFluid: usgForm.amnioticFluid,
            fetalPosition: usgForm.fetalPosition
          }
        : {
            uterusSize: usgForm.uterusSize,
            endometriumThicknessMm: Number(usgForm.endometriumThicknessMm),
            rightOvary: usgForm.rightOvary,
            leftOvary: usgForm.leftOvary,
            massSize: usgForm.massSize,
            otherFindings: usgForm.otherFindings
          }),
      conclusion: usgForm.conclusion.trim(),
      mediaUrls: usgForm.mediaUrls,
      verifiedByDoctor: currentUser?.role === 'DOKTER_SPOG' || currentUser?.role === 'SUPER_ADMIN',
      verifiedByName: currentUser?.displayName,
      verifiedAt: nowIso,
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };

    await upsertRecord('ultrasound_records', rec);
    setUsgModalOpen(false);
    notifyToast(`Hasil ${rec.examType} untuk ${patient.fullName} tersimpan dan diverifikasi.`, 'success');
  };

  // ==================== USG MODULE ====================
  if (activeView === 'usg') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Modul Pemeriksaan USG</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              USG Obstetri (Biometri Hadlock EFW otomatis), USG Ginekologi, unggah gambar/video, verifikasi dokter &amp; cetak laporan.
            </p>
          </div>
          {canWriteClinical && (
            <button
              type="button"
              onClick={() => {
                setUsgForm((prev) => ({ ...prev, patientId: dbState.patients[0]?.id || '', mediaUrls: [], conclusion: '' }));
                setUsgModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Catat Pemeriksaan USG
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {dbState.ultrasound_records.map((u) => (
            <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-3 text-xs">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-bold text-sm text-slate-900">{u.patientName}</p>
                  <p className="text-slate-500 font-mono">
                    {u.patientRm} · {u.examDate} · {u.examType}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1 font-semibold text-emerald-700 shrink-0">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {u.verifiedByDoctor ? 'Terverifikasi' : 'Menunggu Verifikasi'}
                </span>
              </div>

              {u.efwGrams ? (
                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono tabular-nums">
                  <div>
                    <span className="text-slate-500 block text-[10px]">BPD / HC</span>
                    <span className="font-semibold text-slate-900">{u.bpdMm} / {u.hcMm} mm</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">AC / FL</span>
                    <span className="font-semibold text-slate-900">{u.acMm} / {u.flMm} mm</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">EFW / DJJ</span>
                    <span className="font-semibold text-teal-800">{u.efwGrams}g · {u.fhrBpm} dpm</span>
                  </div>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                  <p><span className="text-slate-500">Uterus:</span> {u.uterusSize || '-'} · Endometrium: {u.endometriumThicknessMm || '-'} mm</p>
                  <p><span className="text-slate-500">Ovarium:</span> Ka ({u.rightOvary || '-'}) · Ki ({u.leftOvary || '-'})</p>
                </div>
              )}

              <p className="text-slate-700 leading-relaxed">{u.conclusion}</p>

              {u.mediaUrls && u.mediaUrls.length > 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {u.mediaUrls.map((m, idx) =>
                    m.type === 'image' ? (
                      <img
                        key={idx}
                        src={m.url}
                        alt={m.name}
                        className="w-24 h-20 object-cover rounded-lg border border-slate-200"
                      />
                    ) : (
                      <span key={idx} className="text-teal-700 font-medium underline">
                        Video: {m.name}
                      </span>
                    )
                  )}
                </div>
              )}

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                <span className="text-slate-400">Verifikator: {u.verifiedByName || '-'}</span>
                <button
                  type="button"
                  onClick={() =>
                    setPrintPayload({
                      type: 'usg',
                      title: 'LAPORAN HASIL ULTRASONOGRAFI (USG)',
                      subtitle: `${u.examType} · ${u.examDate}`,
                      data: u as unknown as Record<string, unknown>
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-teal-700 font-semibold hover:underline"
                >
                  <Printer className="w-3.5 h-3.5" />
                  Cetak Laporan USG
                </button>
              </div>
            </div>
          ))}
          {dbState.ultrasound_records.length === 0 && (
            <div className="md:col-span-2 bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
              <ScanLine className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">Belum Ada Rekaman USG</p>
              <p className="text-xs text-slate-500">Klik tombol Catat Pemeriksaan USG untuk menambahkan laporan USG baru.</p>
            </div>
          )}
        </div>

        {/* USG Entry Modal */}
        {usgModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 overflow-y-auto" role="dialog" aria-modal="true">
            <div className="bg-white border border-slate-200 rounded-xl max-w-2xl w-full p-6 space-y-5 my-8">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-slate-900">Catat Hasil Pemeriksaan USG</h3>
                <button type="button" onClick={() => setUsgModalOpen(false)} aria-label="Tutup modal USG" className="p-1.5 text-slate-500">
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSaveUsg} className="space-y-4 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="sm:col-span-2">
                    <label className="block font-medium text-slate-700 mb-1">Pasien *</label>
                    <select
                      required
                      value={usgForm.patientId}
                      onChange={(e) => setUsgForm({ ...usgForm, patientId: e.target.value })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Pilih Pasien --</option>
                      {dbState.patients.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.rmNumber} — {p.fullName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Jenis USG</label>
                    <select
                      value={usgForm.examType}
                      onChange={(e) => setUsgForm({ ...usgForm, examType: e.target.value as UltrasoundRecord['examType'] })}
                      className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="USG Obstetri">USG Obstetri</option>
                      <option value="USG Ginekologi">USG Ginekologi</option>
                      <option value="USG Transabdominal">USG Transabdominal</option>
                      <option value="USG Transvaginal">USG Transvaginal</option>
                      <option value="Lainnya">Lainnya</option>
                    </select>
                  </div>
                </div>

                {(usgForm.examType === 'USG Obstetri' || usgForm.examType === 'USG Transabdominal') ? (
                  <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">Biometri Obstetri (mm)</span>
                      <span className="font-mono font-bold text-teal-800">
                        Estimasi Berat Janin (Hadlock EFW): {computedEfw} gram
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div>
                        <label className="block text-slate-600 mb-1">BPD (mm)</label>
                        <input type="number" value={usgForm.bpdMm} onChange={(e) => setUsgForm({ ...usgForm, bpdMm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">HC (mm)</label>
                        <input type="number" value={usgForm.hcMm} onChange={(e) => setUsgForm({ ...usgForm, hcMm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">AC (mm)</label>
                        <input type="number" value={usgForm.acMm} onChange={(e) => setUsgForm({ ...usgForm, acMm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">FL (mm)</label>
                        <input type="number" value={usgForm.flMm} onChange={(e) => setUsgForm({ ...usgForm, flMm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Usia Kehamilan</label>
                        <input value={usgForm.gestationalAge} onChange={(e) => setUsgForm({ ...usgForm, gestationalAge: e.target.value })} placeholder="32 mgg 2 hr" className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">DJJ / FHR (dpm)</label>
                        <input type="number" value={usgForm.fhrBpm} onChange={(e) => setUsgForm({ ...usgForm, fhrBpm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Plasenta</label>
                        <input value={usgForm.placenta} onChange={(e) => setUsgForm({ ...usgForm, placenta: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                      </div>
                      <div>
                        <label className="block text-slate-600 mb-1">Cairan Ketuban</label>
                        <input value={usgForm.amnioticFluid} onChange={(e) => setUsgForm({ ...usgForm, amnioticFluid: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <div>
                      <label className="block text-slate-600 mb-1">Ukuran Uterus</label>
                      <input value={usgForm.uterusSize} onChange={(e) => setUsgForm({ ...usgForm, uterusSize: e.target.value })} placeholder="7.2 x 4.5 x 3.8 cm antefleksi" className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Ketebalan Endometrium (mm)</label>
                      <input type="number" step="0.1" value={usgForm.endometriumThicknessMm} onChange={(e) => setUsgForm({ ...usgForm, endometriumThicknessMm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono" />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Ovarium Kanan</label>
                      <input value={usgForm.rightOvary} onChange={(e) => setUsgForm({ ...usgForm, rightOvary: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                    </div>
                    <div>
                      <label className="block text-slate-600 mb-1">Ovarium Kiri</label>
                      <input value={usgForm.leftOvary} onChange={(e) => setUsgForm({ ...usgForm, leftOvary: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="block text-slate-600 mb-1">Ukuran Massa / Lesi &amp; Temuan Lain</label>
                      <input value={usgForm.massSize} onChange={(e) => setUsgForm({ ...usgForm, massSize: e.target.value })} placeholder="Jika ditemukan mioma/kista, sebutkan ukuran" className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white" />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-medium text-slate-700 mb-1">Kesimpulan Pemeriksaan Dokter *</label>
                  <textarea
                    required
                    rows={3}
                    value={usgForm.conclusion}
                    onChange={(e) => setUsgForm({ ...usgForm, conclusion: e.target.value })}
                    placeholder="Tulis kesimpulan klinis USG secara lengkap..."
                    className="w-full p-2.5 rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-dashed border-teal-500 text-teal-800 font-semibold cursor-pointer hover:bg-teal-50">
                    <FileUp className="w-4 h-4" />
                    Unggah Gambar / Video USG ({usgForm.mediaUrls.length} file)
                    <input
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleUsgMediaUpload(e.target.files?.[0] || null)}
                    />
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-2">
                  <button type="button" onClick={() => setUsgModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold text-slate-700">Batal</button>
                  <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">Simpan &amp; Verifikasi USG</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== PREGNANCY MANAGEMENT MODULE ====================
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Manajemen Kehamilan (ANC)</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pelacakan episode kehamilan per pasien, perhitungan obstetri HPHT/HPL, timeline ANC, dan grafik pertumbuhan maternal-janin.
          </p>
        </div>
        {canWriteClinical && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setPregForm((f) => ({ ...f, patientId: dbState.patients[0]?.id || '' }));
                setPregModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              <Plus className="w-4 h-4" />
              Catat Kehamilan Baru
            </button>
            {activePregnancy && (
              <button
                type="button"
                onClick={() => {
                  setAncForm((a) => ({ ...a, gestationalAgeWeeks: activePregnancy.gestationalAgeWeeks }));
                  setAncModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-teal-700 text-teal-800 bg-white text-xs font-semibold hover:bg-teal-50 whitespace-nowrap"
              >
                <Plus className="w-4 h-4" />
                Tambah Kunjungan ANC
              </button>
            )}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Pregnancy Episodes List */}
        <div className="lg:col-span-4 space-y-2.5">
          {dbState.pregnancies.map((pr) => {
            const active = activePregnancy?.id === pr.id;
            return (
              <button
                key={pr.id}
                type="button"
                onClick={() => setSelectedPregnancyId(pr.id)}
                className={`w-full text-left p-4 rounded-xl border transition-colors ${
                  active ? 'bg-teal-50/70 border-teal-600' : 'bg-white border-slate-200 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-bold text-slate-900 truncate">{pr.patientName}</p>
                  <span
                    className={`text-xs font-semibold ${
                      pr.riskLevel === 'Tinggi'
                        ? 'text-red-700'
                        : pr.riskLevel === 'Sedang'
                        ? 'text-amber-700'
                        : 'text-emerald-700'
                    }`}
                  >
                    Risiko {pr.riskLevel}
                  </span>
                </div>
                <p className="text-xs text-slate-600 font-mono mt-1">
                  {pr.patientRm} · G{pr.gravida}P{pr.para}A{pr.abortus} · UK {pr.gestationalAgeWeeks} mgg
                </p>
                <p className="text-xs text-slate-500 mt-1">
                  HPHT {pr.hpht} · HPL <strong className="text-slate-800 font-mono">{pr.hpl}</strong>
                </p>
              </button>
            );
          })}
          {dbState.pregnancies.length === 0 && (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center space-y-2">
              <Baby className="w-8 h-8 text-slate-300 mx-auto" />
              <p className="text-xs text-slate-500">Belum ada episode kehamilan tercatat.</p>
            </div>
          )}
        </div>

        {/* Selected Pregnancy Detail + Growth Chart + ANC Timeline */}
        <div className="lg:col-span-8 space-y-6">
          {activePregnancy ? (
            <>
              <div className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <p className="text-slate-500">Paritas &amp; Status</p>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">
                    G{activePregnancy.gravida}P{activePregnancy.para}A{activePregnancy.abortus} · {activePregnancy.status}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">HPHT / HPL</p>
                  <p className="font-bold text-teal-800 font-mono mt-0.5">
                    {activePregnancy.hpht} / {activePregnancy.hpl}
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Usia Kehamilan</p>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">
                    {activePregnancy.gestationalAgeWeeks} mgg {activePregnancy.gestationalAgeDays} hr
                  </p>
                </div>
                <div>
                  <p className="text-slate-500">Kontrol ANC Berikutnya</p>
                  <p className="font-bold text-slate-900 font-mono mt-0.5">
                    {activePregnancy.nextAncDate || 'Belum dijadwalkan'}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-4 pt-3 border-t border-slate-100 text-slate-600">
                  <strong>Faktor Risiko &amp; Komplikasi:</strong> {activePregnancy.riskFactors} · {activePregnancy.complications}
                </div>
              </div>

              {/* Growth Chart (Weight, Fundal Height, FHR) */}
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
                <h2 className="text-sm font-bold text-slate-900">Grafik Perkembangan Kehamilan (BB Ibu &amp; TFU per Minggu)</h2>
                {ancTimeline.length === 0 ? (
                  <p className="py-8 text-center text-xs text-slate-400">Tambahkan minimal 1 kunjungan ANC untuk menampilkan kurva pertumbuhan.</p>
                ) : (
                  <div className="h-56 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={ancTimeline}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                        <XAxis dataKey="gestationalAgeWeeks" tick={{ fontSize: 11 }} unit=" mgg" />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="weightKg" name="Berat Badan (kg)" stroke="#0F766E" strokeWidth={2} dot={{ r: 4 }} />
                        <Line type="monotone" dataKey="fundalHeightCm" name="TFU (cm)" stroke="#10B981" strokeWidth={2} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>

              {/* ANC Timeline Table */}
              <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
                <div className="px-5 py-3.5 border-b border-slate-200">
                  <h2 className="text-sm font-bold text-slate-900">Timeline Kunjungan Antenatal Care (ANC)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                        <th className="px-4 py-2.5 text-left font-semibold">Tanggal</th>
                        <th className="px-4 py-2.5 text-left font-semibold">UK</th>
                        <th className="px-4 py-2.5 text-left font-semibold">BB / TD</th>
                        <th className="px-4 py-2.5 text-left font-semibold">TFU / DJJ</th>
                        <th className="px-4 py-2.5 text-left font-semibold">Diagnosis &amp; Terapi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {ancTimeline.map((a) => (
                        <tr key={a.id}>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{a.visitDate}</td>
                          <td className="px-4 py-2.5 font-mono font-bold text-teal-800">{a.gestationalAgeWeeks} mgg</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{a.weightKg} kg · {a.bloodPressure}</td>
                          <td className="px-4 py-2.5 font-mono text-slate-700">{a.fundalHeightCm} cm · {a.fetalHeartRate} dpm</td>
                          <td className="px-4 py-2.5">
                            <p className="font-semibold text-slate-900">{a.diagnosis}</p>
                            <p className="text-slate-500">{a.therapy}</p>
                          </td>
                        </tr>
                      ))}
                      {ancTimeline.length === 0 && (
                        <tr>
                          <td colSpan={5} className="py-8 text-center text-slate-400">Belum ada kunjungan ANC.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center text-xs text-slate-400">
              Pilih pasien di sebelah kiri atau tambahkan episode kehamilan baru.
            </div>
          )}
        </div>
      </div>

      {/* Add Pregnancy Modal */}
      {pregModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Catat Episode Kehamilan Baru</h3>
              <button type="button" onClick={() => setPregModalOpen(false)} aria-label="Tutup modal kehamilan"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSavePregnancy} className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Pasien *</label>
                  <select required value={pregForm.patientId} onChange={(e) => setPregForm({ ...pregForm, patientId: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                    <option value="">-- Pilih Pasien --</option>
                    {dbState.patients.map((p) => (
                      <option key={p.id} value={p.id}>{p.rmNumber} — {p.fullName}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">HPHT *</label>
                  <input type="date" required value={pregForm.hpht} onChange={(e) => setPregForm({ ...pregForm, hpht: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono" />
                </div>
                <div className="p-2.5 rounded-lg bg-teal-50 border border-teal-200">
                  <span className="text-[11px] text-teal-800 block">Kalkulasi Obstetri (Naegele)</span>
                  <span className="font-mono font-bold text-teal-950">HPL: {computedPregHpl || '-'} · UK {computedPregGa.weeks}m {computedPregGa.days}h</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div><label className="block text-slate-600 mb-1">G</label><input type="number" min={1} value={pregForm.gravida} onChange={(e) => setPregForm({ ...pregForm, gravida: Number(e.target.value) })} className="w-full h-9 px-2 rounded-lg border border-slate-300 font-mono" /></div>
                  <div><label className="block text-slate-600 mb-1">P</label><input type="number" min={0} value={pregForm.para} onChange={(e) => setPregForm({ ...pregForm, para: Number(e.target.value) })} className="w-full h-9 px-2 rounded-lg border border-slate-300 font-mono" /></div>
                  <div><label className="block text-slate-600 mb-1">A</label><input type="number" min={0} value={pregForm.abortus} onChange={(e) => setPregForm({ ...pregForm, abortus: Number(e.target.value) })} className="w-full h-9 px-2 rounded-lg border border-slate-300 font-mono" /></div>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tingkat Risiko</label>
                  <select value={pregForm.riskLevel} onChange={(e) => setPregForm({ ...pregForm, riskLevel: e.target.value as 'Rendah' | 'Sedang' | 'Tinggi' })} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                    <option value="Rendah">Rendah</option>
                    <option value="Sedang">Sedang</option>
                    <option value="Tinggi">Tinggi</option>
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Faktor Risiko &amp; Komplikasi</label>
                  <input value={pregForm.riskFactors} onChange={(e) => setPregForm({ ...pregForm, riskFactors: e.target.value })} placeholder="Riwayat SC, hipertensi, anemia, dll." className="w-full h-9 px-3 rounded-lg border border-slate-300" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Jadwal Kontrol ANC Berikutnya</label>
                  <input type="date" value={pregForm.nextAncDate} onChange={(e) => setPregForm({ ...pregForm, nextAncDate: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono" />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPregModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">Simpan Kehamilan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add ANC Visit Modal */}
      {ancModalOpen && activePregnancy && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Catat Kunjungan ANC — {activePregnancy.patientName}</h3>
              <button type="button" onClick={() => setAncModalOpen(false)} aria-label="Tutup modal ANC"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveAnc} className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div><label className="block text-slate-600 mb-1">Tanggal</label><input type="date" value={ancForm.visitDate} onChange={(e) => setAncForm({ ...ancForm, visitDate: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                <div><label className="block text-slate-600 mb-1">UK (minggu)</label><input type="number" value={ancForm.gestationalAgeWeeks} onChange={(e) => setAncForm({ ...ancForm, gestationalAgeWeeks: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                <div><label className="block text-slate-600 mb-1">BB Ibu (kg)</label><input type="number" step="0.1" value={ancForm.weightKg} onChange={(e) => setAncForm({ ...ancForm, weightKg: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                <div><label className="block text-slate-600 mb-1">Tekanan Darah</label><input value={ancForm.bloodPressure} onChange={(e) => setAncForm({ ...ancForm, bloodPressure: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                <div><label className="block text-slate-600 mb-1">TFU (cm)</label><input type="number" step="0.5" value={ancForm.fundalHeightCm} onChange={(e) => setAncForm({ ...ancForm, fundalHeightCm: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                <div><label className="block text-slate-600 mb-1">DJJ (dpm)</label><input type="number" value={ancForm.fetalHeartRate} onChange={(e) => setAncForm({ ...ancForm, fetalHeartRate: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
              </div>
              <div><label className="block text-slate-600 mb-1">Diagnosis</label><input value={ancForm.diagnosis} onChange={(e) => setAncForm({ ...ancForm, diagnosis: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300" /></div>
              <div><label className="block text-slate-600 mb-1">Terapi &amp; Suplemen</label><input value={ancForm.therapy} onChange={(e) => setAncForm({ ...ancForm, therapy: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300" /></div>
              <div><label className="block text-slate-600 mb-1">Kontrol Berikutnya</label><input type="date" value={ancForm.nextControlDate} onChange={(e) => setAncForm({ ...ancForm, nextControlDate: e.target.value })} className="w-full h-9 px-3 rounded-lg border border-slate-300 font-mono" /></div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setAncModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">Simpan Kunjungan ANC</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
