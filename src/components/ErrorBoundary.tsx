import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'Terjadi kesalahan pada aplikasi.' };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('Application ErrorBoundary caught:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border border-slate-200 rounded-xl p-8 space-y-5">
            <div className="flex items-center gap-3 text-red-700">
              <AlertTriangle className="w-6 h-6 shrink-0" />
              <h1 className="text-lg font-semibold text-slate-900">Gangguan Operasional Terdeteksi</h1>
            </div>
            <p className="text-sm text-slate-600 leading-relaxed">
              Sistem menghentikan sementara tampilan ini untuk melindungi integritas data medis. Anda dapat memuat ulang tampilan untuk melanjutkan praktik.
            </p>
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono text-slate-700 break-all max-h-36 overflow-auto">
              {this.state.errorMessage}
            </div>
            <button
              type="button"
              onClick={() => {
                this.setState({ hasError: false, errorMessage: '' });
                window.location.reload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-teal-700 text-white text-sm font-medium rounded-lg hover:bg-teal-800 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Muat Ulang Sistem
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
