import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBmi,
  calculateCashSessionVariance,
  calculateGestationalAge,
  calculateHadlockEfw,
  calculateHplFromHpht,
  calculateInvoiceTotals,
  checkPrescriptionSafety,
  detectDuplicatePatient,
  formatAutoNumber,
  formatQueueNumber
} from './obstetrics';
import {
  computeElectronicSignatureHash,
  decryptRecordFields,
  deriveUserKek,
  encryptRecordFields,
  generateRandomBase64,
  generateVaultKey,
  unwrapVaultKeyForAccount,
  wrapVaultKeyForAccount
} from './cryptoE2EE';
import {
  canAccessView,
  canApproveRefund,
  canEditMedicalRecord,
  canModifyProcessedPayment,
  hasPermission
} from './rbac';
import type { Patient, PrescriptionItem } from '../types/models';

test('Naegele rule calculates HPL (+280 days) and gestational age accurately', () => {
  assert.equal(calculateHplFromHpht('2026-01-01'), '2026-10-08');
  const ga = calculateGestationalAge('2026-01-01', '2026-06-03');
  assert.equal(ga.weeks, 21);
  assert.equal(ga.days, 6);
  assert.equal(ga.trimester, 2);
});

test('BMI (IMT) and Hadlock EFW calculations produce valid obstetric outputs', () => {
  const bmiRes = calculateBmi(60, 160);
  assert.equal(bmiRes.bmi, 23.4);
  assert.equal(bmiRes.category, 'Berat Badan Lebih');

  // 32-week typical fetal biometry in mm
  const efw = calculateHadlockEfw({ bpdMm: 81, hcMm: 295, acMm: 280, flMm: 62 });
  assert.ok(efw > 1700 && efw < 2200, `Expected EFW ~1900g, got ${efw}`);
});

test('Auto-numbering and duplicate patient detection work accurately', () => {
  assert.equal(formatAutoNumber('RM', 42), 'RM-00042');
  assert.equal(formatQueueNumber(7), 'A-007');

  const existing: Patient[] = [
    {
      id: 'pat-1',
      rmNumber: 'RM-00001',
      nik: '3201015505940001',
      fullName: 'Dewi Anggraini',
      birthPlace: 'Bandung',
      birthDate: '1994-05-15',
      gender: 'Perempuan',
      address: 'Jl. Merdeka 10',
      phone: '081234567890',
      email: 'dewi@example.com',
      occupation: 'Guru',
      maritalStatus: 'Menikah',
      spouseName: 'Budi',
      familyPhone: '081200000001',
      emergencyContact: 'Budi - 081200000001',
      bloodType: 'O+',
      allergies: 'Penisilin',
      medicalHistory: '-',
      surgicalHistory: '-',
      medicationHistory: '-',
      consentGiven: true,
      active: true,
      createdAt: '2026-01-01T00:00:00Z',
      createdBy: 'u1',
      updatedAt: '2026-01-01T00:00:00Z',
      updatedBy: 'u1'
    }
  ];

  const dupByNik = detectDuplicatePatient(
    { nik: '3201015505940001', fullName: 'Nama Lain', birthDate: '1999-01-01' },
    existing
  );
  assert.ok(dupByNik !== null);
  assert.equal(dupByNik?.duplicate.id, 'pat-1');

  const dupByNameDob = detectDuplicatePatient(
    { nik: '', fullName: 'dewi   anggraini', birthDate: '1994-05-15' },
    existing
  );
  assert.ok(dupByNameDob !== null);
});

test('Drug interaction and patient allergy safety checker flags clinical risks', () => {
  const rxItems: PrescriptionItem[] = [
    {
      medicineId: 'm1',
      medicineName: 'Ferrous Sulfate 200mg',
      genericName: 'Ferrous Sulfate',
      dosage: '1 tab',
      frequency: '1x1',
      quantity: 30,
      unit: 'Tablet',
      unitPrice: 1500,
      route: 'Oral',
      duration: '30 hari',
      instructions: 'Sesudah makan'
    },
    {
      medicineId: 'm2',
      medicineName: 'Kalk / Calcium Lactate 500mg',
      genericName: 'Calcium Lactate',
      dosage: '1 tab',
      frequency: '1x1',
      quantity: 30,
      unit: 'Tablet',
      unitPrice: 1200,
      route: 'Oral',
      duration: '30 hari',
      instructions: 'Pagi hari'
    },
    {
      medicineId: 'm3',
      medicineName: 'Amoxicillin 500mg',
      genericName: 'Amoxicillin',
      dosage: '1 kap',
      frequency: '3x1',
      quantity: 15,
      unit: 'Kapsul',
      unitPrice: 2500,
      route: 'Oral',
      duration: '5 hari',
      instructions: 'Habiskan'
    }
  ];

  const safety = checkPrescriptionSafety(rxItems, 'Penisilin, Debu');
  assert.equal(safety.interactionWarnings.length, 1);
  assert.equal(safety.allergyWarnings.length, 1);
});

test('Billing invoice totals and cash session variance compute accurately', () => {
  const totals = calculateInvoiceTotals(
    [
      { qty: 1, unitPrice: 250000 },
      { qty: 1, unitPrice: 350000 }
    ],
    50000,
    0,
    300000
  );
  assert.equal(totals.subtotal, 600000);
  assert.equal(totals.total, 550000);
  assert.equal(totals.remaining, 250000);

  const session = calculateCashSessionVariance(500000, 1250000, 200000, 1545000);
  assert.equal(session.expectedBalance, 1550000);
  assert.equal(session.variance, -5000);
});

test('E2EE Web Crypto engine wraps keys per user account and encrypts/decrypts clinical fields', async () => {
  const vault = await generateVaultKey();
  const saltSuperAdmin = generateRandomBase64(16);
  const saltDoctor = generateRandomBase64(16);

  const adminKek = await deriveUserKek('superman123', saltSuperAdmin);
  const doctorKek = await deriveUserKek('dokter123', saltDoctor);

  const wrappedAdmin = await wrapVaultKeyForAccount(vault.key, adminKek);
  const wrappedDoctor = await wrapVaultKeyForAccount(vault.key, doctorKek);

  const unwrappedByDoctor = await unwrapVaultKeyForAccount(wrappedDoctor, doctorKek);
  assert.equal(unwrappedByDoctor.fingerprint, vault.fingerprint);

  const unwrappedByAdmin = await unwrapVaultKeyForAccount(wrappedAdmin, adminKek);
  assert.equal(unwrappedByAdmin.fingerprint, vault.fingerprint);

  const sensitivePatient = {
    id: 'pat-e2ee',
    fullName: 'Siti Rahma',
    nik: '3273015501950002',
    phone: '081399887766',
    allergies: 'Sulfa'
  };

  const encrypted = await encryptRecordFields(
    sensitivePatient,
    ['nik', 'phone', 'allergies'],
    unwrappedByAdmin.key,
    vault.fingerprint
  );
  assert.ok(encrypted.nik.startsWith('E2EE::'));
  assert.notEqual(encrypted.nik, sensitivePatient.nik);
  assert.ok(encrypted.e2ee.nik.__e2ee === true);

  const decrypted = await decryptRecordFields(encrypted, unwrappedByDoctor.key);
  assert.equal(decrypted.nik, '3273015501950002');
  assert.equal(decrypted.phone, '081399887766');
  assert.equal(decrypted.allergies, 'Sulfa');

  const sig = await computeElectronicSignatureHash({
    recordId: 'rme-1',
    patientId: 'pat-1',
    doctorId: 'doc-1',
    signedAt: '2026-11-24T10:00:00Z',
    summary: 'O80 Persalinan normal'
  });
  assert.equal(sig.length, 32);
});

test('RBAC strictly separates medical authority from cashier authority', () => {
  // Assistant CANNOT write/sign RME or write prescriptions or approve refunds
  assert.equal(hasPermission('ASISTEN_DOKTER', 'rme.write'), false);
  assert.equal(hasPermission('ASISTEN_DOKTER', 'rme.sign_lock'), false);
  assert.equal(hasPermission('ASISTEN_DOKTER', 'prescriptions.write'), false);
  assert.equal(canEditMedicalRecord('ASISTEN_DOKTER', 'draft'), false);
  assert.equal(canApproveRefund('ASISTEN_DOKTER'), false);
  assert.equal(canModifyProcessedPayment('ASISTEN_DOKTER'), true);

  // Doctor CANNOT edit processed payments or access cashier / super admin settings
  assert.equal(hasPermission('DOKTER_SPOG', 'rme.sign_lock'), true);
  assert.equal(hasPermission('DOKTER_SPOG', 'cashier.operate'), false);
  assert.equal(canModifyProcessedPayment('DOKTER_SPOG'), false);
  assert.equal(canEditMedicalRecord('DOKTER_SPOG', 'draft'), true);
  assert.equal(canEditMedicalRecord('DOKTER_SPOG', 'locked'), false);
  assert.equal(canAccessView('DOKTER_SPOG', 'cashier'), false);
  assert.equal(canAccessView('DOKTER_SPOG', 'settings-audit'), false);

  // Super Admin has full access including refund approval and locked RME governance
  assert.equal(canApproveRefund('SUPER_ADMIN'), true);
  assert.equal(canEditMedicalRecord('SUPER_ADMIN', 'locked'), true);
  assert.equal(canAccessView('SUPER_ADMIN', 'settings-audit'), true);
});
