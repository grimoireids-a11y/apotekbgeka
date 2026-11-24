import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  FlaskConical,
  Pill,
  Plus,
  Printer,
  Trash2,
  X
} from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type {
  Invoice,
  LaboratoryOrder,
  LaboratoryResult,
  Medicine,
  Prescription,
  PrescriptionItem,
  ProcedureRecord
} from '../types/models';
import { LAB_TEST_CATALOG } from '../data/defaults';
import {
  calculateInvoiceTotals,
  checkPrescriptionSafety,
  formatAutoNumber,
  formatCurrencyIDR
} from '../utils/obstetrics';

export const ClinicalSupportModule: React.FC = () => {
  const {
    activeView,
    dbState,
    currentUser,
    practice,
    upsertRecord,
    pushNotification,
    notifyToast,
    setPrintPayload,
    can
  } = usePractice();

  // ==================== PROCEDURES STATE ====================
  const [procVisitId, setProcVisitId] = useState(dbState.visits[0]?.id || '');
  const [procServiceId, setProcServiceId] = useState(dbState.services[0]?.id || '');
  const [procNotes, setProcNotes] = useState('');

  // ==================== PRESCRIPTION STATE ====================
  const [rxTab, setRxTab] = useState<'resep' | 'katalog'>('resep');
  const [rxVisitId, setRxVisitId] = useState(dbState.visits[0]?.id || '');
  const [rxItems, setRxItems] = useState<PrescriptionItem[]>([]);
  const [selMedId, setSelMedId] = useState(dbState.medicines[0]?.id || '');
  const [medDosage, setMedDosage] = useState('1 tablet');
  const [medFreq, setMedFreq] = useState('1x1');
  const [medQty, setMedQty] = useState(15);
  const [medDuration, setMedDuration] = useState('15 hari');
  const [medInstr, setMedInstr] = useState('Sesudah makan');

  // New Medicine Modal
  const [medModalOpen, setMedModalOpen] = useState(false);
  const [newMed, setNewMed] = useState({
    code: '',
    name: '',
    genericName: '',
    brand: '',
    dosageForm: 'Tablet',
    strength: '500 mg',
    unit: 'Tablet',
    price: 5000,
    stock: 100,
    expiryDate: '2027-12-31'
  });

  // ==================== LAB STATE ====================
  const [labVisitId, setLabVisitId] = useState(dbState.visits[0]?.id || '');
  const [selectedLabCodes, setSelectedLabCodes] = useState<string[]>([]);
  const [labNotes, setLabNotes] = useState('');
  const [resultModalOrder, setResultModalOrder] = useState<LaboratoryOrder | null>(null);
  const [resultDraft, setResultDraft] = useState<Record<string, { value: string; flag: LaboratoryResult['flag'] }>>({});

  // Helper to append billable line item to visit invoice automatically
  const addItemToVisitInvoice = async (
    visitId: string,
    category: Invoice['items'][number]['category'],
    description: string,
    qty: number,
    unitPrice: number
  ) => {
    const visit = dbState.visits.find((v) => v.id === visitId);
    if (!visit || !currentUser) return;
    const nowIso = new Date().toISOString();
    const today = nowIso.slice(0, 10);
    const existing = dbState.invoices.find((i) => i.visitId === visitId);
    const newItem = {
      id: `ii-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      category,
      description,
      qty,
      unitPrice,
      total: qty * unitPrice
    };
    const items = existing ? [...existing.items, newItem] : [newItem];
    const calc = calculateInvoiceTotals(items, existing?.discount || 0, practice.taxRatePercent || 0, existing?.paidAmount || 0);
    const invoice: Invoice = {
      id: existing?.id || `inv-${visitId}`,
      invoiceNumber:
        existing?.invoiceNumber || formatAutoNumber(practice.invoiceFormat || 'INV', dbState.invoices.length + 1, today),
      visitId,
      patientId: visit.patientId,
      patientName: visit.patientName,
      patientRm: visit.patientRm,
      items,
      subtotal: calc.subtotal,
      discount: calc.discount,
      tax: calc.tax,
      total: calc.total,
      paidAmount: existing?.paidAmount || 0,
      remainingAmount: calc.remaining,
      status: calc.remaining === 0 ? 'Lunas' : existing?.paidAmount ? 'Dibayar Sebagian' : 'Belum Dibayar',
      createdAt: existing?.createdAt || nowIso,
      createdBy: existing?.createdBy || currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('invoices', invoice);
  };

  // ==================== 1. TINDAKAN MEDIS ====================
  if (activeView === 'procedures') {
    const handleAddProcedure = async (e: React.FormEvent) => {
      e.preventDefault();
      const visit = dbState.visits.find((v) => v.id === procVisitId);
      const service = dbState.services.find((s) => s.id === procServiceId);
      if (!visit || !service || !currentUser) {
        notifyToast('Pilih kunjungan pasien dan jenis tindakan.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const rec: ProcedureRecord = {
        id: `proc-${Date.now()}`,
        visitId: visit.id,
        patientId: visit.patientId,
        patientName: visit.patientName,
        serviceId: service.id,
        code: service.code,
        name: service.name,
        category: service.category,
        price: service.price,
        doctorId: visit.doctorId,
        doctorName: visit.doctorName,
        notes: procNotes.trim(),
        billed: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('procedures', rec);
      await addItemToVisitInvoice(
        visit.id,
        service.category === 'USG' ? 'USG' : service.category === 'Konsultasi' ? 'Konsultasi' : 'Tindakan',
        service.name,
        1,
        service.price
      );
      setProcNotes('');
      notifyToast(`Tindakan "${service.name}" dicatat & otomatis masuk tagihan pasien.`, 'success');
    };

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Tindakan Medis &amp; Katalog Pelayanan</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Setiap tindakan yang dicatat terhubung dengan kunjungan pasien dan otomatis ditambahkan ke tagihan kasir.
          </p>
        </div>

        <form onSubmit={handleAddProcedure} className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 md:grid-cols-4 gap-3 text-xs items-end">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Kunjungan Pasien</label>
            <select value={procVisitId} onChange={(e) => setProcVisitId(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
              <option value="">-- Pilih Kunjungan --</option>
              {dbState.visits.map((v) => (
                <option key={v.id} value={v.id}>{v.visitDate} · {v.patientName} ({v.queueNumber})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Tindakan / Layanan</label>
            <select value={procServiceId} onChange={(e) => setProcServiceId(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
              {dbState.services.filter((s) => s.active).map((s) => (
                <option key={s.id} value={s.id}>{s.name} ({formatCurrencyIDR(s.price)})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Catatan Klinis / Instruksi</label>
            <input value={procNotes} onChange={(e) => setProcNotes(e.target.value)} placeholder="Catatan tindakan..." className="w-full h-9 px-3 rounded-lg border border-slate-300" />
          </div>
          <button type="submit" className="h-9 px-4 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800 whitespace-nowrap">
            Catat &amp; Masukkan Tagihan
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Tindakan Pasien</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="px-4 py-3 text-left font-semibold">Kode</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-left font-semibold">Nama Tindakan</th>
                  <th className="px-4 py-3 text-left font-semibold">Catatan</th>
                  <th className="px-4 py-3 text-right font-semibold">Tarif</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.procedures.map((p) => (
                  <tr key={p.id}>
                    <td className="px-4 py-2.5 font-mono text-teal-800">{p.code}</td>
                    <td className="px-4 py-2.5 font-semibold text-slate-900">{p.patientName}</td>
                    <td className="px-4 py-2.5 text-slate-800">{p.name}</td>
                    <td className="px-4 py-2.5 text-slate-500">{p.notes || '-'}</td>
                    <td className="px-4 py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                      {formatCurrencyIDR(p.price)}
                    </td>
                  </tr>
                ))}
                {dbState.procedures.length === 0 && (
                  <tr><td colSpan={5} className="py-8 text-center text-slate-400">Belum ada tindakan medis tercatat.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== 2. RESEP & OBAT ====================
  if (activeView === 'prescriptions') {
    const selectedVisit = dbState.visits.find((v) => v.id === rxVisitId);
    const selectedPatient = dbState.patients.find((p) => p.id === selectedVisit?.patientId);

    const safetyCheck = useMemo(
      () => checkPrescriptionSafety(rxItems, selectedPatient?.allergies || ''),
      [rxItems, selectedPatient]
    );

    const addRxLine = () => {
      const med = dbState.medicines.find((m) => m.id === selMedId);
      if (!med) return;
      const item: PrescriptionItem = {
        medicineId: med.id,
        medicineName: med.name,
        genericName: med.genericName,
        dosage: medDosage,
        frequency: medFreq,
        quantity: Number(medQty) || 1,
        unit: med.unit,
        unitPrice: med.price,
        route: 'Oral',
        duration: medDuration,
        instructions: medInstr
      };
      setRxItems((prev) => [...prev, item]);
    };

    const handleAuthorizePrescription = async () => {
      if (!selectedVisit || !selectedPatient || rxItems.length === 0 || !currentUser) {
        notifyToast('Pilih kunjungan dan tambahkan minimal 1 obat ke resep.', 'error');
        return;
      }
      const nowIso = new Date().toISOString();
      const today = nowIso.slice(0, 10);
      const rx: Prescription = {
        id: `rx-${Date.now()}`,
        rxNumber: formatAutoNumber(practice.rxFormat || 'RX', dbState.prescriptions.length + 1, today),
        visitId: selectedVisit.id,
        patientId: selectedPatient.id,
        patientName: selectedPatient.fullName,
        patientRm: selectedPatient.rmNumber,
        doctorId: currentUser.id,
        doctorName: currentUser.displayName,
        items: rxItems,
        interactionWarnings: safetyCheck.interactionWarnings,
        allergyWarnings: safetyCheck.allergyWarnings,
        status: 'Disahkan Dokter',
        authorizedAt: nowIso,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('prescriptions', rx);
      for (const it of rxItems) {
        await addItemToVisitInvoice(selectedVisit.id, 'Obat', `${it.medicineName} (${it.quantity} ${it.unit})`, it.quantity, it.unitPrice);
      }
      setRxItems([]);
      notifyToast(`Resep ${rx.rxNumber} disahkan dokter & otomatis masuk tagihan pasien.`, 'success');
    };

    const handleDispenseRx = async (rx: Prescription) => {
      if (!currentUser) return;
      const nowIso = new Date().toISOString();
      await upsertRecord('prescriptions', {
        ...rx,
        status: 'Diserahkan',
        dispensedAt: nowIso,
        dispensedBy: currentUser.displayName
      });
      // Deduct stock if cashier/assistant/admin
      for (const it of rx.items) {
        const med = dbState.medicines.find((m) => m.id === it.medicineId);
        if (med) {
          await upsertRecord('medicines', { ...med, stock: Math.max(0, med.stock - it.quantity) });
        }
      }
      notifyToast(`Obat pada resep ${rx.rxNumber} diserahkan & stok diperbarui.`, 'success');
    };

    const handleSaveNewMed = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newMed.name.trim() || !currentUser) return;
      const nowIso = new Date().toISOString();
      const rec: Medicine = {
        id: `med-${Date.now()}`,
        code: newMed.code.trim() || `OBT-${dbState.medicines.length + 1}`,
        name: newMed.name.trim(),
        genericName: newMed.genericName.trim() || newMed.name.trim(),
        brand: newMed.brand.trim() || 'Generik',
        dosageForm: newMed.dosageForm,
        strength: newMed.strength,
        unit: newMed.unit,
        price: Number(newMed.price) || 0,
        stock: Number(newMed.stock) || 0,
        expiryDate: newMed.expiryDate,
        active: true,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('medicines', rec);
      setMedModalOpen(false);
      notifyToast(`Obat "${rec.name}" ditambahkan ke katalog.`, 'success');
    };

    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Resep Elektronik &amp; Katalog Obat</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemeriksaan interaksi obat &amp; alergi pasien otomatis · Pengesahan resep oleh Dokter · Penyerahan obat oleh Asisten.
            </p>
          </div>
          <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-lg">
            <button type="button" onClick={() => setRxTab('resep')} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${rxTab === 'resep' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>
              Resep Dokter
            </button>
            <button type="button" onClick={() => setRxTab('katalog')} className={`px-3 py-1.5 text-xs font-semibold rounded-md ${rxTab === 'katalog' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}>
              Katalog &amp; Stok Obat ({dbState.medicines.length})
            </button>
          </div>
        </div>

        {rxTab === 'resep' ? (
          <div className="space-y-6">
            {can('prescriptions.write') && (
              <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
                <h2 className="text-sm font-bold text-slate-900">Buat Resep Baru (Kewenangan Dokter Sp.OG)</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">Pilih Kunjungan Pasien</label>
                    <select value={rxVisitId} onChange={(e) => setRxVisitId(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
                      <option value="">-- Pilih Kunjungan --</option>
                      {dbState.visits.map((v) => (
                        <option key={v.id} value={v.id}>{v.visitDate} · {v.patientName} ({v.patientRm})</option>
                      ))}
                    </select>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                    <span className="text-slate-500 block">Riwayat Alergi Pasien:</span>
                    <span className={`font-semibold ${selectedPatient?.allergies && selectedPatient.allergies.toLowerCase() !== 'tidak ada' ? 'text-red-700' : 'text-slate-800'}`}>
                      {selectedPatient?.allergies || 'Belum ada pasien dipilih'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 items-end">
                  <div className="col-span-2">
                    <label className="block text-slate-600 mb-1">Obat</label>
                    <select value={selMedId} onChange={(e) => setSelMedId(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 bg-white">
                      {dbState.medicines.filter((m) => m.active).map((m) => (
                        <option key={m.id} value={m.id}>{m.name} (Stok {m.stock})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Frekuensi</label>
                    <input value={medFreq} onChange={(e) => setMedFreq(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Jumlah</label>
                    <input type="number" min={1} value={medQty} onChange={(e) => setMedQty(Number(e.target.value))} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" />
                  </div>
                  <div>
                    <label className="block text-slate-600 mb-1">Instruksi</label>
                    <input value={medInstr} onChange={(e) => setMedInstr(e.target.value)} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" />
                  </div>
                  <button type="button" onClick={addRxLine} className="h-9 px-3 rounded-lg bg-slate-900 text-white font-semibold hover:bg-slate-800 whitespace-nowrap">
                    + Tambah Item
                  </button>
                </div>

                {(safetyCheck.allergyWarnings.length > 0 || safetyCheck.interactionWarnings.length > 0) && (
                  <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 space-y-1.5 text-red-800">
                    <div className="flex items-center gap-2 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>Peringatan Keselamatan Obat &amp; Alergi</span>
                    </div>
                    {safetyCheck.allergyWarnings.map((w, i) => <p key={`a-${i}`}>• {w}</p>)}
                    {safetyCheck.interactionWarnings.map((w, i) => <p key={`i-${i}`}>• {w}</p>)}
                  </div>
                )}

                {rxItems.length > 0 && (
                  <div className="space-y-2 border-t border-slate-200 pt-3">
                    {rxItems.map((it, idx) => (
                      <div key={idx} className="flex items-center justify-between p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <div>
                          <span className="font-semibold text-slate-900">{it.medicineName}</span> · {it.frequency} · #{it.quantity} {it.unit} ({it.instructions})
                        </div>
                        <button type="button" onClick={() => setRxItems((p) => p.filter((_, i) => i !== idx))} aria-label="Hapus item resep" className="text-slate-400 hover:text-red-700">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                    <div className="flex justify-end pt-2">
                      <button type="button" onClick={() => void handleAuthorizePrescription()} className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">
                        Sahkan &amp; Terbitkan Resep Dokter
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Prescription List */}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200">
                <h2 className="text-sm font-bold text-slate-900">Daftar Resep Pasien</h2>
              </div>
              <div className="divide-y divide-slate-100 text-xs">
                {dbState.prescriptions.map((rx) => (
                  <div key={rx.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="space-y-1">
                      <p className="font-bold text-slate-900">
                        <span className="font-mono text-teal-800">{rx.rxNumber}</span> · {rx.patientName} ({rx.patientRm})
                      </p>
                      <p className="text-slate-600">
                        {rx.items.map((i) => `${i.medicineName} (${i.frequency}, #${i.quantity})`).join(' · ')}
                      </p>
                      <p className="text-slate-400">Dokter: {rx.doctorName} · Status: <strong className="text-slate-800">{rx.status}</strong></p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {can('prescriptions.dispense') && rx.status === 'Disahkan Dokter' && (
                        <button
                          type="button"
                          onClick={() => void handleDispenseRx(rx)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 whitespace-nowrap"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Serahkan Obat
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPayload({
                            type: 'resep',
                            title: 'RESEP ELEKTRONIK DOKTER',
                            subtitle: rx.rxNumber,
                            data: rx as unknown as Record<string, unknown>
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak
                      </button>
                    </div>
                  </div>
                ))}
                {dbState.prescriptions.length === 0 && (
                  <div className="py-10 text-center text-slate-400">
                    <Pill className="w-7 h-7 mx-auto mb-2 text-slate-300" />
                    Belum ada resep diterbitkan.
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {currentUser?.role !== 'DOKTER_SPOG' && (
              <div className="flex justify-end">
                <button type="button" onClick={() => setMedModalOpen(true)} className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800">
                  <Plus className="w-4 h-4" />
                  Tambah Obat ke Katalog
                </button>
              </div>
            )}
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                      <th className="px-4 py-3 text-left font-semibold">Kode</th>
                      <th className="px-4 py-3 text-left font-semibold">Nama Obat &amp; Generik</th>
                      <th className="px-4 py-3 text-left font-semibold">Sediaan &amp; Kekuatan</th>
                      <th className="px-4 py-3 text-right font-semibold">Harga</th>
                      <th className="px-4 py-3 text-right font-semibold">Stok</th>
                      <th className="px-4 py-3 text-left font-semibold">Kedaluwarsa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {dbState.medicines.map((m) => (
                      <tr key={m.id}>
                        <td className="px-4 py-2.5 font-mono text-teal-800">{m.code}</td>
                        <td className="px-4 py-2.5">
                          <p className="font-semibold text-slate-900">{m.name}</p>
                          <p className="text-slate-500">{m.genericName} · {m.brand}</p>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700">{m.dosageForm} {m.strength}</td>
                        <td className="px-4 py-2.5 text-right font-mono tabular-nums">{formatCurrencyIDR(m.price)}</td>
                        <td className={`px-4 py-2.5 text-right font-mono font-bold tabular-nums ${m.stock < 20 ? 'text-red-700' : 'text-slate-900'}`}>
                          {m.stock} {m.unit}
                        </td>
                        <td className="px-4 py-2.5 font-mono text-slate-600">{m.expiryDate}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {medModalOpen && (
              <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4" role="dialog" aria-modal="true">
                <div className="bg-white border border-slate-200 rounded-xl max-w-lg w-full p-6 space-y-4 text-xs">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900">Tambah Obat Baru</h3>
                    <button type="button" onClick={() => setMedModalOpen(false)} aria-label="Tutup modal obat"><X className="w-4 h-4" /></button>
                  </div>
                  <form onSubmit={handleSaveNewMed} className="grid grid-cols-2 gap-3">
                    <div><label className="block text-slate-600 mb-1">Kode</label><input value={newMed.code} onChange={(e) => setNewMed({ ...newMed, code: e.target.value })} placeholder="OBT-011" className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                    <div><label className="block text-slate-600 mb-1">Nama Obat *</label><input required value={newMed.name} onChange={(e) => setNewMed({ ...newMed, name: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" /></div>
                    <div><label className="block text-slate-600 mb-1">Nama Generik</label><input value={newMed.genericName} onChange={(e) => setNewMed({ ...newMed, genericName: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" /></div>
                    <div><label className="block text-slate-600 mb-1">Merek</label><input value={newMed.brand} onChange={(e) => setNewMed({ ...newMed, brand: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300" /></div>
                    <div><label className="block text-slate-600 mb-1">Harga (Rp)</label><input type="number" value={newMed.price} onChange={(e) => setNewMed({ ...newMed, price: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                    <div><label className="block text-slate-600 mb-1">Stok Awal</label><input type="number" value={newMed.stock} onChange={(e) => setNewMed({ ...newMed, stock: Number(e.target.value) })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                    <div className="col-span-2"><label className="block text-slate-600 mb-1">Batas Kedaluwarsa</label><input type="date" value={newMed.expiryDate} onChange={(e) => setNewMed({ ...newMed, expiryDate: e.target.value })} className="w-full h-9 px-2.5 rounded-lg border border-slate-300 font-mono" /></div>
                    <div className="col-span-2 flex justify-end gap-2 pt-2">
                      <button type="button" onClick={() => setMedModalOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold">Batal</button>
                      <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">Simpan Obat</button>
                    </div>
                  </form>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  }

  // ==================== 3. LABORATORIUM ====================
  const toggleLabCode = (code: string) => {
    setSelectedLabCodes((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));
  };

  const handleCreateLabOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    const visit = dbState.visits.find((v) => v.id === labVisitId);
    if (!visit || selectedLabCodes.length === 0 || !currentUser) {
      notifyToast('Pilih kunjungan pasien dan minimal 1 parameter laboratorium.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const tests = LAB_TEST_CATALOG.filter((t) => selectedLabCodes.includes(t.code)).map((t) => ({
      code: t.code,
      name: t.name,
      price: t.price,
      unit: t.unit,
      referenceRange: t.referenceRange
    }));
    const order: LaboratoryOrder = {
      id: `lab-${Date.now()}`,
      orderNumber: `LAB-${nowIso.slice(0, 10).replaceAll('-', '')}-${String(dbState.laboratory_orders.length + 1).padStart(4, '0')}`,
      visitId: visit.id,
      patientId: visit.patientId,
      patientName: visit.patientName,
      patientRm: visit.patientRm,
      doctorId: visit.doctorId,
      doctorName: visit.doctorName,
      tests,
      clinicalNotes: labNotes.trim(),
      status: 'Diminta',
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('laboratory_orders', order);
    for (const t of tests) {
      await addItemToVisitInvoice(visit.id, 'Laboratorium', `Lab: ${t.name}`, 1, t.price);
    }
    setSelectedLabCodes([]);
    setLabNotes('');
    notifyToast(`Permintaan laboratorium ${order.orderNumber} dibuat & masuk tagihan.`, 'success');
  };

  const handleSaveLabResults = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resultModalOrder || !currentUser) return;
    const nowIso = new Date().toISOString();
    for (const t of resultModalOrder.tests) {
      const val = resultDraft[t.code]?.value || 'Normal';
      const flag = resultDraft[t.code]?.flag || 'Normal';
      const res: LaboratoryResult = {
        id: `labr-${resultModalOrder.id}-${t.code}`,
        orderId: resultModalOrder.id,
        visitId: resultModalOrder.visitId,
        patientId: resultModalOrder.patientId,
        patientName: resultModalOrder.patientName,
        testCode: t.code,
        testName: t.name,
        resultValue: val,
        unit: t.unit,
        referenceRange: t.referenceRange,
        flag,
        examinerName: currentUser.displayName,
        examinedAt: nowIso,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };
      await upsertRecord('laboratory_results', res);
    }
    await upsertRecord('laboratory_orders', { ...resultModalOrder, status: 'Selesai' });
    await pushNotification({
      category: 'Laboratorium',
      title: `Hasil Lab Selesai — ${resultModalOrder.patientName}`,
      message: `Hasil pemeriksaan ${resultModalOrder.orderNumber} telah diinput oleh ${currentUser.displayName}.`,
      severity: 'info',
      targetRoles: ['SUPER_ADMIN', 'DOKTER_SPOG'],
      linkView: 'laboratory'
    });
    setResultModalOrder(null);
    notifyToast('Hasil laboratorium berhasil disimpan.', 'success');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-slate-900">Modul Laboratorium Klinik</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Permintaan pemeriksaan dokter, pencatatan hasil lengkap dengan petugas pemeriksa, satuan &amp; nilai referensi, serta cetak hasil.
        </p>
      </div>

      {/* Create Lab Order */}
      <form onSubmit={handleCreateLabOrder} className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 text-xs">
        <h2 className="text-sm font-bold text-slate-900">Permintaan Pemeriksaan Laboratorium</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="block font-medium text-slate-700 mb-1">Kunjungan Pasien</label>
            <select value={labVisitId} onChange={(e) => setLabVisitId(e.target.value)} className="w-full h-9 px-3 rounded-lg border border-slate-300 bg-white">
              <option value="">-- Pilih Kunjungan --</option>
              {dbState.visits.map((v) => (
                <option key={v.id} value={v.id}>{v.visitDate} · {v.patientName} ({v.patientRm})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block font-medium text-slate-700 mb-1">Catatan Klinis</label>
            <input value={labNotes} onChange={(e) => setLabNotes(e.target.value)} placeholder="Skrining ANC trimester I / evaluasi anemia..." className="w-full h-9 px-3 rounded-lg border border-slate-300" />
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {LAB_TEST_CATALOG.map((t) => {
            const checked = selectedLabCodes.includes(t.code);
            return (
              <label key={t.code} className={`flex items-start gap-2.5 p-3 rounded-lg border cursor-pointer ${checked ? 'border-teal-600 bg-teal-50/50' : 'border-slate-200 hover:bg-slate-50'}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleLabCode(t.code)} className="mt-0.5 rounded border-slate-300 text-teal-700" />
                <div className="min-w-0">
                  <p className="font-semibold text-slate-900 truncate">{t.name}</p>
                  <p className="text-slate-500 font-mono">{formatCurrencyIDR(t.price)} · Ref: {t.referenceRange}</p>
                </div>
              </label>
            );
          })}
        </div>
        <div className="flex justify-end">
          <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">
            Kirim Permintaan Lab ({selectedLabCodes.length} parameter)
          </button>
        </div>
      </form>

      {/* Lab Orders & Results */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200">
          <h2 className="text-sm font-bold text-slate-900">Daftar Permintaan &amp; Hasil Laboratorium</h2>
        </div>
        <div className="divide-y divide-slate-100 text-xs">
          {dbState.laboratory_orders.map((ord) => {
            const results = dbState.laboratory_results.filter((r) => r.orderId === ord.id);
            return (
              <div key={ord.id} className="p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-bold text-slate-900">
                      <span className="font-mono text-teal-800">{ord.orderNumber}</span> · {ord.patientName} ({ord.patientRm})
                    </p>
                    <p className="text-slate-500">Parameter: {ord.tests.map((t) => t.name).join(', ')} · Status: <strong className="text-slate-800">{ord.status}</strong></p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        const draft: Record<string, { value: string; flag: LaboratoryResult['flag'] }> = {};
                        ord.tests.forEach((t) => {
                          const ex = results.find((r) => r.testCode === t.code);
                          draft[t.code] = { value: ex?.resultValue || '', flag: ex?.flag || 'Normal' };
                        });
                        setResultDraft(draft);
                        setResultModalOrder(ord);
                      }}
                      className="px-3 py-1.5 rounded-lg bg-teal-50 text-teal-800 font-semibold hover:bg-teal-100"
                    >
                      Input Hasil Lab
                    </button>
                    {results.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setPrintPayload({
                            type: 'lab',
                            title: 'LAPORAN HASIL LABORATORIUM',
                            subtitle: ord.orderNumber,
                            data: {
                              patientName: ord.patientName,
                              patientRm: ord.patientRm,
                              content: results
                                .map(
                                  (r) =>
                                    `${r.testName}: ${r.resultValue} ${r.unit} [${r.flag}]\n  Rentang Referensi: ${r.referenceRange}\n  Petugas Pemeriksa: ${r.examinerName} (${r.examinedAt.slice(0, 16).replace('T', ' ')})`
                                )
                                .join('\n\n'),
                              signedBy: ord.doctorName
                            }
                          })
                        }
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 font-semibold hover:bg-slate-50"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        Cetak Hasil
                      </button>
                    )}
                  </div>
                </div>
                {results.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 pt-1">
                    {results.map((r) => (
                      <div key={r.id} className="p-2.5 rounded-lg bg-slate-50 border border-slate-200">
                        <p className="font-semibold text-slate-900">{r.testName}</p>
                        <p className="font-mono text-teal-800 font-bold mt-0.5">
                          {r.resultValue} {r.unit} ({r.flag})
                        </p>
                        <p className="text-[11px] text-slate-500">Ref: {r.referenceRange} · Pemeriksa: {r.examinerName}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {dbState.laboratory_orders.length === 0 && (
            <div className="py-10 text-center text-slate-400">
              <FlaskConical className="w-7 h-7 mx-auto mb-2 text-slate-300" />
              Belum ada permintaan laboratorium.
            </div>
          )}
        </div>
      </div>

      {/* Input Lab Results Modal */}
      {resultModalOrder && (
        <div className="fixed inset-0 z-50 bg-slate-900/45 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white border border-slate-200 rounded-xl max-w-xl w-full p-6 space-y-4 text-xs">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Input Hasil Lab — {resultModalOrder.patientName}</h3>
              <button type="button" onClick={() => setResultModalOrder(null)} aria-label="Tutup modal hasil lab"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleSaveLabResults} className="space-y-3">
              {resultModalOrder.tests.map((t) => (
                <div key={t.code} className="p-3 rounded-lg bg-slate-50 border border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-2 items-center">
                  <div>
                    <p className="font-semibold text-slate-900">{t.name}</p>
                    <p className="text-[11px] text-slate-500">Ref: {t.referenceRange} ({t.unit})</p>
                  </div>
                  <input
                    required
                    placeholder="Nilai hasil..."
                    value={resultDraft[t.code]?.value || ''}
                    onChange={(e) =>
                      setResultDraft((prev) => ({
                        ...prev,
                        [t.code]: { ...(prev[t.code] || { flag: 'Normal' }), value: e.target.value }
                      }))
                    }
                    className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white font-mono"
                  />
                  <select
                    value={resultDraft[t.code]?.flag || 'Normal'}
                    onChange={(e) =>
                      setResultDraft((prev) => ({
                        ...prev,
                        [t.code]: { ...(prev[t.code] || { value: '' }), flag: e.target.value as LaboratoryResult['flag'] }
                      }))
                    }
                    className="h-9 px-2.5 rounded-lg border border-slate-300 bg-white"
                  >
                    {['Normal', 'Tinggi', 'Rendah', 'Reaktif', 'Non-Reaktif'].map((fl) => (
                      <option key={fl} value={fl}>{fl}</option>
                    ))}
                  </select>
                </div>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setResultModalOrder(null)} className="px-4 py-2 rounded-lg border border-slate-300 font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white font-semibold hover:bg-teal-800">Simpan Hasil Laboratorium</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
