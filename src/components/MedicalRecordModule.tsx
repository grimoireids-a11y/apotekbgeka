import React, { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  FileCheck2,
  History,
  Lock,
  Plus,
  Printer,
  Save,
  ShieldAlert,
  Trash2
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { DiagnosisEntry, Invoice, MedicalRecord, MedicalRecordVersion } from '../types/models';
import {
  calculateBmi,
  calculateGestationalAge,
  calculateHplFromHpht,
  formatAutoNumber
} from '../utils/obstetrics';
import { computeElectronicSignatureHash } from '../utils/cryptoE2EE';
import { canEditMedicalRecord } from '../utils/rbac';

type RmeSection = 'anamnesis' | 'fisik' | 'obstetri' | 'ginekologi' | 'diagnosis' | 'rencana';

export const MedicalRecordModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    practice,
    selectedPatientId,
    selectedVisitId,
    setSelectedPatientId,
    setSelectedVisitId,
    upsertRecord,
    pushNotification,
    notifyToast,
    setPrintPayload
  } = usePractice();

  const [section, setSection] = useState<RmeSection>(
    activeView === 'obstetric' ? 'obstetri' : activeView === 'gynecology' ? 'ginekologi' : 'anamnesis'
  );
  const [selectedIcd, setSelectedIcd] = useState('');
  const [diagType, setDiagType] = useState<'Utama' | 'Sekunder' | 'Banding'>('Utama');
  const [changeReason, setChangeReason] = useState('');
  const [showVersions, setShowVersions] = useState(false);

  useEffect(() => {
    if (activeView === 'obstetric') setSection('obstetri');
    else if (activeView === 'gynecology') setSection('ginekologi');
  }, [activeView]);

  const activeVisit = useMemo(() => {
    if (selectedVisitId) {
      const found = dbState.visits.find((v) => v.id === selectedVisitId);
      if (found) return found;
    }
    return dbState.visits[0] || null;
  }, [dbState.visits, selectedVisitId]);

  const activePatient = useMemo(() => {
    const pid = activeVisit?.patientId || selectedPatientId;
    return dbState.patients.find((p) => p.id === pid) || null;
  }, [dbState.patients, activeVisit, selectedPatientId]);

  const existingRecord = useMemo(
    () => (activeVisit ? dbState.medical_records.find((r) => r.visitId === activeVisit.id) || null : null),
    [dbState.medical_records, activeVisit]
  );

  const buildInitialForm = (): Omit<MedicalRecord, 'createdAt' | 'createdBy' | 'updatedAt' | 'updatedBy'> => {
    if (existingRecord) return existingRecord;
    const initV = activeVisit?.initialVitals;
    const w = initV?.weightKg || 60;
    const h = initV?.heightCm || 160;
    const bmiCalc = calculateBmi(w, h);
    return {
      id: activeVisit ? `rme-${activeVisit.id}` : `rme-${Date.now()}`,
      visitId: activeVisit?.id || '',
      patientId: activePatient?.id || '',
      patientName: activePatient?.fullName || '',
      patientRm: activePatient?.rmNumber || '',
      doctorId: currentUser?.id || 'usr-dokter',
      doctorName: currentUser?.displayName || `${practice.doctorName}, ${practice.doctorTitle}`,
      visitDate: activeVisit?.visitDate || new Date().toISOString().slice(0, 10),
      anamnesis: {
        chiefComplaint: activeVisit?.initialComplaint || '',
        presentIllness: '',
        pastMedicalHistory: activePatient?.medicalHistory || '',
        familyHistory: '',
        allergyHistory: activePatient?.allergies || 'Tidak ada',
        medicationHistory: activePatient?.medicationHistory || '',
        menstrualHistory: '',
        maritalHistory: activePatient?.maritalStatus || '',
        contraceptionHistory: ''
      },
      physicalExam: {
        bloodPressure: initV?.bloodPressure || '120/80',
        heartRate: initV?.heartRate || 80,
        temperature: initV?.temperature || 36.6,
        respiratoryRate: initV?.respiratoryRate || 18,
        weightKg: w,
        heightCm: h,
        bmi: bmiCalc.bmi,
        bmiCategory: bmiCalc.category,
        generalNotes: 'Kesadaran compos mentis, keadaan umum baik'
      },
      obstetricExam: {
        gravida: 1,
        para: 0,
        abortus: 0,
        hpht: '',
        gestationalAgeWeeks: 0,
        gestationalAgeDays: 0,
        hpl: '',
        fundalHeightCm: 0,
        fetalHeartRate: 140,
        fetalPresentation: 'Kepala',
        fetalMovement: 'Aktif',
        maternalCondition: 'Baik',
        pregnancyNotes: ''
      },
      gynecologyExam: {
        complaint: '',
        externalGenitalia: 'Dalam batas normal',
        speculumExam: '',
        bimanualExam: '',
        supportingExam: '',
        clinicalNotes: ''
      },
      diagnoses: [],
      doctorNotes: '',
      plan: {
        therapy: '',
        prescriptionSummary: '',
        followUpExam: '',
        counseling: '',
        nextControlDate: '',
        referralNotes: '',
        patientEducation: ''
      },
      status: 'draft',
      version: 1
    };
  };

  const [form, setForm] = useState(buildInitialForm);

  useEffect(() => {
    setForm(buildInitialForm());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeVisit?.id, existingRecord?.id, existingRecord?.version]);

  const isReadOnly = !currentUser || !canEditMedicalRecord(currentUser.role, form.status);

  const handleHphtChange = (hpht: string) => {
    const hpl = calculateHplFromHpht(hpht);
    const ga = calculateGestationalAge(hpht, form.visitDate);
    setForm((prev) => ({
      ...prev,
      obstetricExam: {
        ...(prev.obstetricExam || {
          gravida: 1,
          para: 0,
          abortus: 0,
          hpht: '',
          gestationalAgeWeeks: 0,
          gestationalAgeDays: 0,
          hpl: ''
        }),
        hpht,
        hpl,
        gestationalAgeWeeks: ga.weeks,
        gestationalAgeDays: ga.days
      }
    }));
  };

  const handleWeightHeightChange = (weightKg: number, heightCm: number) => {
    const res = calculateBmi(weightKg, heightCm);
    setForm((prev) => ({
      ...prev,
      physicalExam: {
        ...prev.physicalExam,
        weightKg,
        heightCm,
        bmi: res.bmi,
        bmiCategory: res.category
      }
    }));
  };

  const addDiagnosis = () => {
    if (!selectedIcd) return;
    const found = dbState.icd10_codes.find((c) => c.code === selectedIcd);
    if (!found) return;
    if (form.diagnoses.some((d) => d.icd10Code === found.code)) return;
    const entry: DiagnosisEntry = {
      icd10Code: found.code,
      description: found.name,
      type: diagType
    };
    setForm((prev) => ({ ...prev, diagnoses: [...prev.diagnoses, entry] }));
    setSelectedIcd('');
  };

  const removeDiagnosis = (code: string) => {
    setForm((prev) => ({ ...prev, diagnoses: prev.diagnoses.filter((d) => d.icd10Code !== code) }));
  };

  const ensureInvoiceForVisit = async () => {
    if (!activeVisit || !activePatient) return;
    const existingInv = dbState.invoices.find((i) => i.visitId === activeVisit.id);
    if (existingInv) return;

    const consultService =
      dbState.services.find((s) => s.category === 'Konsultasi' && s.active) || dbState.services[0];
    const adminService = dbState.services.find((s) => s.category === 'Administrasi' && s.active);
    const items = [
      {
        id: `it-c-${Date.now()}`,
        category: 'Konsultasi' as const,
        description: consultService?.name || 'Konsultasi Dokter Spesialis Sp.OG',
        qty: 1,
        unitPrice: consultService?.price || 250000,
        total: consultService?.price || 250000
      },
      ...(adminService
        ? [
            {
              id: `it-a-${Date.now()}`,
              category: 'Administrasi' as const,
              description: adminService.name,
              qty: 1,
              unitPrice: adminService.price,
              total: adminService.price
            }
          ]
        : [])
    ];
    const subtotal = items.reduce((s, x) => s + x.total, 0);
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const inv: Invoice = {
      id: `inv-${activeVisit.id}`,
      invoiceNumber: formatAutoNumber(practice.invoiceFormat || 'INV', dbState.invoices.length + 1, today),
      visitId: activeVisit.id,
      patientId: activePatient.id,
      patientName: activePatient.fullName,
      patientRm: activePatient.rmNumber,
      items,
      subtotal,
      discount: 0,
      tax: 0,
      total: subtotal,
      paidAmount: 0,
      remainingAmount: subtotal,
      status: 'Belum Dibayar',
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };
    await upsertRecord('invoices', inv);
  };

  const saveRme = async (targetStatus: 'draft' | 'locked') => {
    if (!activeVisit || !activePatient || !currentUser) {
      notifyToast('Pilih kunjungan pasien terlebih dahulu.', 'error');
      return;
    }
    if (isReadOnly) {
      notifyToast('Anda tidak memiliki kewenangan mengubah rekam medis ini.', 'error');
      return;
    }
    if (targetStatus === 'locked' && form.diagnoses.length === 0) {
      notifyToast('Minimal 1 diagnosis ICD-10 wajib diisi sebelum mengesahkan & mengunci RME.', 'error');
      return;
    }

    const nowIso = new Date().toISOString();
    const nextVersion = existingRecord ? existingRecord.version + 1 : 1;
    let signatureHash = form.signatureHash;
    let signedAt = form.signedAt;
    let signedBy = form.signedBy;

    if (targetStatus === 'locked') {
      signedAt = nowIso;
      signedBy = currentUser.displayName;
      signatureHash = await computeElectronicSignatureHash({
        recordId: form.id,
        patientId: activePatient.id,
        doctorId: currentUser.id,
        signedAt,
        summary: form.diagnoses.map((d) => d.icd10Code).join(',')
      });
    }

    const saved: MedicalRecord = {
      ...form,
      visitId: activeVisit.id,
      patientId: activePatient.id,
      patientName: activePatient.fullName,
      patientRm: activePatient.rmNumber,
      status: targetStatus,
      signedAt,
      signedBy,
      signatureHash,
      version: nextVersion,
      createdAt: existingRecord?.createdAt || nowIso,
      createdBy: existingRecord?.createdBy || currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };

    await upsertRecord('medical_records', saved);

    // Append immutable version audit entry
    const ver: MedicalRecordVersion = {
      id: `rmev-${saved.id}-v${nextVersion}-${Date.now()}`,
      medicalRecordId: saved.id,
      patientId: saved.patientId,
      version: nextVersion,
      changeReason:
        changeReason.trim() ||
        (targetStatus === 'locked' ? 'Pengesahan & penguncian rekam medis oleh dokter' : 'Penyimpanan draft RME'),
      changedByName: currentUser.displayName,
      snapshotSummary: `Keluhan: ${saved.anamnesis.chiefComplaint || '-'} | Diagnosis: ${saved.diagnoses.map((d) => d.icd10Code).join(', ') || '-'}`,
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('medical_record_versions', ver);

    // Sync individual diagnosis records for reporting
    for (const d of saved.diagnoses) {
      await upsertRecord('diagnoses', {
        id: `diag-${saved.id}-${d.icd10Code.replace('.', '-')}`,
        medicalRecordId: saved.id,
        visitId: activeVisit.id,
        patientId: activePatient.id,
        icd10Code: d.icd10Code,
        description: d.description,
        type: d.type,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      });
    }

    if (targetStatus === 'locked') {
      // Move visit to Menunggu Pembayaran & ensure invoice exists
      await upsertRecord('visits', { ...activeVisit, status: 'Menunggu Pembayaran', updatedAt: nowIso });
      const q = dbState.queues.find((x) => x.visitId === activeVisit.id);
      if (q) {
        await upsertRecord('queues', { ...q, status: 'Menunggu Pembayaran', updatedAt: nowIso });
      }
      await ensureInvoiceForVisit();
      await pushNotification({
        category: 'Pembayaran',
        title: `Tagihan Siap Diverifikasi (${activePatient.fullName})`,
        message: `Pemeriksaan dokter selesai & RME terkunci. Tagihan otomatis dibuat untuk kasir.`,
        severity: 'info',
        targetRoles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'],
        linkView: 'cashier'
      });
    }

    setChangeReason('');
    notifyToast(
      targetStatus === 'locked'
        ? `RME disahkan dengan Tanda Tangan Elektronik (${signatureHash?.slice(0, 12)}) & dikunci.`
        : `Draft RME versi v${nextVersion} disimpan.`,
      'success'
    );
  };

  const versions = useMemo(
    () => dbState.medical_record_versions.filter((v) => v.medicalRecordId === form.id),
    [dbState.medical_record_versions, form.id]
  );

  const handlePrintRme = () => {
    if (!activePatient) return;
    const summaryLines = [
      `Tanggal Kunjungan: ${form.visitDate}`,
      `Keluhan Utama: ${form.anamnesis.chiefComplaint || '-'}`,
      `Riwayat Penyakit Sekarang: ${form.anamnesis.presentIllness || '-'}`,
      `Alergi: ${form.anamnesis.allergyHistory || '-'}`,
      '',
      `PEMERIKSAAN FISIK:`,
      `TD: ${form.physicalExam.bloodPressure} mmHg | Nadi: ${form.physicalExam.heartRate} x/mnt | Suhu: ${form.physicalExam.temperature} °C | RR: ${form.physicalExam.respiratoryRate} x/mnt`,
      `BB: ${form.physicalExam.weightKg} kg | TB: ${form.physicalExam.heightCm} cm | IMT: ${form.physicalExam.bmi} (${form.physicalExam.bmiCategory || '-'})`,
      '',
      form.obstetricExam?.hpht
        ? `PEMERIKSAAN OBSTETRI: G${form.obstetricExam.gravida}P${form.obstetricExam.para}A${form.obstetricExam.abortus} | HPHT ${form.obstetricExam.hpht} | HPL ${form.obstetricExam.hpl} | UK ${form.obstetricExam.gestationalAgeWeeks} mgg ${form.obstetricExam.gestationalAgeDays} hr | TFU ${form.obstetricExam.fundalHeightCm || '-'} cm | DJJ ${form.obstetricExam.fetalHeartRate || '-'} dpm | Presentasi ${form.obstetricExam.fetalPresentation || '-'}`
        : '',
      form.gynecologyExam?.complaint
        ? `PEMERIKSAAN GINEKOLOGI: ${form.gynecologyExam.complaint} | Inspekulo: ${form.gynecologyExam.speculumExam || '-'} | Bimanual: ${form.gynecologyExam.bimanualExam || '-'}`
        : '',
      '',
      `DIAGNOSIS (ICD-10):`,
      ...form.diagnoses.map((d) => `- [${d.type}] ${d.icd10Code} — ${d.description}`),
      '',
      `RENCANA & TERAPI:`,
      `Terapi: ${form.plan.therapy || '-'}`,
      `Edukasi: ${form.plan.patientEducation || '-'}`,
      `Jadwal Kontrol: ${form.plan.nextControlDate || '-'}`,
      `Catatan Dokter: ${form.doctorNotes || '-'}`,
      form.signatureHash ? `\nTanda Tangan Elektronik Sah: ${form.signatureHash} (${form.signedBy} · ${form.signedAt})` : ''
    ]
      .filter(Boolean)
      .join('\n');

    setPrintPayload({
      type: 'rme',
      title: 'RINGKASAN REKAM MEDIS ELEKTRONIK',
      subtitle: activeVisit?.visitNumber || form.id,
      data: {
        patientName: activePatient.fullName,
        patientRm: activePatient.rmNumber,
        content: summaryLines,
        signedBy: form.signedBy || form.doctorName
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">
            {activeView === 'obstetric'
              ? 'Pemeriksaan Obstetri'
              : activeView === 'gynecology'
              ? 'Pemeriksaan Ginekologi'
              : 'Rekam Medis Elektronik (RME)'}
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Dokumentasi medis terstandar Permenkes No. 24/2022 dengan pengesahan tanda tangan elektronik &amp; penguncian catatan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih kunjungan pasien"
            value={activeVisit?.id || ''}
            onChange={(e) => {
              const v = dbState.visits.find((x) => x.id === e.target.value);
              setSelectedVisitId(e.target.value || null);
              if (v) setSelectedPatientId(v.patientId);
            }}
            className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-medium min-w-[260px]"
          >
            {dbState.visits.length === 0 && <option value="">Belum ada kunjungan</option>}
            {dbState.visits.map((v) => (
              <option key={v.id} value={v.id}>
                {v.visitDate} · {v.queueNumber} · {v.patientName} ({v.patientRm})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={() => setShowVersions((s) => !s)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <History className="w-3.5 h-3.5" />
            Riwayat Versi ({versions.length})
          </button>

          <button
            type="button"
            onClick={handlePrintRme}
            disabled={!activePatient}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak RME
          </button>
        </div>
      </div>

      {/* Role Restriction Notice for Assistant */}
      {currentUser?.role === 'ASISTEN_DOKTER' && (
        <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0" />
          <span>
            Mode Baca Saja (Pemisahan Kewenangan Medis): Asisten Dokter dapat melihat riwayat RME untuk administrasi, namun tidak dapat mengubah diagnosis, mengisi pemeriksaan medis dokter, atau mengesahkan RME.
          </span>
        </div>
      )}

      {/* Locked Record Banner */}
      {form.status === 'locked' && (
        <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>
              <strong>Rekam Medis Disahkan &amp; Terkunci</strong> oleh {form.signedBy} · Hash TTE:{' '}
              <span className="font-mono">{form.signatureHash}</span>
            </span>
          </div>
          <span className="font-mono text-emerald-800">Versi v{form.version}</span>
        </div>
      )}

      {!activeVisit || !activePatient ? (
        <div className="bg-white border border-slate-200 rounded-xl p-12 text-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-slate-300 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">Belum Ada Kunjungan Dipilih</p>
          <p className="text-xs text-slate-500">
            Buat pendaftaran kunjungan pada menu Antrean atau Kunjungan untuk mulai mengisi Rekam Medis Elektronik.
          </p>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          {/* Patient Context Strip */}
          <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-bold text-slate-900">{activePatient.fullName}</span>
              <span className="text-slate-300">·</span>
              <span className="font-mono text-teal-800 font-semibold">{activePatient.rmNumber}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">{activeVisit.visitType}</span>
              <span className="text-slate-300">·</span>
              <span className="text-slate-600">Gol. Darah {activePatient.bloodType}</span>
            </div>
            {activePatient.allergies.toLowerCase() !== 'tidak ada' && (
              <span className="font-semibold text-red-700">Alergi: {activePatient.allergies}</span>
            )}
          </div>

          {/* 6-Tab RME Navigation */}
          <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
            {(
              [
                ['anamnesis', 'A. Anamnesis'],
                ['fisik', 'B. Pemeriksaan Fisik'],
                ['obstetri', 'C. Obstetri'],
                ['ginekologi', 'D. Ginekologi'],
                ['diagnosis', 'E. Diagnosis (ICD-10)'],
                ['rencana', 'F. Rencana & Tindak Lanjut']
              ] as const
            ).map(([k, label]) => (
              <button
                key={k}
                type="button"
                onClick={() => setSection(k)}
                className={`px-3.5 py-2.5 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                  section === k
                    ? 'border-teal-700 text-teal-800'
                    : 'border-transparent text-slate-500 hover:text-slate-900'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Section Body */}
          <div className="p-6 space-y-5">
            {section === 'anamnesis' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Keluhan Utama</label>
                  <input
                    disabled={isReadOnly}
                    value={form.anamnesis.chiefComplaint}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, chiefComplaint: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Penyakit Sekarang (RPS)</label>
                  <textarea
                    rows={3}
                    disabled={isReadOnly}
                    value={form.anamnesis.presentIllness}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, presentIllness: e.target.value } })
                    }
                    className="w-full p-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Penyakit Dahulu (RPD)</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.anamnesis.pastMedicalHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, pastMedicalHistory: e.target.value } })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Penyakit Keluarga</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.anamnesis.familyHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, familyHistory: e.target.value } })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Alergi</label>
                  <input
                    disabled={isReadOnly}
                    value={form.anamnesis.allergyHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, allergyHistory: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Pengobatan</label>
                  <input
                    disabled={isReadOnly}
                    value={form.anamnesis.medicationHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, medicationHistory: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Menstruasi</label>
                  <input
                    disabled={isReadOnly}
                    value={form.anamnesis.menstrualHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, menstrualHistory: e.target.value } })
                    }
                    placeholder="Menarche, siklus, lama haid, dismenorea"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Riwayat Perkawinan &amp; Kontrasepsi</label>
                  <input
                    disabled={isReadOnly}
                    value={form.anamnesis.contraceptionHistory}
                    onChange={(e) =>
                      setForm({ ...form, anamnesis: { ...form.anamnesis, contraceptionHistory: e.target.value } })
                    }
                    placeholder="Lama menikah, metode KB sebelumnya"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {section === 'fisik' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tekanan Darah (mmHg)</label>
                  <input
                    disabled={isReadOnly}
                    value={form.physicalExam.bloodPressure}
                    onChange={(e) =>
                      setForm({ ...form, physicalExam: { ...form.physicalExam, bloodPressure: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Denyut Nadi (x/mnt)</label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={form.physicalExam.heartRate}
                    onChange={(e) =>
                      setForm({ ...form, physicalExam: { ...form.physicalExam, heartRate: Number(e.target.value) } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Suhu Tubuh (°C)</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={isReadOnly}
                    value={form.physicalExam.temperature}
                    onChange={(e) =>
                      setForm({ ...form, physicalExam: { ...form.physicalExam, temperature: Number(e.target.value) } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Frekuensi Napas (x/mnt)</label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={form.physicalExam.respiratoryRate}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        physicalExam: { ...form.physicalExam, respiratoryRate: Number(e.target.value) }
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Berat Badan (kg)</label>
                  <input
                    type="number"
                    step="0.1"
                    disabled={isReadOnly}
                    value={form.physicalExam.weightKg}
                    onChange={(e) => handleWeightHeightChange(Number(e.target.value), form.physicalExam.heightCm)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tinggi Badan (cm)</label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={form.physicalExam.heightCm}
                    onChange={(e) => handleWeightHeightChange(form.physicalExam.weightKg, Number(e.target.value))}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div className="col-span-2 p-3 rounded-lg bg-teal-50/60 border border-teal-200 flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-teal-800">Indeks Massa Tubuh (IMT Otomatis)</p>
                    <p className="text-lg font-bold font-mono tabular-nums text-teal-950">{form.physicalExam.bmi}</p>
                  </div>
                  <span className="font-semibold text-teal-800">{form.physicalExam.bmiCategory || '-'}</span>
                </div>
                <div className="col-span-2 sm:col-span-4">
                  <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Fisik Umum</label>
                  <textarea
                    rows={3}
                    disabled={isReadOnly}
                    value={form.physicalExam.generalNotes || ''}
                    onChange={(e) =>
                      setForm({ ...form, physicalExam: { ...form.physicalExam, generalNotes: e.target.value } })
                    }
                    className="w-full p-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {section === 'obstetri' && form.obstetricExam && (
              <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gravida (G)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={isReadOnly}
                    value={form.obstetricExam.gravida}
                    onChange={(e) =>
                      setForm({ ...form, obstetricExam: { ...form.obstetricExam!, gravida: Number(e.target.value) } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Para (P)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={isReadOnly}
                    value={form.obstetricExam.para}
                    onChange={(e) =>
                      setForm({ ...form, obstetricExam: { ...form.obstetricExam!, para: Number(e.target.value) } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Abortus (A)</label>
                  <input
                    type="number"
                    min={0}
                    disabled={isReadOnly}
                    value={form.obstetricExam.abortus}
                    onChange={(e) =>
                      setForm({ ...form, obstetricExam: { ...form.obstetricExam!, abortus: Number(e.target.value) } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">HPHT (Hitung HPL &amp; UK Otomatis)</label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={form.obstetricExam.hpht}
                    onChange={(e) => handleHphtChange(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-200">
                  <p className="text-[11px] text-teal-800">Usia Kehamilan (Konfirmasi Dokter)</p>
                  <p className="text-sm font-bold font-mono text-teal-950 mt-0.5">
                    {form.obstetricExam.gestationalAgeWeeks} mgg {form.obstetricExam.gestationalAgeDays} hr
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-teal-50/60 border border-teal-200">
                  <p className="text-[11px] text-teal-800">Taksiran Persalinan (HPL)</p>
                  <p className="text-sm font-bold font-mono text-teal-950 mt-0.5">
                    {form.obstetricExam.hpl || '-'}
                  </p>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Tinggi Fundus Uteri (cm)</label>
                  <input
                    type="number"
                    step="0.5"
                    disabled={isReadOnly}
                    value={form.obstetricExam.fundalHeightCm || 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        obstetricExam: { ...form.obstetricExam!, fundalHeightCm: Number(e.target.value) }
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Denyut Jantung Janin (dpm)</label>
                  <input
                    type="number"
                    disabled={isReadOnly}
                    value={form.obstetricExam.fetalHeartRate || 0}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        obstetricExam: { ...form.obstetricExam!, fetalHeartRate: Number(e.target.value) }
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Presentasi Janin</label>
                  <select
                    disabled={isReadOnly}
                    value={form.obstetricExam.fetalPresentation || 'Kepala'}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        obstetricExam: { ...form.obstetricExam!, fetalPresentation: e.target.value }
                      })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white disabled:bg-slate-50"
                  >
                    {['Kepala', 'Sungsang', 'Lintang', 'Ballotement / Belum Teraba'].map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Gerakan Janin</label>
                  <input
                    disabled={isReadOnly}
                    value={form.obstetricExam.fetalMovement || ''}
                    onChange={(e) =>
                      setForm({ ...form, obstetricExam: { ...form.obstetricExam!, fetalMovement: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Kondisi Ibu &amp; Catatan Perkembangan</label>
                  <input
                    disabled={isReadOnly}
                    value={form.obstetricExam.pregnancyNotes || ''}
                    onChange={(e) =>
                      setForm({ ...form, obstetricExam: { ...form.obstetricExam!, pregnancyNotes: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {section === 'ginekologi' && form.gynecologyExam && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Keluhan Ginekologi</label>
                  <input
                    disabled={isReadOnly}
                    value={form.gynecologyExam.complaint}
                    onChange={(e) =>
                      setForm({ ...form, gynecologyExam: { ...form.gynecologyExam!, complaint: e.target.value } })
                    }
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Genitalia Eksterna</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.gynecologyExam.externalGenitalia}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        gynecologyExam: { ...form.gynecologyExam!, externalGenitalia: e.target.value }
                      })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Inspekulo</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.gynecologyExam.speculumExam}
                    onChange={(e) =>
                      setForm({ ...form, gynecologyExam: { ...form.gynecologyExam!, speculumExam: e.target.value } })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Bimanual</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.gynecologyExam.bimanualExam}
                    onChange={(e) =>
                      setForm({ ...form, gynecologyExam: { ...form.gynecologyExam!, bimanualExam: e.target.value } })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Hasil Penunjang &amp; Catatan Klinis</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.gynecologyExam.clinicalNotes}
                    onChange={(e) =>
                      setForm({ ...form, gynecologyExam: { ...form.gynecologyExam!, clinicalNotes: e.target.value } })
                    }
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {section === 'diagnosis' && (
              <div className="space-y-4 text-xs">
                {!isReadOnly && (
                  <div className="flex flex-col sm:flex-row gap-2">
                    <select
                      aria-label="Pilih kode ICD-10"
                      value={selectedIcd}
                      onChange={(e) => setSelectedIcd(e.target.value)}
                      className="flex-1 h-10 px-3 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="">-- Pilih Kode Diagnosis ICD-10 --</option>
                      {dbState.icd10_codes
                        .filter((c) => c.active)
                        .map((c) => (
                          <option key={c.id} value={c.code}>
                            {c.code} — {c.name} ({c.category})
                          </option>
                        ))}
                    </select>
                    <select
                      aria-label="Jenis diagnosis"
                      value={diagType}
                      onChange={(e) => setDiagType(e.target.value as 'Utama' | 'Sekunder' | 'Banding')}
                      className="h-10 px-3 rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="Utama">Diagnosis Utama</option>
                      <option value="Sekunder">Diagnosis Sekunder</option>
                      <option value="Banding">Diagnosis Banding</option>
                    </select>
                    <button
                      type="button"
                      onClick={addDiagnosis}
                      className="inline-flex items-center justify-center gap-1.5 px-4 h-10 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 whitespace-nowrap"
                    >
                      <Plus className="w-4 h-4" />
                      Tambah
                    </button>
                  </div>
                )}

                <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg">
                  {form.diagnoses.map((d) => (
                    <div key={d.icd10Code} className="px-4 py-3 flex items-center justify-between gap-3">
                      <div>
                        <span className="font-mono font-bold text-teal-800">{d.icd10Code}</span>{' '}
                        <span className="font-semibold text-slate-900">— {d.description}</span>
                        <span className="ml-2 text-slate-500">({d.type})</span>
                      </div>
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => removeDiagnosis(d.icd10Code)}
                          aria-label={`Hapus diagnosis ${d.icd10Code}`}
                          className="p-1.5 text-slate-400 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ))}
                  {form.diagnoses.length === 0 && (
                    <p className="p-6 text-center text-slate-400">Belum ada diagnosis ICD-10 dipilih.</p>
                  )}
                </div>

                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Catatan Medis Dokter (Terenkripsi E2EE)
                  </label>
                  <textarea
                    rows={3}
                    disabled={isReadOnly}
                    value={form.doctorNotes}
                    onChange={(e) => setForm({ ...form, doctorNotes: e.target.value })}
                    className="w-full p-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {section === 'rencana' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="md:col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Rencana Terapi &amp; Resep</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.plan.therapy}
                    onChange={(e) => setForm({ ...form, plan: { ...form.plan, therapy: e.target.value } })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Pemeriksaan Lanjutan</label>
                  <input
                    disabled={isReadOnly}
                    value={form.plan.followUpExam}
                    onChange={(e) => setForm({ ...form, plan: { ...form.plan, followUpExam: e.target.value } })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Jadwal Kontrol Berikutnya</label>
                  <input
                    type="date"
                    disabled={isReadOnly}
                    value={form.plan.nextControlDate}
                    onChange={(e) => setForm({ ...form, plan: { ...form.plan, nextControlDate: e.target.value } })}
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 font-mono disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Konseling &amp; Edukasi Pasien</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.plan.patientEducation}
                    onChange={(e) => setForm({ ...form, plan: { ...form.plan, patientEducation: e.target.value } })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Catatan Rujukan (Jika Ada)</label>
                  <textarea
                    rows={2}
                    disabled={isReadOnly}
                    value={form.plan.referralNotes}
                    onChange={(e) => setForm({ ...form, plan: { ...form.plan, referralNotes: e.target.value } })}
                    className="w-full p-2.5 rounded-lg border border-slate-300 disabled:bg-slate-50"
                  />
                </div>
              </div>
            )}

            {/* Footer Action Bar */}
            {!isReadOnly && (
              <div className="pt-4 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <input
                  value={changeReason}
                  onChange={(e) => setChangeReason(e.target.value)}
                  placeholder="Alasan perubahan / catatan revisi untuk audit versi (opsional)..."
                  className="flex-1 h-10 px-3 rounded-lg border border-slate-300 text-xs"
                />
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void saveRme('draft')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-800 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap"
                  >
                    <Save className="w-4 h-4" />
                    Simpan Draft
                  </button>
                  <button
                    type="button"
                    onClick={() => void saveRme('locked')}
                    className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Sahkan TTE &amp; Kunci RME
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Version History Panel */}
      {showVersions && (
        <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-3">
          <h2 className="text-sm font-bold text-slate-900">Riwayat Perubahan Rekam Medis (Audit Versi)</h2>
          <div className="divide-y divide-slate-100 text-xs">
            {versions.map((v) => (
              <div key={v.id} className="py-2.5 flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-slate-900">
                    Versi v{v.version} — {v.changedByName}
                  </p>
                  <p className="text-slate-600 mt-0.5">{v.changeReason}</p>
                  <p className="text-slate-400 mt-0.5">{v.snapshotSummary}</p>
                </div>
                <span className="font-mono text-slate-400 shrink-0">{v.createdAt.slice(0, 19).replace('T', ' ')}</span>
              </div>
            ))}
            {versions.length === 0 && (
              <p className="py-4 text-slate-400 text-center">Belum ada riwayat perubahan tersimpan.</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
