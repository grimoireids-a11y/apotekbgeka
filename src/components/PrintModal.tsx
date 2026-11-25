import React, { useEffect, useState } from 'react';
import { PenTool, Printer, X } from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import { formatCurrencyIDR } from '../utils/obstetrics';
import { DEFAULT_LOGO_PATH } from '../data/defaults';
import { ROLE_LABELS } from '../utils/rbac';

type SignerMode = 'practiceDoctor' | 'currentUser';

export const PrintModal: React.FC = () => {
  const { printPayload, setPrintPayload, practice, systemSettings, currentUser, dbState } = usePractice();
  const [signerMode, setSignerMode] = useState<SignerMode>('practiceDoctor');

  useEffect(() => {
    if (!printPayload) return;
    if (
      printPayload.type === 'kuitansi' ||
      printPayload.type === 'laporan' ||
      currentUser?.role === 'DOKTER_SPOG'
    ) {
      setSignerMode('currentUser');
    } else {
      setSignerMode('practiceDoctor');
    }
  }, [printPayload, currentUser?.role]);

  if (!printPayload) return null;

  const data = printPayload.data;

  const doctorFullName = practice.doctorTitle
    ? `${practice.doctorName}, ${practice.doctorTitle}`
    : practice.doctorName;

  const matchingDoctorUser = dbState.users.find(
    (u) =>
      u.role === 'DOKTER_SPOG' &&
      (u.signatureUrl ||
        u.displayName.toLowerCase().includes(practice.doctorName.toLowerCase().replace(/^dr\.\s*/i, '').trim()))
  );

  const resolveSigner = (fallbackHeading: string) => {
    if (signerMode === 'currentUser' && currentUser) {
      const signatureUrl =
        currentUser.signatureUrl ||
        (currentUser.role === 'DOKTER_SPOG' ? practice.doctorSignatureUrl : '') ||
        '';
      const strNum = currentUser.strNumber || (currentUser.role === 'DOKTER_SPOG' ? practice.strNumber : '');
      const sipNum = currentUser.sipNumber || (currentUser.role === 'DOKTER_SPOG' ? practice.sipNumber : '');
      const credentials = [strNum ? `STR: ${strNum}` : '', sipNum ? `SIP: ${sipNum}` : '']
        .filter(Boolean)
        .join(' · ');
      return {
        heading:
          printPayload.type === 'kuitansi'
            ? 'Petugas Kasir / Penerbit,'
            : currentUser.role === 'DOKTER_SPOG'
            ? fallbackHeading
            : `${ROLE_LABELS[currentUser.role]},`,
        name: currentUser.displayName,
        roleLabel: ROLE_LABELS[currentUser.role],
        credentials,
        signatureUrl
      };
    }

    const signatureUrl =
      practice.doctorSignatureUrl ||
      matchingDoctorUser?.signatureUrl ||
      (currentUser?.role === 'DOKTER_SPOG' ? currentUser.signatureUrl : '') ||
      '';
    const credentials = [
      practice.strNumber ? `STR: ${practice.strNumber}` : '',
      practice.sipNumber ? `SIP: ${practice.sipNumber}` : ''
    ]
      .filter(Boolean)
      .join(' · ');

    return {
      heading: fallbackHeading,
      name: doctorFullName || String(data.doctorName || data.verifiedByName || data.signedBy || '-'),
      roleLabel: 'Dokter Penanggung Jawab Praktik',
      credentials,
      signatureUrl
    };
  };

  const renderSignatureBlock = (fallbackHeading: string) => {
    const signer = resolveSigner(fallbackHeading);
    const issuedTimestamp = new Date().toLocaleString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    return (
      <div className="text-center min-w-[220px] shrink-0">
        <p className="text-xs text-slate-700">{signer.heading}</p>
        <div className="h-20 flex items-center justify-center my-1.5">
          {signer.signatureUrl ? (
            <img
              src={signer.signatureUrl}
              alt={`Tanda tangan ${signer.name}`}
              referrerPolicy="no-referrer"
              className="max-h-16 max-w-[190px] object-contain mx-auto"
            />
          ) : (
            <div className="w-40 border-b border-dashed border-slate-300 pt-10 text-[10px] text-slate-400">
              (Tanda Tangan)
            </div>
          )}
        </div>
        <p className="font-bold text-slate-900 text-xs underline decoration-slate-400 underline-offset-2">
          {signer.name}
        </p>
        <p className="text-[11px] text-slate-600 mt-0.5">{signer.roleLabel}</p>
        {signer.credentials && (
          <p className="text-[10px] font-mono text-slate-500 mt-0.5">{signer.credentials}</p>
        )}
        <p className="text-[10px] text-slate-400 font-mono mt-1">
          Diterbitkan: {issuedTimestamp}
        </p>
        {!signer.signatureUrl && (
          <p className="text-[10px] text-amber-700 mt-1 no-print">
            Belum ada gambar TTD. Atur di menu &quot;Tanda Tangan Saya&quot; atau Identitas Praktik.
          </p>
        )}
      </div>
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-label={`Pratinjau Cetak ${printPayload.title}`}
    >
      <div className="bg-white border border-slate-200 rounded-xl max-w-3xl w-full my-8 overflow-hidden shadow-xl">
        {/* Toolbar */}
        <div className="px-6 py-3.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 no-print">
          <div>
            <h3 className="text-sm font-bold text-slate-900">Pratinjau Cetak — {printPayload.title}</h3>
            <p className="text-xs text-slate-500">
              Kop surat &amp; tanda tangan otomatis mengikuti data identitas praktik dan pengguna aktif.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {/* Signer Selector */}
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white p-0.5 text-[11px]">
              <span className="px-2 text-slate-500 inline-flex items-center gap-1">
                <PenTool className="w-3 h-3 text-teal-700" />
                TTD:
              </span>
              <button
                type="button"
                onClick={() => setSignerMode('practiceDoctor')}
                className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                  signerMode === 'practiceDoctor'
                    ? 'bg-teal-700 text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                Dokter Praktik
              </button>
              {currentUser && (
                <button
                  type="button"
                  onClick={() => setSignerMode('currentUser')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors max-w-[160px] truncate ${
                    signerMode === 'currentUser'
                      ? 'bg-teal-700 text-white'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  User Login ({currentUser.displayName})
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              <Printer className="w-3.5 h-3.5" />
              Cetak / Simpan PDF
            </button>
            <button
              type="button"
              onClick={() => setPrintPayload(null)}
              aria-label="Tutup pratinjau cetak"
              className="p-2 rounded-lg text-slate-500 hover:bg-slate-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Sheet */}
        <div className="p-8 space-y-6 text-slate-900 bg-white">
          {/* Official Practice Letterhead (Always Live Practice Identity) */}
          <div className="flex items-start justify-between gap-6 pb-5 border-b-2 border-teal-700">
            <div className="flex items-start gap-4">
              <img
                src={practice.logoUrl || DEFAULT_LOGO_PATH}
                alt="Logo Praktik"
                referrerPolicy="no-referrer"
                className="w-16 h-16 object-contain rounded-lg border border-slate-200 p-1 shrink-0"
              />
              <div>
                <h1 className="text-lg font-bold tracking-tight text-slate-900">
                  {practice.practiceName}
                </h1>
                <p className="text-sm font-semibold text-teal-800">{doctorFullName}</p>
                {(practice.strNumber || practice.sipNumber) && (
                  <p className="text-xs text-slate-600 mt-0.5 font-mono">
                    {[
                      practice.strNumber ? `STR: ${practice.strNumber}` : '',
                      practice.sipNumber ? `SIP: ${practice.sipNumber}` : ''
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                )}
                {practice.address && (
                  <p className="text-xs text-slate-600 mt-0.5">{practice.address}</p>
                )}
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {[
                    practice.phone ? `Telp/WA: ${practice.phone}` : '',
                    practice.email ? `Email: ${practice.email}` : '',
                    practice.operationalHours ? `Jam Praktik: ${practice.operationalHours}` : ''
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-bold uppercase tracking-wider text-teal-800">
                {printPayload.title}
              </p>
              {printPayload.subtitle && (
                <p className="text-xs font-mono tabular-nums text-slate-600 mt-1">
                  {printPayload.subtitle}
                </p>
              )}
              <p className="text-xs text-slate-500 mt-1 font-mono tabular-nums">
                {new Date().toLocaleDateString('id-ID', {
                  day: '2-digit',
                  month: 'long',
                  year: 'numeric'
                })}
              </p>
            </div>
          </div>

          {/* Kuitansi Body */}
          {printPayload.type === 'kuitansi' && (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-slate-500">Pasien</p>
                  <p className="font-semibold text-slate-900">{String(data.patientName || '-')}</p>
                  <p className="font-mono text-slate-600">No. RM: {String(data.patientRm || '-')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">No. Kuitansi / Tagihan</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {String(data.receiptNumber || '-')}
                  </p>
                  <p className="text-slate-600">Metode: {String(data.method || '-')}</p>
                </div>
              </div>

              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 text-slate-500">
                    <th className="py-2 text-left font-semibold">Rincian Layanan / Obat</th>
                    <th className="py-2 text-center font-semibold">Qty</th>
                    <th className="py-2 text-right font-semibold">Harga Satuan</th>
                    <th className="py-2 text-right font-semibold">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {(
                    (data.items as {
                      description: string;
                      qty: number;
                      unitPrice: number;
                      total: number;
                    }[]) || []
                  ).map((it, idx) => (
                    <tr key={idx}>
                      <td className="py-2.5 text-slate-900">{it.description}</td>
                      <td className="py-2.5 text-center font-mono tabular-nums">{it.qty}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums">
                        {formatCurrencyIDR(it.unitPrice)}
                      </td>
                      <td className="py-2.5 text-right font-mono tabular-nums font-medium">
                        {formatCurrencyIDR(it.total)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end">
                <div className="w-72 space-y-1.5 text-xs border-t border-slate-200 pt-3">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Subtotal</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrencyIDR(Number(data.subtotal || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Diskon</span>
                    <span className="font-mono tabular-nums">
                      -{formatCurrencyIDR(Number(data.discount || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1 border-t border-slate-200">
                    <span>Total Tagihan</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrencyIDR(Number(data.total || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between text-emerald-700 font-semibold">
                    <span>Dibayar</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrencyIDR(Number(data.amount || 0))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Sisa Tagihan</span>
                    <span className="font-mono tabular-nums">
                      {formatCurrencyIDR(Number(data.remainingAmount || 0))}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-between items-end gap-6 pt-6 text-xs text-slate-600">
                <p className="max-w-md italic">{systemSettings.templates.kuitansiFooter}</p>
                {renderSignatureBlock('Petugas Kasir / Penanggung Jawab,')}
              </div>
            </div>
          )}

          {/* Resep Body */}
          {printPayload.type === 'resep' && (
            <div className="space-y-5 text-xs">
              <p className="italic text-slate-600">{systemSettings.templates.resepHeaderNote}</p>
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-slate-500">Nama Pasien</p>
                  <p className="font-semibold text-slate-900">{String(data.patientName || '-')}</p>
                  <p className="font-mono text-slate-600">No. RM: {String(data.patientRm || '-')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">No. Resep</p>
                  <p className="font-mono font-semibold text-slate-900">
                    {String(data.rxNumber || '-')}
                  </p>
                  <p className="text-slate-600">Status: {String(data.status || '-')}</p>
                </div>
              </div>
              <div className="space-y-3">
                {(
                  (data.items as {
                    medicineName: string;
                    dosage: string;
                    frequency: string;
                    quantity: number;
                    unit: string;
                    route: string;
                    duration: string;
                    instructions: string;
                  }[]) || []
                ).map((it, idx) => (
                  <div key={idx} className="p-3.5 border border-slate-200 rounded-lg">
                    <p className="font-bold text-sm text-slate-900">
                      R/ {it.medicineName} — No. {it.quantity} ({it.unit})
                    </p>
                    <p className="text-slate-700 mt-1">
                      S {it.frequency} ({it.dosage}) · {it.route} · Lama: {it.duration}
                    </p>
                    {it.instructions && (
                      <p className="text-slate-500 mt-0.5">Catatan: {it.instructions}</p>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex justify-end pt-6">
                {renderSignatureBlock('Dokter Penanggung Jawab,')}
              </div>
            </div>
          )}

          {/* USG Report Body */}
          {printPayload.type === 'usg' && (
            <div className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                <div>
                  <p className="text-slate-500">Pasien</p>
                  <p className="font-semibold text-slate-900">{String(data.patientName || '-')}</p>
                  <p className="font-mono text-slate-600">No. RM: {String(data.patientRm || '-')}</p>
                </div>
                <div className="text-right">
                  <p className="text-slate-500">Jenis Pemeriksaan</p>
                  <p className="font-semibold text-teal-800">{String(data.examType || '-')}</p>
                  <p className="font-mono text-slate-600">Tanggal: {String(data.examDate || '-')}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {Boolean(data.gestationalAge) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">Usia Kehamilan</p>
                    <p className="font-semibold font-mono">{String(data.gestationalAge)}</p>
                  </div>
                )}
                {Boolean(data.bpdMm) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">BPD / HC</p>
                    <p className="font-semibold font-mono">
                      {String(data.bpdMm)} mm / {String(data.hcMm || '-')} mm
                    </p>
                  </div>
                )}
                {Boolean(data.acMm) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">AC / FL</p>
                    <p className="font-semibold font-mono">
                      {String(data.acMm)} mm / {String(data.flMm || '-')} mm
                    </p>
                  </div>
                )}
                {Boolean(data.efwGrams) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">Taksiran Berat Janin (EFW)</p>
                    <p className="font-semibold font-mono">{String(data.efwGrams)} gram</p>
                  </div>
                )}
                {Boolean(data.fhrBpm) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">DJJ (FHR)</p>
                    <p className="font-semibold font-mono">{String(data.fhrBpm)} dpm</p>
                  </div>
                )}
                {Boolean(data.placenta) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">Plasenta &amp; Ketuban</p>
                    <p className="font-medium">
                      {String(data.placenta)} · {String(data.amnioticFluid || '-')}
                    </p>
                  </div>
                )}
                {Boolean(data.uterusSize) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">Uterus &amp; Endometrium</p>
                    <p className="font-medium">
                      {String(data.uterusSize)} · Endo {String(data.endometriumThicknessMm || '-')} mm
                    </p>
                  </div>
                )}
                {Boolean(data.rightOvary) && (
                  <div className="p-3 border border-slate-200 rounded-lg">
                    <p className="text-slate-500">Ovarium Kanan / Kiri</p>
                    <p className="font-medium">
                      Ka: {String(data.rightOvary)} · Ki: {String(data.leftOvary || '-')}
                    </p>
                  </div>
                )}
              </div>

              <div className="p-4 border border-slate-200 rounded-lg bg-slate-50">
                <p className="font-semibold text-slate-900 mb-1">Kesimpulan Pemeriksaan USG:</p>
                <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">
                  {String(data.conclusion || '-')}
                </p>
              </div>

              <div className="flex justify-between items-end gap-6 pt-4">
                <p className="max-w-md text-[11px] text-slate-500 italic">
                  {systemSettings.templates.usgDisclaimer}
                </p>
                {renderSignatureBlock('Verifikasi Dokter Sp.OG,')}
              </div>
            </div>
          )}

          {/* Generic Document / Lab / Surat Keterangan / Rujukan / RME / Laporan */}
          {!['kuitansi', 'resep', 'usg'].includes(printPayload.type) && (
            <div className="space-y-4 text-xs">
              {Boolean(data.patientName) && (
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                  <div>
                    <p className="text-slate-500">Nama Pasien</p>
                    <p className="font-semibold text-slate-900">{String(data.patientName)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-slate-500">Nomor Rekam Medis</p>
                    <p className="font-mono font-semibold text-slate-900">
                      {String(data.patientRm || '-')}
                    </p>
                  </div>
                </div>
              )}
              <div className="p-4 border border-slate-200 rounded-lg whitespace-pre-wrap leading-relaxed text-slate-800">
                {String(data.content || JSON.stringify(data, null, 2))}
              </div>
              <div className="flex justify-between items-end gap-6 pt-6">
                <p className="max-w-md text-[11px] text-slate-500 italic">
                  {systemSettings.templates.laporanFooter}
                </p>
                {renderSignatureBlock('Dokter Pemeriksa / Penanggung Jawab,')}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
