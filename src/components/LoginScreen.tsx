import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Stethoscope, UserPlus } from 'lucide-react';
import { usePractice } from '../context/PracticeContext';
import { DEFAULT_HERO_PATH, DEFAULT_LOGO_PATH } from '../data/defaults';
import type { RoleCode } from '../types/models';

interface PublicPracticeInfo {
  practiceName: string;
  doctorName: string;
  doctorTitle: string;
  address: string;
  logoUrl: string;
  e2eeFingerprint: string;
}

export const LoginScreen: React.FC = () => {
  const { loginStaff, loginGoogleFirebase, registerWithEmailFirebase } = usePractice();
  const [authTab, setAuthTab] = useState<'login' | 'register'>('login');

  // Login form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  // Registration form state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');
  const [regConfirmPassword, setRegConfirmPassword] = useState('');
  const [regRequestedRole, setRegRequestedRole] = useState<RoleCode>('DOKTER_SPOG');
  const [regNote, setRegNote] = useState('');
  const [showRegPass, setShowRegPass] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState('');
  const [heroBroken, setHeroBroken] = useState(false);
  const [logoBroken, setLogoBroken] = useState(false);
  const [pubInfo, setPubInfo] = useState<PublicPracticeInfo>({
    practiceName: 'OBGYN PRACTICE MANAGEMENT SYSTEM',
    doctorName: 'dr. Kartika Wulandari',
    doctorTitle: 'Sp.OG (K)',
    address: 'Jl. Kesehatan Raya No. 48, Kebayoran Baru, Jakarta Selatan',
    logoUrl: DEFAULT_LOGO_PATH,
    e2eeFingerprint: ''
  });

  useEffect(() => {
    fetch('/api/public/practice')
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.practiceName) setPubInfo(data);
      })
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!username.trim() || !password) {
      setError('Masukkan username atau email serta kata sandi akun Anda.');
      return;
    }
    setSubmitting(true);
    try {
      await loginStaff(username.trim(), password);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login gagal. Periksa kembali kredensial Anda.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!regName.trim() || !regEmail.trim() || !regPassword) {
      setError('Nama lengkap, alamat email, dan kata sandi wajib diisi.');
      return;
    }
    if (regPassword.length < 6) {
      setError('Kata sandi minimal 6 karakter.');
      return;
    }
    if (regPassword !== regConfirmPassword) {
      setError('Konfirmasi kata sandi tidak cocok.');
      return;
    }
    setSubmitting(true);
    try {
      await registerWithEmailFirebase({
        displayName: regName.trim(),
        email: regEmail.trim(),
        password: regPassword,
        requestedRole: regRequestedRole,
        requestedNote: regNote.trim()
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Pendaftaran akun gagal.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setGoogleLoading(true);
    try {
      await loginGoogleFirebase();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Autentikasi Google Firebase dibatalkan atau gagal.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Brand & Clinical Consultation Panel */}
      <div className="hidden lg:flex lg:col-span-7 relative bg-slate-900 overflow-hidden flex-col justify-between p-12 text-white">
        {!heroBroken ? (
          <img
            src={DEFAULT_HERO_PATH}
            alt="Ruang Konsultasi Spesialis Obstetri dan Ginekologi"
            referrerPolicy="no-referrer"
            onError={() => setHeroBroken(true)}
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-teal-950 via-slate-900 to-slate-950" />
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/95 via-slate-900/55 to-teal-950/45" />

        <div className="relative z-10 flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-lg bg-white p-1.5 flex items-center justify-center shrink-0">
            {!logoBroken ? (
              <img
                src={pubInfo.logoUrl || DEFAULT_LOGO_PATH}
                alt="Logo Praktik"
                referrerPolicy="no-referrer"
                onError={() => setLogoBroken(true)}
                className="w-full h-full object-contain"
              />
            ) : (
              <Stethoscope className="w-6 h-6 text-teal-700" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold tracking-tight text-white">{pubInfo.practiceName}</p>
            <p className="text-xs text-teal-200">Sistem Informasi Manajemen Praktik Dokter Sp.OG</p>
          </div>
        </div>

        <div className="relative z-10 max-w-xl">
          <h1 className="text-3xl xl:text-4xl font-bold tracking-tight leading-tight text-balance">
            Pelayanan Obstetri &amp; Ginekologi Terintegrasi, Aman, dan Terstandarisasi.
          </h1>
        </div>

        <div className="relative z-10 flex items-center justify-between text-xs text-slate-300 border-t border-white/15 pt-5">
          <span>{pubInfo.address}</span>
          {pubInfo.e2eeFingerprint && (
            <span className="font-mono tabular-nums text-teal-200">
              Vault ID: {pubInfo.e2eeFingerprint.slice(0, 11)}
            </span>
          )}
        </div>
      </div>

      {/* Right Authentication Form Panel */}
      <div className="lg:col-span-5 flex items-center justify-center p-6 sm:p-10 bg-white">
        <div className="w-full max-w-md space-y-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3 lg:hidden mb-4">
              <div className="w-10 h-10 rounded-lg border border-slate-200 p-1.5 flex items-center justify-center">
                <Stethoscope className="w-5 h-5 text-teal-700" />
              </div>
              <span className="text-sm font-bold text-slate-900">{pubInfo.practiceName}</span>
            </div>
            <h2 className="text-2xl font-bold tracking-tight text-slate-900">
              {authTab === 'login' ? 'Masuk ke Sistem Praktik' : 'Daftar Akun Staf Baru'}
            </h2>
            <p className="text-sm text-slate-500">
              {authTab === 'login'
                ? 'Autentikasi akun staf untuk membuka kunci enkripsi end-to-end (E2EE) rekam medis.'
                : 'Setiap pendaftaran baru memerlukan persetujuan dan penentuan role oleh Super Admin terlebih dahulu.'}
            </p>
          </div>

          {/* Tab Switcher: Masuk | Daftar Akun */}
          <div className="grid grid-cols-2 p-1 rounded-lg bg-slate-100 border border-slate-200">
            <button
              type="button"
              onClick={() => {
                setAuthTab('login');
                setError('');
              }}
              className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                authTab === 'login'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Masuk
            </button>
            <button
              type="button"
              onClick={() => {
                setAuthTab('register');
                setError('');
              }}
              className={`h-9 rounded-md text-xs font-semibold transition-colors ${
                authTab === 'register'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Daftar Akun
            </button>
          </div>

          {error && (
            <div
              role="alert"
              className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
            >
              {error}
            </div>
          )}

          {authTab === 'login' ? (
            <>
              <div className="space-y-2.5">
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  disabled={googleLoading}
                  className="w-full h-11 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2.5"
                >
                  <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                      <path
                        fill="#4285F4"
                        d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                      />
                      <path
                        fill="#34A853"
                        d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                      />
                    </svg>
                  </span>
                  {googleLoading ? 'Menghubungkan Akun Google...' : 'Masuk dengan Google (Firebase Real-Time)'}
                </button>
              </div>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-200" />
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-white px-3 text-slate-500">atau masuk dengan email / username</span>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="login-username" className="block text-xs font-medium text-slate-700">
                    Username atau Alamat Email
                  </label>
                  <input
                    id="login-username"
                    name="username"
                    type="text"
                    autoComplete="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Contoh: superman atau nama@klinik.com"
                    className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="login-password" className="block text-xs font-medium text-slate-700">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="login-password"
                      name="password"
                      type={showPass ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan kata sandi"
                      className="w-full h-10 px-3.5 pr-11 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPass((v) => !v)}
                      aria-label={showPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1.5 text-slate-500 hover:text-slate-700"
                    >
                      {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full h-10 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-60 text-slate-800 text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
                >
                  <Lock className="w-4 h-4 text-teal-700" />
                  {submitting ? 'Menghubungkan ke Firebase...' : 'Masuk ke Sistem'}
                </button>
                <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                  Akun Google atau email baru yang belum terdaftar akan otomatis masuk ke antrean persetujuan Super Admin untuk penentuan role.
                </p>
              </form>
            </>
          ) : (
            <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
              <div className="space-y-1">
                <label htmlFor="reg-name" className="block text-xs font-medium text-slate-700">
                  Nama Lengkap &amp; Gelar
                </label>
                <input
                  id="reg-name"
                  type="text"
                  required
                  value={regName}
                  onChange={(e) => setRegName(e.target.value)}
                  placeholder="Contoh: dr. Siti Rahma, Sp.OG"
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-email" className="block text-xs font-medium text-slate-700">
                  Alamat Email
                </label>
                <input
                  id="reg-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  placeholder="nama@email.com"
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label htmlFor="reg-password" className="block text-xs font-medium text-slate-700">
                    Kata Sandi
                  </label>
                  <div className="relative">
                    <input
                      id="reg-password"
                      type={showRegPass ? 'text' : 'password'}
                      required
                      minLength={6}
                      autoComplete="new-password"
                      value={regPassword}
                      onChange={(e) => setRegPassword(e.target.value)}
                      placeholder="Min. 6 karakter"
                      className="w-full h-10 px-3 pr-9 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                    />
                    <button
                      type="button"
                      onClick={() => setShowRegPass((v) => !v)}
                      aria-label={showRegPass ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                      className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-700"
                    >
                      {showRegPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label htmlFor="reg-confirm" className="block text-xs font-medium text-slate-700">
                    Konfirmasi Sandi
                  </label>
                  <input
                    id="reg-confirm"
                    type={showRegPass ? 'text' : 'password'}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={regConfirmPassword}
                    onChange={(e) => setRegConfirmPassword(e.target.value)}
                    placeholder="Ulangi kata sandi"
                    className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-role" className="block text-xs font-medium text-slate-700">
                  Usulan Role (Ditentukan akhir oleh Super Admin)
                </label>
                <select
                  id="reg-role"
                  value={regRequestedRole}
                  onChange={(e) => setRegRequestedRole(e.target.value as RoleCode)}
                  className="w-full h-10 px-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                >
                  <option value="DOKTER_SPOG">Dokter Sp.OG</option>
                  <option value="ASISTEN_DOKTER">Asisten Dokter</option>
                  <option value="SUPER_ADMIN">Super Admin</option>
                </select>
              </div>

              <div className="space-y-1">
                <label htmlFor="reg-note" className="block text-xs font-medium text-slate-700">
                  Catatan / No. STR &amp; SIP (Opsional)
                </label>
                <input
                  id="reg-note"
                  type="text"
                  value={regNote}
                  onChange={(e) => setRegNote(e.target.value)}
                  placeholder="Contoh: Dokter praktik sore / Asisten poli"
                  className="w-full h-10 px-3.5 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-600 focus:border-teal-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full h-11 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-60 text-white text-sm font-semibold transition-colors inline-flex items-center justify-center gap-2"
              >
                <UserPlus className="w-4 h-4" />
                {submitting ? 'Mengirim Pendaftaran...' : 'Daftar & Ajukan Persetujuan'}
              </button>

              <p className="text-[11px] text-slate-500 text-center leading-relaxed">
                Atau masuk langsung dengan Google di tab Masuk untuk mengajukan permintaan akses secara otomatis.
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
