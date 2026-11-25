import React, { useEffect, useState } from 'react';
import { Clock, LogOut, RefreshCw, ShieldAlert, Stethoscope, UserCheck } from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import type { RoleCode } from '../types/models';
import { ROLE_LABELS } from '../utils/rbac';

export const PendingApprovalScreen: React.FC = () => {
  const { pendingAccessRequest, logout, resubmitAccessRequest, practice } = usePractice();
  const [displayName, setDisplayName] = useState(pendingAccessRequest?.displayName || '');
  const [requestedRole, setRequestedRole] = useState<RoleCode>(
    pendingAccessRequest?.requestedRole || 'DOKTER_SPOG'
  );
  const [requestedNote, setRequestedNote] = useState(pendingAccessRequest?.requestedNote || '');
  const [resubmitting, setResubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!pendingAccessRequest) return;
    setDisplayName(pendingAccessRequest.displayName || '');
    setRequestedRole(pendingAccessRequest.requestedRole || 'DOKTER_SPOG');
    setRequestedNote(pendingAccessRequest.requestedNote || '');
  }, [pendingAccessRequest]);

  if (!pendingAccessRequest) return null;

  const isRejected = pendingAccessRequest.status === 'rejected';
  const isApproved = pendingAccessRequest.status === 'approved';

  const handleResubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!displayName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    setResubmitting(true);
    try {
      await resubmitAccessRequest({
        displayName: displayName.trim(),
        requestedRole,
        requestedNote: requestedNote.trim()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengirim ulang permintaan akses.');
    } finally {
      setResubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
        {/* Top Bar */}
        <div className="px-6 py-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-teal-700 text-white flex items-center justify-center shrink-0">
              <Stethoscope className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-bold text-slate-900 truncate">{practice.practiceName}</p>
              <p className="text-[11px] text-slate-500">Verifikasi Akses &amp; Penentuan Role</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 shrink-0"
          >
            <LogOut className="w-3.5 h-3.5" />
            Keluar
          </button>
        </div>

        <div className="p-6 sm:p-7 space-y-6">
          {/* Status Header */}
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                isRejected
                  ? 'bg-red-50 text-red-600 border border-red-200'
                  : isApproved
                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border border-amber-200'
              }`}
            >
              {isRejected ? (
                <ShieldAlert className="w-6 h-6" />
              ) : isApproved ? (
                <UserCheck className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>
            <div className="space-y-1">
              <h1 className="text-lg font-bold text-slate-900">
                {isRejected
                  ? 'Permintaan Akses Ditolak'
                  : isApproved
                  ? 'Akun Disetujui, Membuka Sistem...'
                  : 'Menunggu Persetujuan Super Admin'}
              </h1>
              <p className="text-sm text-slate-600 leading-relaxed">
                {isRejected
                  ? 'Super Admin belum menyetujui permintaan akses akun Anda. Periksa catatan di bawah atau ajukan ulang.'
                  : isApproved
                  ? 'Role akun Anda telah ditetapkan. Sistem sedang membuka sesi praktik Anda secara otomatis.'
                  : 'Akun Anda berhasil terdaftar dan menunggu verifikasi Super Admin untuk persetujuan serta penentuan role. Halaman ini akan masuk otomatis begitu disetujui.'}
              </p>
            </div>
          </div>

          {/* Account Info Summary */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs">
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Nama Lengkap</span>
              <span className="font-semibold text-slate-900 text-right">{pendingAccessRequest.displayName}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Email Terdaftar</span>
              <span className="font-mono text-slate-800 text-right break-all">{pendingAccessRequest.email}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Metode Autentikasi</span>
              <span className="font-medium text-slate-800">
                {pendingAccessRequest.authProvider === 'google' ? 'Google Firebase' : 'Email & Kata Sandi'}
              </span>
            </div>
            {pendingAccessRequest.requestedRole && (
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Usulan Role</span>
                <span className="font-medium text-teal-800">
                  {ROLE_LABELS[pendingAccessRequest.requestedRole]}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Waktu Pengajuan</span>
              <span className="font-mono tabular-nums text-slate-700">
                {new Date(pendingAccessRequest.createdAt).toLocaleString('id-ID')}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 pt-1.5 border-t border-slate-200">
              <span className="text-slate-500">Status Persetujuan</span>
              <span
                className={`font-semibold ${
                  isRejected ? 'text-red-700' : isApproved ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {isRejected ? 'Ditolak' : isApproved ? 'Disetujui' : 'Menunggu Verifikasi Super Admin'}
              </span>
            </div>
          </div>

          {/* Rejection Reason + Resubmit Form */}
          {isRejected && (
            <div className="space-y-4">
              {pendingAccessRequest.rejectionReason && (
                <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-xs text-red-800">
                  <p className="font-semibold mb-0.5">Alasan Penolakan:</p>
                  <p>{pendingAccessRequest.rejectionReason}</p>
                </div>
              )}

              {error && (
                <div role="alert" className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                  {error}
                </div>
              )}

              <form onSubmit={handleResubmit} className="space-y-3 pt-2 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-800">Ajukan Ulang Permintaan Akses</p>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Nama Lengkap &amp; Gelar</label>
                  <input
                    type="text"
                    required
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Usulan Role (Keputusan akhir oleh Super Admin)
                  </label>
                  <select
                    value={requestedRole}
                    onChange={(e) => setRequestedRole(e.target.value as RoleCode)}
                    className="w-full h-9 px-3 text-xs border border-slate-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-teal-600"
                  >
                    <option value="DOKTER_SPOG">Dokter Sp.OG</option>
                    <option value="ASISTEN_DOKTER">Asisten Dokter</option>
                    <option value="SUPER_ADMIN">Super Admin</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">
                    Catatan untuk Super Admin
                  </label>
                  <textarea
                    rows={2}
                    value={requestedNote}
                    onChange={(e) => setRequestedNote(e.target.value)}
                    placeholder="Contoh: Dokter jaga sore / No. STR / keterangan tugas"
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-600"
                  />
                </div>
                <button
                  type="submit"
                  disabled={resubmitting}
                  className="w-full h-10 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 transition-colors"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${resubmitting ? 'animate-spin' : ''}`} />
                  {resubmitting ? 'Mengirim Ulang...' : 'Kirim Ulang Permintaan Persetujuan'}
                </button>
              </form>
            </div>
          )}

          {!isRejected && !isApproved && (
            <div className="flex items-center justify-between gap-3 text-xs text-slate-500 pt-2 border-t border-slate-100">
              <span>Hubungi Super Admin klinik untuk mempercepat persetujuan role akun Anda.</span>
              <button
                type="button"
                onClick={() => void logout()}
                className="text-teal-700 hover:text-teal-900 font-semibold whitespace-nowrap"
              >
                Ganti Akun
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
