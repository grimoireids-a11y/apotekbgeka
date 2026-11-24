import type { Patient, PrescriptionItem } from '../types/models';

/**
 * Calculate Estimated Due Date (HPL) using Naegele's Rule: HPHT + 280 days (40 weeks).
 */
export function calculateHplFromHpht(hphtIso: string): string {
  if (!hphtIso) return '';
  const base = new Date(`${hphtIso}T00:00:00Z`);
  if (Number.isNaN(base.getTime())) return '';
  const hpl = new Date(base.getTime() + 280 * 24 * 60 * 60 * 1000);
  return hpl.toISOString().slice(0, 10);
}

/**
 * Calculate Gestational Age (Usia Kehamilan) in weeks + days and trimester from HPHT.
 */
export function calculateGestationalAge(
  hphtIso: string,
  referenceDateIso: string = new Date().toISOString().slice(0, 10)
): { weeks: number; days: number; totalDays: number; trimester: 1 | 2 | 3; label: string } {
  if (!hphtIso) {
    return { weeks: 0, days: 0, totalDays: 0, trimester: 1, label: '0 minggu 0 hari' };
  }
  const hpht = new Date(`${hphtIso}T00:00:00Z`);
  const ref = new Date(`${referenceDateIso}T00:00:00Z`);
  if (Number.isNaN(hpht.getTime()) || Number.isNaN(ref.getTime())) {
    return { weeks: 0, days: 0, totalDays: 0, trimester: 1, label: '0 minggu 0 hari' };
  }
  const diffDays = Math.max(0, Math.floor((ref.getTime() - hpht.getTime()) / (24 * 60 * 60 * 1000)));
  const weeks = Math.floor(diffDays / 7);
  const days = diffDays % 7;
  const trimester: 1 | 2 | 3 = weeks < 14 ? 1 : weeks < 28 ? 2 : 3;
  return {
    weeks,
    days,
    totalDays: diffDays,
    trimester,
    label: `${weeks} minggu ${days} hari`
  };
}

/**
 * Calculate BMI (IMT) and WHO/Asia-Pacific classification.
 */
export function calculateBmi(weightKg: number, heightCm: number): { bmi: number; category: string } {
  if (!weightKg || !heightCm || weightKg <= 0 || heightCm <= 0) {
    return { bmi: 0, category: '-' };
  }
  const heightM = heightCm / 100;
  const bmi = Number((weightKg / (heightM * heightM)).toFixed(1));
  let category = 'Normal';
  if (bmi < 18.5) category = 'Berat Badan Kurang';
  else if (bmi < 23) category = 'Normal';
  else if (bmi < 25) category = 'Berat Badan Lebih';
  else if (bmi < 30) category = 'Obesitas I';
  else category = 'Obesitas II';
  return { bmi, category };
}

/**
 * Estimate Fetal Weight (EFW in grams) using Hadlock (1985) 4-parameter formula
 * Input measurements in millimeters (BPD, HC, AC, FL), converted internally to cm.
 */
export function calculateHadlockEfw(params: {
  bpdMm?: number;
  hcMm?: number;
  acMm?: number;
  flMm?: number;
}): number {
  const { bpdMm = 0, hcMm = 0, acMm = 0, flMm = 0 } = params;
  if (bpdMm <= 0 || hcMm <= 0 || acMm <= 0 || flMm <= 0) return 0;
  const bpd = bpdMm / 10;
  const hc = hcMm / 10;
  const ac = acMm / 10;
  const fl = flMm / 10;
  const log10Efw =
    1.3596 +
    0.0064 * hc +
    0.0424 * ac +
    0.174 * fl +
    0.00061 * bpd * ac -
    0.00386 * ac * fl;
  return Math.round(Math.pow(10, log10Efw));
}

/**
 * Format automatic document/record sequence numbers (RM, Visit, Invoice, Receipt, Rx).
 */
export function formatAutoNumber(prefix: string, seq: number, dateIso?: string): string {
  const padded = String(Math.max(1, seq)).padStart(5, '0');
  if (dateIso) {
    const compactDate = dateIso.replaceAll('-', '').slice(0, 8);
    return `${prefix}-${compactDate}-${padded}`;
  }
  return `${prefix}-${padded}`;
}

export function formatQueueNumber(seq: number): string {
  return `A-${String(Math.max(1, seq)).padStart(3, '0')}`;
}

export function formatCurrencyIDR(amount: number): string {
  const safe = Number.isFinite(amount) ? amount : 0;
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(safe);
}

export function calculateAgeYears(birthDateIso: string, refDateIso: string = new Date().toISOString().slice(0, 10)): number {
  if (!birthDateIso) return 0;
  const dob = new Date(`${birthDateIso}T00:00:00Z`);
  const ref = new Date(`${refDateIso}T00:00:00Z`);
  if (Number.isNaN(dob.getTime()) || Number.isNaN(ref.getTime())) return 0;
  let age = ref.getUTCFullYear() - dob.getUTCFullYear();
  const m = ref.getUTCMonth() - dob.getUTCMonth();
  if (m < 0 || (m === 0 && ref.getUTCDate() < dob.getUTCDate())) {
    age--;
  }
  return Math.max(0, age);
}

/**
 * Detect potential duplicate patient by NIK or Name + Birth Date match.
 */
export function detectDuplicatePatient(
  candidate: { nik?: string; fullName: string; birthDate: string; id?: string },
  existingPatients: Patient[]
): { duplicate: Patient; reason: string } | null {
  const normNik = (candidate.nik || '').replace(/\D/g, '');
  const normName = candidate.fullName.trim().toLowerCase().replace(/\s+/g, ' ');

  for (const p of existingPatients) {
    if (candidate.id && p.id === candidate.id) continue;
    const existingNik = (p.nik || '').replace(/\D/g, '');
    if (normNik.length >= 12 && existingNik && existingNik === normNik) {
      return { duplicate: p, reason: `NIK (${normNik}) sudah terdaftar atas nama ${p.fullName} (${p.rmNumber})` };
    }
    const existingName = p.fullName.trim().toLowerCase().replace(/\s+/g, ' ');
    if (normName && existingName === normName && candidate.birthDate && p.birthDate === candidate.birthDate) {
      return { duplicate: p, reason: `Nama lengkap & tanggal lahir cocok dengan pasien ${p.fullName} (${p.rmNumber})` };
    }
  }
  return null;
}

/**
 * Validated clinical drug-interaction pairs and pregnancy/allergy alert rules for OBGYN practice.
 */
const DRUG_INTERACTION_RULES: { a: string; b: string; warning: string }[] = [
  {
    a: 'ferrous',
    b: 'calcium',
    warning: 'Interaksi Absorpsi: Zat Besi (Ferrous) dan Kalsium sebaiknya diminum terpisah minimal 2 jam agar penyerapan besi optimal.'
  },
  {
    a: 'asam mefenamat',
    b: 'aspirin',
    warning: 'Interaksi NSAID: Penggunaan bersamaan Asam Mefenamat dan Aspirin meningkatkan risiko iritasi lambung & perdarahan.'
  },
  {
    a: 'nifedipine',
    b: 'magnesium',
    warning: 'Peringatan Obstetri: Nifedipine + Magnesium Sulfat berisiko hipotensi berat dan blokade neuromuskular.'
  },
  {
    a: 'metronidazole',
    b: 'warfarin',
    warning: 'Interaksi Mayor: Metronidazole dapat meningkatkan efek antikoagulan Warfarin.'
  },
  {
    a: 'amoxicillin',
    b: 'methotrexate',
    warning: 'Interaksi Mayor: Penisilin dapat menurunkan ekskresi Methotrexate dan meningkatkan toksisitas.'
  }
];

export function checkPrescriptionSafety(
  items: PrescriptionItem[],
  patientAllergiesText: string
): { interactionWarnings: string[]; allergyWarnings: string[] } {
  const interactionWarnings: string[] = [];
  const allergyWarnings: string[] = [];

  const lowerNames = items.map((i) => `${i.medicineName} ${i.genericName}`.toLowerCase());

  for (const rule of DRUG_INTERACTION_RULES) {
    const hasA = lowerNames.some((n) => n.includes(rule.a));
    const hasB = lowerNames.some((n) => n.includes(rule.b));
    if (hasA && hasB) {
      interactionWarnings.push(rule.warning);
    }
  }

  const allergyTokens = patientAllergiesText
    .toLowerCase()
    .split(/[,;/\n]+/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 3 && t !== 'tidak ada' && t !== 'none' && t !== '-');

  for (const item of items) {
    const combined = `${item.medicineName} ${item.genericName}`.toLowerCase();
    for (const token of allergyTokens) {
      if (combined.includes(token) || (token.includes('penisilin') && combined.includes('amoxicillin'))) {
        allergyWarnings.push(
          `Peringatan Alergi: Obat "${item.medicineName}" (${item.genericName}) berpotensi memicu alergi pasien ("${token}").`
        );
      }
    }
  }

  return { interactionWarnings, allergyWarnings };
}

/**
 * Financial invoice total & cash session variance math.
 */
export function calculateInvoiceTotals(
  items: { qty: number; unitPrice: number }[],
  discountAmount: number = 0,
  taxPercent: number = 0,
  paidAmount: number = 0
): { subtotal: number; discount: number; tax: number; total: number; remaining: number } {
  const subtotal = items.reduce((sum, item) => sum + Math.max(0, item.qty) * Math.max(0, item.unitPrice), 0);
  const discount = Math.min(subtotal, Math.max(0, discountAmount));
  const taxable = Math.max(0, subtotal - discount);
  const tax = Math.round((taxable * Math.max(0, taxPercent)) / 100);
  const total = taxable + tax;
  const remaining = Math.max(0, total - Math.max(0, paidAmount));
  return { subtotal, discount, tax, total, remaining };
}

export function calculateCashSessionVariance(
  openingBalance: number,
  cashInTotal: number,
  cashOutTotal: number,
  actualClosingBalance: number
): { expectedBalance: number; variance: number } {
  const expectedBalance = openingBalance + cashInTotal - cashOutTotal;
  const variance = actualClosingBalance - expectedBalance;
  return { expectedBalance, variance };
}

/**
 * Build a SATUSEHAT-ready HL7 FHIR R4 Patient Resource preview.
 */
export function buildFhirPatientPreview(patient: Patient, organizationId: string) {
  return {
    resourceType: 'Patient',
    meta: {
      profile: ['https://fhir.kemkes.go.id/r4/StructureDefinition/Patient']
    },
    identifier: [
      {
        use: 'official',
        system: 'https://fhir.kemkes.go.id/id/nik',
        value: patient.nik || 'UNSPECIFIED'
      },
      {
        use: 'usual',
        system: `https://fhir.kemkes.go.id/id/rm/${organizationId || 'ORG-LOCAL'}`,
        value: patient.rmNumber
      }
    ],
    active: patient.active,
    name: [{ use: 'official', text: patient.fullName }],
    gender: patient.gender === 'Perempuan' ? 'female' : 'male',
    birthDate: patient.birthDate,
    telecom: [
      ...(patient.phone ? [{ system: 'phone', value: patient.phone, use: 'mobile' }] : []),
      ...(patient.email ? [{ system: 'email', value: patient.email }] : [])
    ],
    address: patient.address ? [{ use: 'home', text: patient.address, country: 'ID' }] : []
  };
}

/**
 * Export tabular rows to CSV string (Excel-compatible UTF-8 BOM).
 */
export function exportRowsToCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (value: string | number | boolean | null | undefined) => {
    const str = String(value ?? '');
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replaceAll('"', '""')}"`;
    }
    return str;
  };
  const lines = [
    headers.map(escapeCell).join(','),
    ...rows.map((r) => r.map(escapeCell).join(','))
  ];
  return `\uFEFF${lines.join('\r\n')}`;
}
