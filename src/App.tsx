/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Lock } from 'lucide-react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { PracticeProvider, usePractice } from './context/PracticeContext';
import { LoginScreen } from './components/LoginScreen';
import { PendingApprovalScreen } from './components/PendingApprovalScreen';
import { Layout } from './components/Layout';
import { PrintModal } from './components/PrintModal';
import { DashboardView } from './components/DashboardView';
import { PatientModule } from './components/PatientModule';
import { MedicalRecordModule } from './components/MedicalRecordModule';
import { PregnancyUsgModule } from './components/PregnancyUsgModule';
import { ClinicalSupportModule } from './components/ClinicalSupportModule';
import { AdminOpsModule } from './components/AdminOpsModule';
import { FinanceModule } from './components/FinanceModule';
import { ReportsModule } from './components/ReportsModule';
import { SettingsModule } from './components/SettingsModule';
import { canAccessView } from './utils/rbac';

const WorkspaceRouter: React.FC = () => {
  const { currentUser, pendingAccessRequest, loading, activeView, setActiveView } = usePractice();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="bg-white border border-slate-200 rounded-xl px-8 py-6 text-center">
          <div className="w-8 h-8 border-2 border-teal-700 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm font-semibold text-slate-800">Memuat Sistem Praktik OBGYN...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    if (pendingAccessRequest) {
      return <PendingApprovalScreen />;
    }
    return <LoginScreen />;
  }

  const renderActiveView = () => {
    if (!canAccessView(currentUser.role, activeView)) {
      return (
        <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-lg mx-auto mt-8">
          <Lock className="w-8 h-8 text-red-600 mx-auto mb-3" />
          <h2 className="text-base font-bold text-slate-900">Akses Tidak Diizinkan</h2>
          <p className="text-sm text-slate-600 mt-1">
            Role akun Anda tidak memiliki hak akses untuk membuka modul ini.
          </p>
          <button
            type="button"
            onClick={() => setActiveView('dashboard')}
            className="mt-4 px-4 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800"
          >
            Kembali ke Dashboard
          </button>
        </div>
      );
    }

    switch (activeView) {
      case 'dashboard':
        return <DashboardView />;
      case 'patients':
      case 'patient-register':
      case 'visits':
      case 'queue':
        return <PatientModule />;
      case 'rme':
      case 'obstetric':
      case 'gynecology':
        return <MedicalRecordModule />;
      case 'pregnancy':
      case 'usg':
        return <PregnancyUsgModule />;
      case 'procedures':
      case 'prescriptions':
      case 'laboratory':
        return <ClinicalSupportModule />;
      case 'schedule':
      case 'appointments':
      case 'documents':
      case 'notifications':
        return <AdminOpsModule />;
      case 'cashier':
      case 'invoices':
      case 'payments':
      case 'receivables':
      case 'cash-in':
      case 'cash-out':
      case 'cash-close':
      case 'finance-reports':
        return <FinanceModule />;
      case 'report-patients':
      case 'report-visits':
      case 'report-medical':
      case 'report-services':
      case 'report-revenue':
        return <ReportsModule />;
      case 'settings-practice':
      case 'settings-tariffs':
      case 'settings-users':
      case 'settings-permissions':
      case 'settings-templates':
      case 'settings-integrations':
      case 'settings-backup':
      case 'settings-audit':
        return <SettingsModule />;
      default:
        return <DashboardView />;
    }
  };

  return (
    <Layout>
      {renderActiveView()}
      <PrintModal />
    </Layout>
  );
};

export default function App() {
  return (
    <ErrorBoundary>
      <PracticeProvider>
        <WorkspaceRouter />
      </PracticeProvider>
    </ErrorBoundary>
  );
}
