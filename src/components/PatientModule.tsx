import React, { useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  CalendarPlus,
  ChevronRight,
  CreditCard,
  Edit3,
  Eye,
  FileUp,
  Search,
  Stethoscope,
  Trash2,
  UserPlus,
  X
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { Patient, QueueEntry, QueueStatus, Visit, VisitType } from '../types/models';
import {
  calculateAgeYears,
  calculateBmi,
  detectDuplicatePatient,
  formatAutoNumber,
  formatCurrencyIDR,
  formatQueueNumber
} from '../utils/obstetrics';

const VISIT_TYPES: VisitType[] = [
  'Pasien Baru',
  'Pasien Lama',
  'Konsultasi Obstetri',
  'Konsultasi Ginekologi',
  'Pemeriksaan Kehamilan',
  'Pemeriksaan USG',
  'Kontrol Ulang',
  'Konsultasi KB',
  'Pemeriksaan Lainnya'
];

const QUEUE_STEPS: QueueStatus[] = [
  'Terdaftar',
  'Menunggu',
  'Dipanggil',
  'Sedang Diperiksa',
  'Pemeriksaan Selesai',
  'Menunggu Pembayaran',
  'Selesai'
];

const EMPTY_PATIENT_FORM = {
  id: '',
  rmNumber: '',
  nik: '',
  fullName: '',
  birthPlace: '',
  birthDate: '',
  gender: 'Perempuan' as 'Perempuan' | 'Laki-laki',
  address: '',
  phone: '',
  email: '',
  occupation: '',
  maritalStatus: 'Menikah',
  spouseName: '',
  familyPhone: '',
  emergencyContact: '',
  bloodType: 'O+',
  allergies: 'Tidak ada',
  medicalHistory: '',
  surgicalHistory: '',
  medicationHistory: '',
  consentGiven: true
};

export const PatientModule: React.FC = () => {
  const {
    activeView,
    setActiveView,
    dbState,
    currentUser,
    practice,
    selectedPatientId,
    setSelectedPatientId,
    setSelectedVisitId,
    upsertRecord,
    deleteRecord,
    pushNotification,
    notifyToast,
    can
  } = usePractice();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Patient Registration / Edit state
  const [form, setForm] = useState(EMPTY_PATIENT_FORM);
  const [formError, setFormError] = useState('');
  const [editingPatient, setEditingPatient] = useState<Patient | null>(null);
  const [savingPatient, setSavingPatient] = useState(false);

  // Visit Registration Modal / Form state
  const [visitModalOpen, setVisitModalOpen] = useState(false);
  const [visitForm, setVisitForm] = useState({
    patientId: '',
    doctorId: '',
    visitType: 'Pemeriksaan Kehamilan' as VisitType,
    serviceCategory: 'Obstetri',
    initialComplaint: '',
    bloodPressure: '120/80',
    heartRate: 80,
    temperature: 36.6,
    respiratoryRate: 18,
    weightKg: 60,
    heightCm: 160
  });

  // Patient detail drawer tab
  const [detailTab, setDetailTab] = useState<'profil' | 'kunjungan' | 'rme' | 'kehamilan' | 'resep' | 'pembayaran' | 'dokumen'>('profil');
  const [queueFilterDate, setQueueFilterDate] = useState(new Date().toISOString().slice(0, 10));

  const doctors = useMemo(
    () => dbState.users.filter((u) => u.active && (u.role === 'DOKTER_SPOG' || u.role === 'SUPER_ADMIN')),
    [dbState.users]
  );

  const filteredPatients = useMemo(() => {
    const q = search.trim().toLowerCase();
    return dbState.patients.filter((p) => {
      if (!q) return true;
      return (
        p.fullName.toLowerCase().includes(q) ||
        p.rmNumber.toLowerCase().includes(q) ||
        (p.nik || '').toLowerCase().includes(q) ||
        (p.phone || '').toLowerCase().includes(q)
      );
    });
  }, [dbState.patients, search]);

  const totalPages = Math.max(1, Math.ceil(filteredPatients.length / pageSize));
  const pagedPatients = filteredPatients.slice((page - 1) * pageSize, page * pageSize);

  const duplicateWarning = useMemo(() => {
    if (!form.fullName.trim() && !form.nik.trim()) return null;
    return detectDuplicatePatient(
      { id: editingPatient?.id, nik: form.nik, fullName: form.fullName, birthDate: form.birthDate },
      dbState.patients
    );
  }, [form.nik, form.fullName, form.birthDate, editingPatient, dbState.patients]);

  const selectedPatient = useMemo(
    () => dbState.patients.find((p) => p.id === selectedPatientId) || null,
    [dbState.patients, selectedPatientId]
  );

  const nextRmNumber = useMemo(
    () => formatAutoNumber(practice.rmFormat || 'RM', dbState.patients.length + 1),
    [practice.rmFormat, dbState.patients.length]
  );

  const handleSavePatient = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.fullName.trim() || !form.birthDate || !form.phone.trim()) {
      setFormError('Nama lengkap, tanggal lahir, dan nomor telepon wajib diisi.');
      return;
    }
    if (!form.consentGiven) {
      setFormError('Persetujuan pemrosesan data pribadi kesehatan (UU PDP No. 27/2022) wajib dicentang.');
      return;
    }
    if (duplicateWarning && !editingPatient) {
      setFormError(`Deteksi pasien ganda: ${duplicateWarning.reason}. Periksa kembali sebelum mendaftarkan.`);
      return;
    }

    setSavingPatient(true);
    try {
      const nowIso = new Date().toISOString();
      const id = editingPatient?.id || `pat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const rmNumber = editingPatient?.rmNumber || nextRmNumber;

      const patientRecord: Patient = {
        id,
        rmNumber,
        nik: form.nik.trim(),
        fullName: form.fullName.trim(),
        birthPlace: form.birthPlace.trim(),
        birthDate: form.birthDate,
        gender: form.gender,
        address: form.address.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        occupation: form.occupation.trim(),
        maritalStatus: form.maritalStatus,
        spouseName: form.spouseName.trim(),
        familyPhone: form.familyPhone.trim(),
        emergencyContact: form.emergencyContact.trim(),
        bloodType: form.bloodType,
        allergies: form.allergies.trim() || 'Tidak ada',
        medicalHistory: form.medicalHistory.trim(),
        surgicalHistory: form.surgicalHistory.trim(),
        medicationHistory: form.medicationHistory.trim(),
        consentGiven: form.consentGiven,
        consentDate: editingPatient?.consentDate || nowIso.slice(0, 10),
        active: true,
        createdAt: editingPatient?.createdAt || nowIso,
        createdBy: editingPatient?.createdBy || currentUser!.id,
        updatedAt: nowIso,
        updatedBy: currentUser!.id
      };

      await upsertRecord('patients', patientRecord);

      if (!editingPatient) {
        await pushNotification({
          category: 'Pasien Baru',
          title: 'Pasien Baru Terdaftar',
          message: `${patientRecord.fullName} (${patientRecord.rmNumber}) terdaftar dan dienkripsi E2EE.`,
          severity: 'info',
          targetRoles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'],
          linkView: 'patients'
        });
      }

      notifyToast(
        editingPatient
          ? `Data pasien ${patientRecord.fullName} diperbarui.`
          : `Pasien ${patientRecord.fullName} berhasil didaftarkan (${patientRecord.rmNumber}).`,
        'success'
      );
      setForm(EMPTY_PATIENT_FORM);
      setEditingPatient(null);
      setSelectedPatientId(patientRecord.id);
      setActiveView('patients');
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Gagal menyimpan data pasien.');
    } finally {
      setSavingPatient(false);
    }
  };

  const openEditPatient = (p: Patient) => {
    setEditingPatient(p);
    setForm({
      id: p.id,
      rmNumber: p.rmNumber,
      nik: p.nik || '',
      fullName: p.fullName,
      birthPlace: p.birthPlace || '',
      birthDate: p.birthDate,
      gender: p.gender,
      address: p.address || '',
      phone: p.phone || '',
      email: p.email || '',
      occupation: p.occupation || '',
      maritalStatus: p.maritalStatus || 'Menikah',
      spouseName: p.spouseName || '',
      familyPhone: p.familyPhone || '',
      emergencyContact: p.emergencyContact || '',
      bloodType: p.bloodType || 'O+',
      allergies: p.allergies || 'Tidak ada',
      medicalHistory: p.medicalHistory || '',
      surgicalHistory: p.surgicalHistory || '',
      medicationHistory: p.medicationHistory || '',
      consentGiven: p.consentGiven ?? true
    });
    setActiveView('patient-register');
  };

  const handleCreateVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    const patient = dbState.patients.find((p) => p.id === visitForm.patientId);
    if (!patient) {
      notifyToast('Pilih pasien terlebih dahulu.', 'error');
      return;
    }
    const docUser = doctors.find((d) => d.id === visitForm.doctorId) || doctors[0];
    const today = new Date().toISOString().slice(0, 10);
    const nowIso = new Date().toISOString();
    const todayCount = dbState.visits.filter((v) => v.visitDate === today).length + 1;
    const visitId = `vis-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const queueNumber = formatQueueNumber(todayCount);
    const visitNumber = formatAutoNumber(practice.visitFormat || 'VIS', dbState.visits.length + 1, today);
    const bmiCalc = calculateBmi(visitForm.weightKg, visitForm.heightCm);

    const newVisit: Visit = {
      id: visitId,
      visitNumber,
      patientId: patient.id,
      patientName: patient.fullName,
      patientRm: patient.rmNumber,
      doctorId: docUser?.id || 'usr-dokter',
      doctorName: docUser?.displayName || `${practice.doctorName}, ${practice.doctorTitle}`,
      visitType: visitForm.visitType,
      serviceCategory: visitForm.serviceCategory,
      initialComplaint: visitForm.initialComplaint.trim() || 'Kontrol rutin',
      initialVitals: {
        bloodPressure: visitForm.bloodPressure,
        heartRate: Number(visitForm.heartRate) || 80,
        temperature: Number(visitForm.temperature) || 36.6,
        respiratoryRate: Number(visitForm.respiratoryRate) || 18,
        weightKg: Number(visitForm.weightKg) || 0,
        heightCm: Number(visitForm.heightCm) || 0,
        bmi: bmiCalc.bmi,
        bmiCategory: bmiCalc.category
      },
      status: 'Menunggu',
      paymentStatus: 'Belum Dibayar',
      queueNumber,
      visitDate: today,
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };

    const queueEntry: QueueEntry = {
      id: `q-${visitId}`,
      visitId,
      patientId: patient.id,
      patientName: patient.fullName,
      patientRm: patient.rmNumber,
      doctorId: newVisit.doctorId,
      doctorName: newVisit.doctorName,
      queueNumber,
      visitType: newVisit.visitType,
      status: 'Menunggu',
      queueDate: today,
      createdAt: nowIso,
      createdBy: currentUser!.id,
      updatedAt: nowIso,
      updatedBy: currentUser!.id
    };

    await upsertRecord('visits', newVisit);
    await upsertRecord('queues', queueEntry);
    await pushNotification({
      category: 'Antrean',
      title: `Antrean Baru ${queueNumber}`,
      message: `${patient.fullName} terdaftar untuk ${newVisit.visitType}.`,
      severity: 'info',
      targetRoles: ['SUPER_ADMIN', 'DOKTER_SPOG', 'ASISTEN_DOKTER'],
      linkView: 'queue'
    });

    notifyToast(`Kunjungan ${visitNumber} & nomor antrean ${queueNumber} berhasil dibuat.`, 'success');
    setVisitModalOpen(false);
    setActiveView('queue');
  };

  const updateVisitQueueStatus = async (visit: Visit, nextStatus: QueueStatus) => {
    const nowIso = new Date().toISOString();
    await upsertRecord('visits', { ...visit, status: nextStatus, updatedAt: nowIso });
    const q = dbState.queues.find((x) => x.visitId === visit.id);
    if (q) {
      await upsertRecord('queues', {
        ...q,
        status: nextStatus,
        calledAt: nextStatus === 'Dipanggil' ? nowIso : q.calledAt,
        updatedAt: nowIso
      });
    }
    notifyToast(`Status ${visit.patientName} (${visit.queueNumber}) diubah menjadi "${nextStatus}".`, 'info');
  };

  const handleUploadSupportDoc = async (patient: Patient, file: File | null) => {
    if (!file) return;
    if (file.size > 1500000) {
      notifyToast('Ukuran file maksimal 1.5 MB.', 'error');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const nowIso = new Date().toISOString();
      await upsertRecord('documents', {
        id: `doc-${Date.now()}`,
        patientId: patient.id,
        patientName: patient.fullName,
        patientRm: patient.rmNumber,
        docType: 'Dokumen Administrasi',
        title: file.name,
        content: `Dokumen pendukung diunggah pada ${nowIso.slice(0, 10)} (${Math.round(file.size / 1024)} KB).`,
        fileUrl: typeof reader.result === 'string' ? reader.result : undefined,
        createdAt: nowIso,
        createdBy: currentUser!.id,
        updatedAt: nowIso,
        updatedBy: currentUser!.id
      });
      notifyToast(`Dokumen "${file.name}" disimpan ke berkas pasien.`, 'success');
    };
    reader.readAsDataURL(file);
  };

  // ==================== VIEW 1: REGISTRASI PASIEN ====================
  if (activeView === 'patient-register') {
    return (
      <div className="max-w-4xl space-y-6">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">
              {editingPatient ? `Edit Data Pasien — ${editingPatient.rmNumber}` : 'Registrasi Pasien Baru'}
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Nomor RM otomatis: <span className="font-mono font-semibold text-teal-800">{editingPatient?.rmNumber || nextRmNumber}</span> · Field identitas sensitif dienkripsi E2EE (AES-256-GCM).
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setEditingPatient(null);
              setForm(EMPTY_PATIENT_FORM);
              setActiveView('patients');
            }}
            className="px-3.5 py-2 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Kembali ke Daftar
          </button>
        </div>

        {formError && (
          <div role="alert" className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
            {formError}
          </div>
        )}

        {duplicateWarning && !editingPatient && (
          <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Peringatan Deteksi Pasien Ganda</p>
              <p className="mt-0.5">{duplicateWarning.reason}</p>
            </div>
          </div>
        )}

        <form onSubmit={handleSavePatient} className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
          {/* Identitas Utama */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              1. Identitas Pribadi Pasien
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <label htmlFor="p-nik" className="block text-xs font-medium text-slate-700 mb-1">
                  NIK (16 Digit)
                </label>
                <input
                  id="p-nik"
                  value={form.nik}
                  onChange={(e) => setForm({ ...form, nik: e.target.value })}
                  placeholder="3174xxxxxxxxxxxx"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="p-name" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Lengkap *
                </label>
                <input
                  id="p-name"
                  required
                  value={form.fullName}
                  onChange={(e) => setForm({ ...form, fullName: e.target.value })}
                  placeholder="Nama lengkap sesuai KTP"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-bplace" className="block text-xs font-medium text-slate-700 mb-1">
                  Tempat Lahir
                </label>
                <input
                  id="p-bplace"
                  value={form.birthPlace}
                  onChange={(e) => setForm({ ...form, birthPlace: e.target.value })}
                  placeholder="Jakarta"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-bdate" className="block text-xs font-medium text-slate-700 mb-1">
                  Tanggal Lahir *
                </label>
                <input
                  id="p-bdate"
                  type="date"
                  required
                  value={form.birthDate}
                  onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-gender" className="block text-xs font-medium text-slate-700 mb-1">
                  Jenis Kelamin
                </label>
                <select
                  id="p-gender"
                  value={form.gender}
                  onChange={(e) => setForm({ ...form, gender: e.target.value as 'Perempuan' | 'Laki-laki' })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white focus:ring-2 focus:ring-teal-600 focus:outline-none"
                >
                  <option value="Perempuan">Perempuan</option>
                  <option value="Laki-laki">Laki-laki</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-phone" className="block text-xs font-medium text-slate-700 mb-1">
                  Nomor Telepon / WhatsApp *
                </label>
                <input
                  id="p-phone"
                  required
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0812xxxxxxxx"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-email" className="block text-xs font-medium text-slate-700 mb-1">
                  Email
                </label>
                <input
                  id="p-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="nama@email.com"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div>
                <label htmlFor="p-job" className="block text-xs font-medium text-slate-700 mb-1">
                  Pekerjaan
                </label>
                <input
                  id="p-job"
                  value={form.occupation}
                  onChange={(e) => setForm({ ...form, occupation: e.target.value })}
                  placeholder="Karyawan / Wiraswasta / IRT"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
              <div className="sm:col-span-2 lg:col-span-3">
                <label htmlFor="p-addr" className="block text-xs font-medium text-slate-700 mb-1">
                  Alamat Lengkap
                </label>
                <input
                  id="p-addr"
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Jl. ... Kelurahan, Kecamatan, Kota"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
                />
              </div>
            </div>
          </div>

          {/* Keluarga & Kontak Darurat */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              2. Penanggung Jawab &amp; Kontak Darurat
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="p-marital" className="block text-xs font-medium text-slate-700 mb-1">
                  Status Perkawinan
                </label>
                <select
                  id="p-marital"
                  value={form.maritalStatus}
                  onChange={(e) => setForm({ ...form, maritalStatus: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  <option value="Menikah">Menikah</option>
                  <option value="Belum Menikah">Belum Menikah</option>
                  <option value="Cerai">Cerai</option>
                </select>
              </div>
              <div>
                <label htmlFor="p-spouse" className="block text-xs font-medium text-slate-700 mb-1">
                  Nama Suami / Penanggung Jawab
                </label>
                <input
                  id="p-spouse"
                  value={form.spouseName}
                  onChange={(e) => setForm({ ...form, spouseName: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="p-fphone" className="block text-xs font-medium text-slate-700 mb-1">
                  Telepon Keluarga
                </label>
                <input
                  id="p-fphone"
                  value={form.familyPhone}
                  onChange={(e) => setForm({ ...form, familyPhone: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm font-mono"
                />
              </div>
              <div>
                <label htmlFor="p-emergency" className="block text-xs font-medium text-slate-700 mb-1">
                  Kontak Darurat
                </label>
                <input
                  id="p-emergency"
                  value={form.emergencyContact}
                  onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })}
                  placeholder="Nama & nomor telepon"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Riwayat Medis Dasar */}
          <div className="space-y-4">
            <h2 className="text-sm font-bold text-slate-900 pb-2 border-b border-slate-100">
              3. Ringkasan Medis &amp; Alergi
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label htmlFor="p-blood" className="block text-xs font-medium text-slate-700 mb-1">
                  Golongan Darah
                </label>
                <select
                  id="p-blood"
                  value={form.bloodType}
                  onChange={(e) => setForm({ ...form, bloodType: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm bg-white"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Belum Diketahui'].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-3">
                <label htmlFor="p-allergy" className="block text-xs font-medium text-slate-700 mb-1">
                  Riwayat Alergi Obat / Makanan (Digunakan untuk peringatan resep)
                </label>
                <input
                  id="p-allergy"
                  value={form.allergies}
                  onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                  placeholder="Contoh: Penisilin, Sulfa (atau Tidak ada)"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="p-medhist" className="block text-xs font-medium text-slate-700 mb-1">
                  Riwayat Penyakit
                </label>
                <textarea
                  id="p-medhist"
                  rows={2}
                  value={form.medicalHistory}
                  onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="p-surghist" className="block text-xs font-medium text-slate-700 mb-1">
                  Riwayat Operasi
                </label>
                <textarea
                  id="p-surghist"
                  rows={2}
                  value={form.surgicalHistory}
                  onChange={(e) => setForm({ ...form, surgicalHistory: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
              <div>
                <label htmlFor="p-drughist" className="block text-xs font-medium text-slate-700 mb-1">
                  Riwayat Pengobatan
                </label>
                <textarea
                  id="p-drughist"
                  rows={2}
                  value={form.medicationHistory}
                  onChange={(e) => setForm({ ...form, medicationHistory: e.target.value })}
                  className="w-full p-2.5 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>
          </div>

          {/* UU PDP Consent */}
          <div className="p-4 rounded-lg bg-slate-50 border border-slate-200 flex items-start gap-3">
            <input
              id="p-consent"
              type="checkbox"
              checked={form.consentGiven}
              onChange={(e) => setForm({ ...form, consentGiven: e.target.checked })}
              className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-700 focus:ring-teal-600"
            />
            <label htmlFor="p-consent" className="text-xs text-slate-700 leading-relaxed">
              Pasien telah memberikan persetujuan pemrosesan data pribadi kesehatan untuk keperluan pelayanan rekam medis elektronik sesuai ketentuan{' '}
              <strong>UU Nomor 27 Tahun 2022 tentang Pelindungan Data Pribadi</strong> dan{' '}
              <strong>Permenkes Nomor 24 Tahun 2022</strong>.
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => {
                setEditingPatient(null);
                setForm(EMPTY_PATIENT_FORM);
                setActiveView('patients');
              }}
              className="px-4 py-2.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={savingPatient}
              className="px-5 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60"
            >
              {savingPatient ? 'Menyimpan & Mengenkripsi...' : editingPatient ? 'Simpan Perubahan Pasien' : 'Daftarkan Pasien'}
            </button>
          </div>
        </form>
      </div>
    );
  }

  // ==================== VIEW 2: ANTREAN REAL-TIME ====================
  if (activeView === 'queue') {
    const dayVisits = dbState.visits
      .filter((v) => v.visitDate === queueFilterDate)
      .sort((a, b) => a.queueNumber.localeCompare(b.queueNumber));

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Antrean Pasien Real-Time</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pantau dan gerakkan tahapan antrean dari Terdaftar hingga Selesai secara terintegrasi.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="Filter tanggal antrean"
              value={queueFilterDate}
              onChange={(e) => setQueueFilterDate(e.target.value)}
              className="h-9 px-3 rounded-lg border border-slate-300 bg-white text-xs font-mono"
            />
            <button
              type="button"
              onClick={() => {
                setVisitForm((f) => ({ ...f, patientId: dbState.patients[0]?.id || '', doctorId: doctors[0]?.id || '' }));
                setVisitModalOpen(true);
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              <CalendarPlus className="w-4 h-4" />
              Daftar Kunjungan
            </button>
          </div>
        </div>

        {/* Status Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {QUEUE_STEPS.map((st) => {
            const count = dayVisits.filter((v) => v.status === st).length;
            return (
              <div key={st} className="bg-white border border-slate-200 rounded-lg p-3">
                <p className="text-[11px] text-slate-500 truncate">{st}</p>
                <p className="text-lg font-bold font-mono tabular-nums text-slate-900 mt-1">{count}</p>
              </div>
            );
          })}
        </div>

        {/* Queue Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Antrean</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien &amp; No. RM</th>
                  <th className="px-4 py-3 text-left font-semibold">Pelayanan &amp; Keluhan</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanda Vital Awal</th>
                  <th className="px-4 py-3 text-left font-semibold">Status Pemeriksaan</th>
                  <th className="px-4 py-3 text-left font-semibold">Pembayaran</th>
                  <th className="px-4 py-3 text-right font-semibold">Tindakan Alur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dayVisits.map((v) => {
                  const idx = QUEUE_STEPS.indexOf(v.status);
                  const nextStatus = idx >= 0 && idx < QUEUE_STEPS.length - 1 ? QUEUE_STEPS[idx + 1] : null;
                  return (
                    <tr key={v.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-bold text-sm text-teal-800 whitespace-nowrap">
                        {v.queueNumber}
                      </td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-slate-900">{v.patientName}</p>
                        <p className="text-slate-500 font-mono">{v.patientRm}</p>
                      </td>
                      <td className="px-4 py-3 max-w-xs">
                        <p className="font-medium text-slate-800">{v.visitType}</p>
                        <p className="text-slate-500 truncate">{v.initialComplaint}</p>
                      </td>
                      <td className="px-4 py-3 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                        {v.initialVitals?.bloodPressure ? `TD ${v.initialVitals.bloodPressure} · BB ${v.initialVitals.weightKg || '-'}kg` : '-'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          aria-label={`Ubah status antrean ${v.patientName}`}
                          value={v.status}
                          onChange={(e) => void updateVisitQueueStatus(v, e.target.value as QueueStatus)}
                          className="h-8 px-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-800"
                        >
                          {QUEUE_STEPS.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        <span
                          className={
                            v.paymentStatus === 'Lunas'
                              ? 'text-emerald-700'
                              : v.paymentStatus === 'Piutang' || v.paymentStatus === 'Dibayar Sebagian'
                              ? 'text-amber-700'
                              : 'text-slate-600'
                          }
                        >
                          {v.paymentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {nextStatus && (
                          <button
                            type="button"
                            onClick={() => void updateVisitQueueStatus(v, nextStatus)}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100"
                          >
                            {nextStatus} <ChevronRight className="w-3 h-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPatientId(v.patientId);
                            setSelectedVisitId(v.id);
                            setActiveView('rme');
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                        >
                          <Stethoscope className="w-3.5 h-3.5 text-teal-700" />
                          RME
                        </button>
                        {currentUser?.role !== 'DOKTER_SPOG' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedVisitId(v.id);
                              setActiveView('cashier');
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                          >
                            <CreditCard className="w-3.5 h-3.5 text-emerald-700" />
                            Kasir
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {dayVisits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-10 text-center text-slate-400">
                      Tidak ada pasien pada antrean tanggal {queueFilterDate}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* New Visit Modal */}
        {visitModalOpen && renderVisitModal()}
      </div>
    );
  }

  // ==================== VIEW 3: KUNJUNGAN ====================
  if (activeView === 'visits') {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Riwayat &amp; Pendaftaran Kunjungan</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Seluruh catatan kunjungan rawat jalan lengkap dengan tanda vital awal dan status pelayanan.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setVisitForm((f) => ({ ...f, patientId: dbState.patients[0]?.id || '', doctorId: doctors[0]?.id || '' }));
              setVisitModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4" />
            Buat Kunjungan Baru
          </button>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">No. Kunjungan</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-left font-semibold">Dokter</th>
                  <th className="px-4 py-3 text-left font-semibold">Jenis Layanan</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.visits.map((v) => (
                  <tr key={v.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{v.visitNumber}</td>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{v.visitDate}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{v.patientName}</p>
                      <p className="text-slate-400 font-mono">{v.patientRm}</p>
                    </td>
                    <td className="px-4 py-3 text-slate-700">{v.doctorName}</td>
                    <td className="px-4 py-3 text-slate-700">{v.visitType}</td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-slate-800">{v.status}</span> ·{' '}
                      <span className="text-teal-700">{v.paymentStatus}</span>
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
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
                {dbState.visits.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-10 text-center text-slate-400">
                      Belum ada kunjungan tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
        {visitModalOpen && renderVisitModal()}
      </div>
    );
  }

  // ==================== VIEW 4: DATA PASIEN (DEFAULT) ====================
  function renderVisitModal() {
    return (
      <div
        className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Pendaftaran Kunjungan & Tanda Vital Awal"
      >
        <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">Pendaftaran Kunjungan &amp; Tanda Vital Awal</h3>
            <button
              type="button"
              onClick={() => setVisitModalOpen(false)}
              aria-label="Tutup modal kunjungan"
              className="p-1.5 text-slate-500 hover:text-slate-900"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handleCreateVisit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label htmlFor="v-patient" className="block text-xs font-medium text-slate-700 mb-1">
                  Pilih Pasien *
                </label>
                <select
                  id="v-patient"
                  required
                  value={visitForm.patientId}
                  onChange={(e) => setVisitForm({ ...visitForm, patientId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
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
                <label htmlFor="v-doctor" className="block text-xs font-medium text-slate-700 mb-1">
                  Dokter Pemeriksa
                </label>
                <select
                  id="v-doctor"
                  value={visitForm.doctorId}
                  onChange={(e) => setVisitForm({ ...visitForm, doctorId: e.target.value })}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  {doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.displayName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="v-type" className="block text-xs font-medium text-slate-700 mb-1">
                  Jenis Kunjungan
                </label>
                <select
                  id="v-type"
                  value={visitForm.visitType}
                  onChange={(e) => {
                    const vt = e.target.value as VisitType;
                    const cat = vt.includes('USG')
                      ? 'USG'
                      : vt.includes('Ginekologi')
                      ? 'Ginekologi'
                      : vt.includes('KB')
                      ? 'Keluarga Berencana'
                      : 'Obstetri';
                    setVisitForm({ ...visitForm, visitType: vt, serviceCategory: cat });
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm"
                >
                  {VISIT_TYPES.map((vt) => (
                    <option key={vt} value={vt}>
                      {vt}
                    </option>
                  ))}
                </select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="v-complaint" className="block text-xs font-medium text-slate-700 mb-1">
                  Keluhan Awal Pasien
                </label>
                <input
                  id="v-complaint"
                  value={visitForm.initialComplaint}
                  onChange={(e) => setVisitForm({ ...visitForm, initialComplaint: e.target.value })}
                  placeholder="Contoh: Kontrol kehamilan rutin 28 minggu"
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 text-sm"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200 space-y-3">
              <p className="text-xs font-semibold text-slate-700">Input Tanda Vital Awal (Asisten / Perawat)</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="v-bp" className="block text-[11px] text-slate-500 mb-1">
                    Tekanan Darah (mmHg)
                  </label>
                  <input
                    id="v-bp"
                    value={visitForm.bloodPressure}
                    onChange={(e) => setVisitForm({ ...visitForm, bloodPressure: e.target.value })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="v-hr" className="block text-[11px] text-slate-500 mb-1">
                    Nadi (x/mnt)
                  </label>
                  <input
                    id="v-hr"
                    type="number"
                    value={visitForm.heartRate}
                    onChange={(e) => setVisitForm({ ...visitForm, heartRate: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="v-temp" className="block text-[11px] text-slate-500 mb-1">
                    Suhu (°C)
                  </label>
                  <input
                    id="v-temp"
                    type="number"
                    step="0.1"
                    value={visitForm.temperature}
                    onChange={(e) => setVisitForm({ ...visitForm, temperature: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="v-rr" className="block text-[11px] text-slate-500 mb-1">
                    Napasan (x/mnt)
                  </label>
                  <input
                    id="v-rr"
                    type="number"
                    value={visitForm.respiratoryRate}
                    onChange={(e) => setVisitForm({ ...visitForm, respiratoryRate: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="v-wt" className="block text-[11px] text-slate-500 mb-1">
                    Berat Badan (kg)
                  </label>
                  <input
                    id="v-wt"
                    type="number"
                    step="0.1"
                    value={visitForm.weightKg}
                    onChange={(e) => setVisitForm({ ...visitForm, weightKg: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="v-ht" className="block text-[11px] text-slate-500 mb-1">
                    Tinggi Badan (cm)
                  </label>
                  <input
                    id="v-ht"
                    type="number"
                    value={visitForm.heightCm}
                    onChange={(e) => setVisitForm({ ...visitForm, heightCm: Number(e.target.value) })}
                    className="w-full h-9 px-2.5 rounded-lg border border-slate-300 text-xs font-mono"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setVisitModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
              >
                Batal
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
              >
                Buat Kunjungan &amp; Ambil Antrean
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Database Pasien</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Total <span className="font-mono font-semibold text-slate-800">{dbState.patients.length}</span> pasien terdaftar · Data pribadi spesifik dilindungi enkripsi AES-256-GCM.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {can('patients.register') && (
            <button
              type="button"
              onClick={() => {
                setEditingPatient(null);
                setForm(EMPTY_PATIENT_FORM);
                setActiveView('patient-register');
              }}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              <UserPlus className="w-4 h-4" />
              Pasien Baru
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setVisitForm((f) => ({ ...f, patientId: dbState.patients[0]?.id || '', doctorId: doctors[0]?.id || '' }));
              setVisitModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-xs font-semibold hover:bg-slate-50 whitespace-nowrap"
          >
            <CalendarPlus className="w-4 h-4 text-teal-700" />
            Daftar Kunjungan
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            aria-label="Cari pasien"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Cari nama, nomor RM, NIK, atau telepon..."
            className="w-full h-9 pl-9 pr-3 rounded-lg border border-slate-300 text-sm focus:ring-2 focus:ring-teal-600 focus:outline-none"
          />
        </div>
        <div className="text-xs text-slate-500 font-mono tabular-nums">
          Halaman {page} / {totalPages} · {filteredPatients.length} hasil
        </div>
      </div>

      {/* Patients Data Grid */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <th className="px-4 py-3 text-left font-semibold">No. RM</th>
                <th className="px-4 py-3 text-left font-semibold">Nama Lengkap</th>
                <th className="px-4 py-3 text-left font-semibold">Usia / Tgl Lahir</th>
                <th className="px-4 py-3 text-left font-semibold">Kontak</th>
                <th className="px-4 py-3 text-left font-semibold">Gol. Darah &amp; Alergi</th>
                <th className="px-4 py-3 text-right font-semibold">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedPatients.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono font-bold text-teal-800 whitespace-nowrap">{p.rmNumber}</td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-900">{p.fullName}</p>
                    <p className="text-slate-500 truncate max-w-xs">{p.address || '-'}</p>
                  </td>
                  <td className="px-4 py-3 font-mono tabular-nums text-slate-700 whitespace-nowrap">
                    {calculateAgeYears(p.birthDate)} th · {p.birthDate}
                  </td>
                  <td className="px-4 py-3 font-mono text-slate-700 whitespace-nowrap">{p.phone || '-'}</td>
                  <td className="px-4 py-3">
                    <span className="font-mono font-semibold text-slate-800">{p.bloodType || '-'}</span>
                    {p.allergies && p.allergies.toLowerCase() !== 'tidak ada' && (
                      <span className="ml-2 text-red-700 font-semibold">· Alergi: {p.allergies}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedPatientId(p.id);
                        setDetailTab('profil');
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                    >
                      <Eye className="w-3.5 h-3.5 text-teal-700" />
                      Detail
                    </button>
                    {can('patients.register') && (
                      <button
                        type="button"
                        onClick={() => openEditPatient(p)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md border border-slate-200 text-slate-700 hover:bg-slate-100 font-medium"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        Edit
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setVisitForm((f) => ({ ...f, patientId: p.id, doctorId: doctors[0]?.id || '' }));
                        setVisitModalOpen(true);
                      }}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md bg-teal-50 text-teal-800 hover:bg-teal-100 font-semibold"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      Kunjungan
                    </button>
                    {can('patients.delete') && (
                      <button
                        type="button"
                        aria-label={`Hapus pasien ${p.fullName}`}
                        onClick={() => {
                          void deleteRecord('patients', p.id).then(() => {
                            if (selectedPatientId === p.id) setSelectedPatientId(null);
                            notifyToast(`Pasien ${p.fullName} dihapus.`, 'info');
                          });
                        }}
                        className="inline-flex items-center p-1.5 rounded-md text-slate-400 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {pagedPatients.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    Belum ada data pasien yang cocok dengan pencarian Anda.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div className="px-4 py-3 border-t border-slate-200 flex items-center justify-between text-xs">
            <button
              type="button"
              disabled={page <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-40"
            >
              Sebelumnya
            </button>
            <span className="font-mono text-slate-600">
              {page} / {totalPages}
            </span>
            <button
              type="button"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="px-3 py-1.5 rounded-md border border-slate-300 disabled:opacity-40"
            >
              Berikutnya
            </button>
          </div>
        )}
      </div>

      {/* Patient Comprehensive Detail Modal */}
      {selectedPatient && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label={`Berkas Lengkap Pasien ${selectedPatient.fullName}`}
        >
          <div className="bg-white border border-slate-200 rounded-xl max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900">
                  {selectedPatient.fullName}{' '}
                  <span className="font-mono text-teal-800 ml-1">{selectedPatient.rmNumber}</span>
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  {calculateAgeYears(selectedPatient.birthDate)} th · Gol. Darah {selectedPatient.bloodType} · Alergi:{' '}
                  <span className={selectedPatient.allergies.toLowerCase() !== 'tidak ada' ? 'text-red-700 font-semibold' : ''}>
                    {selectedPatient.allergies}
                  </span>
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedPatientId(null)}
                aria-label="Tutup detail pasien"
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="px-6 pt-3 border-b border-slate-200 flex items-center gap-1 overflow-x-auto">
              {(
                [
                  ['profil', 'Profil'],
                  ['kunjungan', 'Kunjungan'],
                  ['rme', 'Rekam Medis'],
                  ['kehamilan', 'Kehamilan & USG'],
                  ['resep', 'Resep'],
                  ['pembayaran', 'Pembayaran'],
                  ['dokumen', 'Dokumen']
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setDetailTab(key)}
                  className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap transition-colors ${
                    detailTab === key
                      ? 'border-teal-700 text-teal-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {detailTab === 'profil' && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-bold text-slate-900">Identitas &amp; Kontak (Terdekripsi E2EE)</p>
                    <p><span className="text-slate-500">NIK:</span> <span className="font-mono">{selectedPatient.nik || '-'}</span></p>
                    <p><span className="text-slate-500">TTL:</span> {selectedPatient.birthPlace}, {selectedPatient.birthDate}</p>
                    <p><span className="text-slate-500">Telepon:</span> <span className="font-mono">{selectedPatient.phone}</span></p>
                    <p><span className="text-slate-500">Email:</span> {selectedPatient.email || '-'}</p>
                    <p><span className="text-slate-500">Alamat:</span> {selectedPatient.address || '-'}</p>
                    <p><span className="text-slate-500">Suami/Penanggung Jawab:</span> {selectedPatient.spouseName || '-'}</p>
                    <p><span className="text-slate-500">Kontak Darurat:</span> {selectedPatient.emergencyContact || '-'}</p>
                  </div>
                  <div className="space-y-2 p-4 rounded-lg bg-slate-50 border border-slate-200">
                    <p className="font-bold text-slate-900">Riwayat Klinis Dasar</p>
                    <p><span className="text-slate-500">Golongan Darah:</span> {selectedPatient.bloodType}</p>
                    <p><span className="text-slate-500">Alergi:</span> {selectedPatient.allergies}</p>
                    <p><span className="text-slate-500">Riwayat Penyakit:</span> {selectedPatient.medicalHistory || '-'}</p>
                    <p><span className="text-slate-500">Riwayat Operasi:</span> {selectedPatient.surgicalHistory || '-'}</p>
                    <p><span className="text-slate-500">Riwayat Obat:</span> {selectedPatient.medicationHistory || '-'}</p>
                    <p><span className="text-slate-500">Persetujuan UU PDP:</span> {selectedPatient.consentGiven ? `Disetujui (${selectedPatient.consentDate || '-'})` : 'Belum'}</p>
                  </div>
                </div>
              )}

              {detailTab === 'kunjungan' && (
                <div className="space-y-2">
                  {dbState.visits
                    .filter((v) => v.patientId === selectedPatient.id)
                    .map((v) => (
                      <div key={v.id} className="p-3.5 rounded-lg border border-slate-200 flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {v.visitDate} · {v.visitType} ({v.visitNumber})
                          </p>
                          <p className="text-slate-500 mt-0.5">{v.initialComplaint}</p>
                        </div>
                        <span className="font-medium text-teal-800">{v.status}</span>
                      </div>
                    ))}
                  {dbState.visits.filter((v) => v.patientId === selectedPatient.id).length === 0 && (
                    <p className="text-slate-400 text-center py-6">Belum ada riwayat kunjungan.</p>
                  )}
                </div>
              )}

              {detailTab === 'rme' && (
                <div className="space-y-2">
                  {dbState.medical_records
                    .filter((r) => r.patientId === selectedPatient.id)
                    .map((r) => (
                      <div key={r.id} className="p-3.5 rounded-lg border border-slate-200 space-y-1">
                        <div className="flex justify-between">
                          <span className="font-semibold text-slate-900">
                            {r.visitDate} · {r.doctorName}
                          </span>
                          <span className="font-mono text-teal-700 uppercase">{r.status}</span>
                        </div>
                        <p className="text-slate-700">Keluhan: {r.anamnesis.chiefComplaint}</p>
                        <p className="text-slate-700">
                          Diagnosis: {r.diagnoses.map((d) => `${d.icd10Code} ${d.description}`).join('; ') || '-'}
                        </p>
                      </div>
                    ))}
                  {dbState.medical_records.filter((r) => r.patientId === selectedPatient.id).length === 0 && (
                    <p className="text-slate-400 text-center py-6">Belum ada catatan rekam medis.</p>
                  )}
                </div>
              )}

              {detailTab === 'kehamilan' && (
                <div className="space-y-3">
                  {dbState.pregnancies
                    .filter((pr) => pr.patientId === selectedPatient.id)
                    .map((pr) => (
                      <div key={pr.id} className="p-3.5 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-900">
                          G{pr.gravida}P{pr.para}A{pr.abortus} · HPHT {pr.hpht} · HPL {pr.hpl} ({pr.status})
                        </p>
                        <p className="text-slate-600 mt-0.5">Risiko {pr.riskLevel} — {pr.riskFactors}</p>
                      </div>
                    ))}
                  {dbState.ultrasound_records
                    .filter((u) => u.patientId === selectedPatient.id)
                    .map((u) => (
                      <div key={u.id} className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="font-semibold text-teal-800">{u.examDate} · {u.examType}</p>
                        <p className="text-slate-700 mt-1">{u.conclusion}</p>
                      </div>
                    ))}
                </div>
              )}

              {detailTab === 'resep' && (
                <div className="space-y-2">
                  {dbState.prescriptions
                    .filter((rx) => rx.patientId === selectedPatient.id)
                    .map((rx) => (
                      <div key={rx.id} className="p-3.5 rounded-lg border border-slate-200">
                        <p className="font-semibold text-slate-900">
                          {rx.rxNumber} · {rx.status}
                        </p>
                        <p className="text-slate-600 mt-1">
                          {rx.items.map((i) => `${i.medicineName} (${i.frequency}, #${i.quantity})`).join(' · ')}
                        </p>
                      </div>
                    ))}
                </div>
              )}

              {detailTab === 'pembayaran' && (
                <div className="space-y-2">
                  {dbState.payments
                    .filter((pay) => pay.patientId === selectedPatient.id)
                    .map((pay) => (
                      <div key={pay.id} className="p-3.5 rounded-lg border border-slate-200 flex justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{pay.receiptNumber}</p>
                          <p className="text-slate-500">{pay.paymentDate} · {pay.method}</p>
                        </div>
                        <span className="font-mono font-bold text-emerald-700">{formatCurrencyIDR(pay.amount)}</span>
                      </div>
                    ))}
                </div>
              )}

              {detailTab === 'dokumen' && (
                <div className="space-y-4">
                  <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg border border-dashed border-teal-500 bg-teal-50/50 text-teal-800 font-semibold cursor-pointer hover:bg-teal-50">
                    <FileUp className="w-4 h-4" />
                    Unggah Dokumen Pendukung (KTP / Rujukan / Lab)
                    <input
                      type="file"
                      className="hidden"
                      onChange={(e) => void handleUploadSupportDoc(selectedPatient, e.target.files?.[0] || null)}
                    />
                  </label>
                  <div className="space-y-2">
                    {dbState.documents
                      .filter((d) => d.patientId === selectedPatient.id)
                      .map((d) => (
                        <div key={d.id} className="p-3 rounded-lg border border-slate-200 flex items-center justify-between">
                          <div>
                            <p className="font-semibold text-slate-900">{d.title}</p>
                            <p className="text-slate-500">{d.docType} · {d.createdAt.slice(0, 10)}</p>
                          </div>
                          {d.fileUrl && (
                            <a
                              href={d.fileUrl}
                              download={d.title}
                              className="text-teal-700 font-semibold hover:underline"
                            >
                              Unduh
                            </a>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {visitModalOpen && renderVisitModal()}
    </div>
  );
};
