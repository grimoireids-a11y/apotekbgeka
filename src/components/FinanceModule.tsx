import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowUpRight,
  Ban,
  CheckCircle2,
  CreditCard,
  Download,
  Lock,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  Wallet
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from 'recharts';
import { usePractice } from '../context/PracticeContext';
import type {
  CashSession,
  CashTransaction,
  Expense,
  Invoice,
  InvoiceItem,
  Payment,
  PaymentMethod,
  Refund
} from '../types/models';
import {
  calculateCashSessionVariance,
  calculateInvoiceTotals,
  exportRowsToCsv,
  formatAutoNumber,
  formatCurrencyIDR
} from '../utils/obstetrics';
import { canApproveRefund, canModifyProcessedPayment } from '../utils/rbac';

const PAYMENT_METHODS: PaymentMethod[] = [
  'Tunai',
  'Transfer Bank',
  'QRIS',
  'E-Wallet',
  'Kartu Debit/Kredit',
  'Lainnya'
];

const EXPENSE_CATEGORIES = [
  'Obat & Alkes Habis Pakai',
  'Operasional Klinik',
  'Utilitas (Listrik/Air/Internet)',
  'Gaji & Honorarium',
  'Pemeliharaan Alat USG',
  'Administrasi & ATK',
  'Lainnya'
];

const ITEM_CATEGORIES: InvoiceItem['category'][] = [
  'Konsultasi',
  'Pemeriksaan',
  'USG',
  'Tindakan',
  'Laboratorium',
  'Obat',
  'Administrasi',
  'Lainnya'
];

function downloadCsvFile(filename: string, csvContent: string) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export const FinanceModule: React.FC = () => {
  const {
    activeView,
    setActiveView,
    dbState,
    currentUser,
    practice,
    upsertRecord,
    deleteRecord,
    pushNotification,
    notifyToast,
    setPrintPayload
  } = usePractice();

  const today = new Date().toISOString().slice(0, 10);
  const canOperateCashier = currentUser ? canModifyProcessedPayment(currentUser.role) : false;
  const isRefundApprover = currentUser ? canApproveRefund(currentUser.role) : false;
  const isSuperAdmin = currentUser?.role === 'SUPER_ADMIN';

  // ==================== CASHIER STATE ====================
  const unpaidOrPartialInvoices = useMemo(
    () =>
      dbState.invoices.filter((inv) =>
        ['Belum Dibayar', 'Dibayar Sebagian', 'Piutang'].includes(inv.status)
      ),
    [dbState.invoices]
  );

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>(
    unpaidOrPartialInvoices[0]?.id || dbState.invoices[0]?.id || ''
  );
  const [newInvoiceVisitId, setNewInvoiceVisitId] = useState<string>(dbState.visits[0]?.id || '');
  const [confirmDeleteTxKey, setConfirmDeleteTxKey] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedInvoiceId || !dbState.invoices.some((i) => i.id === selectedInvoiceId)) {
      const next = unpaidOrPartialInvoices[0]?.id || dbState.invoices[0]?.id || '';
      if (next !== selectedInvoiceId) setSelectedInvoiceId(next);
    }
  }, [dbState.invoices, selectedInvoiceId, unpaidOrPartialInvoices]);

  useEffect(() => {
    if (!newInvoiceVisitId || !dbState.visits.some((v) => v.id === newInvoiceVisitId)) {
      const next = dbState.visits[0]?.id || '';
      if (next !== newInvoiceVisitId) setNewInvoiceVisitId(next);
    }
  }, [dbState.visits, newInvoiceVisitId]);

  // Editable billing adjustment fields
  const [customItemDesc, setCustomItemDesc] = useState('');
  const [customItemCat, setCustomItemCat] = useState<InvoiceItem['category']>('Tindakan');
  const [customItemQty, setCustomItemQty] = useState(1);
  const [customItemPrice, setCustomItemPrice] = useState(150000);
  const [adjustmentReason, setAdjustmentReason] = useState('');
  const [discountInput, setDiscountInput] = useState<number>(0);

  // Payment checkout fields
  const [payMethod, setPayMethod] = useState<PaymentMethod>('Tunai');
  const [payAmount, setPayAmount] = useState<string>('');
  const [receivedCash, setReceivedCash] = useState<string>('');
  const [referenceNo, setReferenceNo] = useState('');
  const [processingPayment, setProcessingPayment] = useState(false);

  // ==================== INVOICE & PAYMENT FILTERS ====================
  const [invoiceQuery, setInvoiceQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<string>('ALL');
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [refundTargetPayment, setRefundTargetPayment] = useState<Payment | null>(null);
  const [refundReason, setRefundReason] = useState('');
  const [refundAmount, setRefundAmount] = useState<string>('');

  // ==================== CASH IN / OUT STATE ====================
  const [cashInForm, setCashInForm] = useState({
    category: 'Penerimaan Non-Kunjungan',
    description: '',
    amount: '',
    method: 'Tunai' as PaymentMethod,
    date: today
  });

  const [expenseForm, setExpenseForm] = useState({
    category: EXPENSE_CATEGORIES[0],
    description: '',
    amount: '',
    vendor: '',
    paymentMethod: 'Tunai' as PaymentMethod,
    expenseDate: today
  });

  // ==================== CASH CLOSE STATE ====================
  const openSession = useMemo(
    () => dbState.cash_sessions.find((s) => s.status === 'Terbuka') || null,
    [dbState.cash_sessions]
  );
  const [openingBalanceInput, setOpeningBalanceInput] = useState('500000');
  const [actualClosingInput, setActualClosingInput] = useState('');
  const [closingNotes, setClosingNotes] = useState('');

  // ==================== FINANCE REPORT FILTERS ====================
  const [reportStart, setReportStart] = useState(
    new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10)
  );
  const [reportEnd, setReportEnd] = useState(today);

  const activeInvoice = useMemo(
    () => dbState.invoices.find((i) => i.id === selectedInvoiceId) || unpaidOrPartialInvoices[0] || null,
    [dbState.invoices, selectedInvoiceId, unpaidOrPartialInvoices]
  );

  // Active open session live cash metrics
  const openSessionCashTotals = useMemo(() => {
    if (!openSession) return { cashIn: 0, cashOut: 0, expected: 0 };
    const sessionTx = dbState.cash_transactions.filter(
      (t) => t.sessionId === openSession.id || t.transactionDate === openSession.sessionDate
    );
    const cashIn = sessionTx
      .filter((t) => t.type === 'Masuk' && t.method === 'Tunai')
      .reduce((sum, t) => sum + t.amount, 0);
    const cashOut = sessionTx
      .filter((t) => t.type === 'Keluar' && t.method === 'Tunai')
      .reduce((sum, t) => sum + t.amount, 0);
    const expected = openSession.openingBalance + cashIn - cashOut;
    return { cashIn, cashOut, expected };
  }, [dbState.cash_transactions, openSession]);

  if (!canOperateCashier) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-8 text-center max-w-xl mx-auto mt-6">
        <Lock className="w-8 h-8 text-red-600 mx-auto mb-3" />
        <h2 className="text-base font-bold text-slate-900">Akses Modul Keuangan Dibatasi</h2>
        <p className="text-sm text-slate-600 mt-1.5">
          Sesuai pemisahan kewenangan medis dan administrasi, Dokter Sp.OG tidak diperkenankan mengubah transaksi kasir atau pembayaran. Hubungi Asisten Dokter atau Super Admin.
        </p>
      </div>
    );
  }

  // ==================== HANDLERS ====================
  const handleCreateInvoiceFromVisit = async () => {
    if (!currentUser || !newInvoiceVisitId) return;
    const visit = dbState.visits.find((v) => v.id === newInvoiceVisitId);
    if (!visit) {
      notifyToast('Pilih kunjungan yang valid terlebih dahulu.', 'error');
      return;
    }
    const existing = dbState.invoices.find((i) => i.visitId === visit.id && i.status !== 'Dibatalkan');
    if (existing) {
      setSelectedInvoiceId(existing.id);
      notifyToast(`Tagihan ${existing.invoiceNumber} untuk kunjungan ini sudah tersedia.`, 'info');
      return;
    }

    const nowIso = new Date().toISOString();
    const consultTariff =
      dbState.services.find((s) => s.active && s.category === 'Konsultasi') || dbState.services[0];
    const visitProcedures = dbState.procedures.filter((p) => p.visitId === visit.id);
    const visitRx = dbState.prescriptions.filter((r) => r.visitId === visit.id);
    const visitLabs = dbState.laboratory_orders.filter((l) => l.visitId === visit.id);

    const items: Invoice['items'] = [];
    if (consultTariff) {
      items.push({
        id: `it-${Date.now()}-c`,
        category: 'Konsultasi',
        description: consultTariff.name,
        qty: 1,
        unitPrice: consultTariff.price,
        total: consultTariff.price
      });
    }
    for (const p of visitProcedures) {
      items.push({
        id: `it-${p.id}`,
        category: p.category === 'USG' ? 'USG' : 'Tindakan',
        description: p.name,
        qty: 1,
        unitPrice: p.price,
        total: p.price
      });
    }
    for (const rx of visitRx) {
      for (const item of rx.items) {
        items.push({
          id: `it-rx-${rx.id}-${item.medicineId}`,
          category: 'Obat',
          description: `${item.medicineName} (${item.quantity} ${item.unit})`,
          qty: item.quantity,
          unitPrice: item.unitPrice,
          total: item.quantity * item.unitPrice
        });
      }
    }
    for (const lab of visitLabs) {
      for (const t of lab.tests) {
        items.push({
          id: `it-lab-${lab.id}-${t.code}`,
          category: 'Laboratorium',
          description: `Lab: ${t.name}`,
          qty: 1,
          unitPrice: t.price,
          total: t.price
        });
      }
    }

    const totals = calculateInvoiceTotals(items, 0, practice.taxRatePercent, 0);
    const inv: Invoice = {
      id: `inv-${Date.now()}`,
      invoiceNumber: formatAutoNumber(practice.invoiceFormat || 'INV', dbState.invoices.length + 1, today),
      visitId: visit.id,
      patientId: visit.patientId,
      patientName: visit.patientName,
      patientRm: visit.patientRm,
      items,
      subtotal: totals.subtotal,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      paidAmount: 0,
      remainingAmount: totals.remaining,
      status: 'Belum Dibayar',
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };

    await upsertRecord('invoices', inv);
    setSelectedInvoiceId(inv.id);
    notifyToast(`Tagihan ${inv.invoiceNumber} dibuat otomatis dari layanan kunjungan.`, 'success');
  };

  const handleAddBillingItem = async () => {
    if (!activeInvoice || !currentUser) return;
    if (!customItemDesc.trim() || customItemPrice <= 0 || customItemQty <= 0) {
      notifyToast('Lengkapi deskripsi, jumlah, dan harga item tagihan.', 'error');
      return;
    }
    if (!adjustmentReason.trim()) {
      notifyToast('Alasan penyesuaian administrasi wajib diisi sebelum mengubah tagihan.', 'warning');
      return;
    }
    const newItem = {
      id: `it-${Date.now()}`,
      category: customItemCat,
      description: customItemDesc.trim(),
      qty: customItemQty,
      unitPrice: customItemPrice,
      total: customItemQty * customItemPrice
    };
    const nextItems = [...activeInvoice.items, newItem];
    const totals = calculateInvoiceTotals(
      nextItems,
      activeInvoice.discount,
      practice.taxRatePercent,
      activeInvoice.paidAmount
    );
    const updated: Invoice = {
      ...activeInvoice,
      items: nextItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      remainingAmount: totals.remaining,
      status:
        totals.remaining === 0
          ? 'Lunas'
          : activeInvoice.paidAmount > 0
            ? 'Dibayar Sebagian'
            : 'Belum Dibayar',
      adjustmentReason: adjustmentReason.trim()
    };
    await upsertRecord('invoices', updated);
    setCustomItemDesc('');
    setAdjustmentReason('');
    notifyToast('Item tagihan berhasil ditambahkan dengan catatan penyesuaian.', 'success');
  };

  const handleRemoveBillingItem = async (itemId: string) => {
    if (!activeInvoice) return;
    if (!adjustmentReason.trim()) {
      notifyToast('Isi alasan penyesuaian administrasi terlebih dahulu sebelum menghapus item.', 'warning');
      return;
    }
    const nextItems = activeInvoice.items.filter((it) => it.id !== itemId);
    const totals = calculateInvoiceTotals(
      nextItems,
      activeInvoice.discount,
      practice.taxRatePercent,
      activeInvoice.paidAmount
    );
    await upsertRecord('invoices', {
      ...activeInvoice,
      items: nextItems,
      subtotal: totals.subtotal,
      tax: totals.tax,
      total: totals.total,
      remainingAmount: totals.remaining,
      adjustmentReason: adjustmentReason.trim()
    });
    setAdjustmentReason('');
    notifyToast('Item dihapus dari tagihan.', 'info');
  };

  const handleApplyDiscount = async () => {
    if (!activeInvoice) return;
    if (!adjustmentReason.trim()) {
      notifyToast('Isi alasan penyesuaian administrasi untuk menerapkan diskon.', 'warning');
      return;
    }
    const totals = calculateInvoiceTotals(
      activeInvoice.items,
      discountInput,
      practice.taxRatePercent,
      activeInvoice.paidAmount
    );
    await upsertRecord('invoices', {
      ...activeInvoice,
      discount: totals.discount,
      tax: totals.tax,
      total: totals.total,
      remainingAmount: totals.remaining,
      status:
        totals.remaining === 0
          ? 'Lunas'
          : activeInvoice.paidAmount > 0
            ? 'Dibayar Sebagian'
            : 'Belum Dibayar',
      adjustmentReason: adjustmentReason.trim()
    });
    setAdjustmentReason('');
    notifyToast('Diskon & total tagihan diperbarui.', 'success');
  };

  const handleProcessPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeInvoice || !currentUser || processingPayment) return;

    const amountToPay = Number(payAmount || activeInvoice.remainingAmount);
    if (!Number.isFinite(amountToPay) || amountToPay <= 0) {
      notifyToast('Nominal pembayaran harus lebih besar dari 0.', 'error');
      return;
    }
    if (amountToPay > activeInvoice.remainingAmount) {
      notifyToast('Nominal bayar melebihi sisa tagihan. Gunakan kolom Uang Diterima untuk kembalian.', 'warning');
      return;
    }

    const received = payMethod === 'Tunai' ? Number(receivedCash || amountToPay) : amountToPay;
    if (payMethod === 'Tunai' && received < amountToPay) {
      notifyToast('Uang tunai diterima kurang dari nominal pembayaran.', 'error');
      return;
    }

    setProcessingPayment(true);
    try {
      const nowIso = new Date().toISOString();
      const changeAmount = Math.max(0, received - amountToPay);
      const nextPaid = activeInvoice.paidAmount + amountToPay;
      const nextRemaining = Math.max(0, activeInvoice.total - nextPaid);
      const nextStatus: Invoice['status'] = nextRemaining === 0 ? 'Lunas' : 'Piutang';

      const receiptNumber = formatAutoNumber(
        practice.receiptFormat || 'KWT',
        dbState.payments.length + 1,
        today
      );

      const payment: Payment = {
        id: `pay-${Date.now()}`,
        receiptNumber,
        invoiceId: activeInvoice.id,
        invoiceNumber: activeInvoice.invoiceNumber,
        visitId: activeInvoice.visitId,
        patientId: activeInvoice.patientId,
        patientName: activeInvoice.patientName,
        patientRm: activeInvoice.patientRm,
        amount: amountToPay,
        receivedAmount: received,
        changeAmount,
        method: payMethod,
        referenceNumber: referenceNo.trim() || undefined,
        status: 'Sukses',
        cashierName: currentUser.displayName,
        paymentDate: today,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };

      const updatedInvoice: Invoice = {
        ...activeInvoice,
        paidAmount: nextPaid,
        remainingAmount: nextRemaining,
        status: nextStatus
      };

      const cashTx: CashTransaction = {
        id: `ctx-${Date.now()}`,
        sessionId: openSession?.id,
        type: 'Masuk',
        category: 'Pembayaran Pasien',
        amount: amountToPay,
        method: payMethod,
        description: `Pembayaran ${activeInvoice.invoiceNumber} — ${activeInvoice.patientName} (${receiptNumber})`,
        referenceId: payment.id,
        transactionDate: today,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      };

      await upsertRecord('payments', payment);
      await upsertRecord('invoices', updatedInvoice);
      await upsertRecord('cash_transactions', cashTx);

      // Sync visit and queue status automatically
      const visit = dbState.visits.find((v) => v.id === activeInvoice.visitId);
      if (visit) {
        await upsertRecord('visits', {
          ...visit,
          paymentStatus: nextStatus,
          status: nextStatus === 'Lunas' ? 'Selesai' : 'Menunggu Pembayaran'
        });
      }
      const queue = dbState.queues.find((q) => q.visitId === activeInvoice.visitId);
      if (queue && nextStatus === 'Lunas') {
        await upsertRecord('queues', { ...queue, status: 'Selesai' });
      }

      await pushNotification({
        category: 'Pembayaran',
        title: nextStatus === 'Lunas' ? 'Pembayaran Lunas' : 'Pembayaran Sebagian (Piutang)',
        message: `${activeInvoice.patientName} membayar ${formatCurrencyIDR(amountToPay)} via ${payMethod} (${receiptNumber}).`,
        severity: nextStatus === 'Lunas' ? 'info' : 'warning',
        targetRoles: ['SUPER_ADMIN', 'ASISTEN_DOKTER'],
        linkView: 'payments'
      });

      setPayAmount('');
      setReceivedCash('');
      setReferenceNo('');
      notifyToast(`Pembayaran ${receiptNumber} berhasil diproses.`, 'success');

      // Open printable Kuitansi immediately
      setPrintPayload({
        type: 'kuitansi',
        title: 'KUITANSI PEMBAYARAN',
        subtitle: receiptNumber,
        data: {
          patientName: activeInvoice.patientName,
          patientRm: activeInvoice.patientRm,
          receiptNumber,
          method: payMethod,
          items: activeInvoice.items,
          subtotal: activeInvoice.subtotal,
          discount: activeInvoice.discount,
          total: activeInvoice.total,
          amount: amountToPay,
          remainingAmount: nextRemaining,
          cashierName: currentUser.displayName
        }
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  const handleCancelPayment = async (payment: Payment) => {
    if (!cancelReason.trim()) {
      notifyToast('Masukkan alasan pembatalan transaksi.', 'warning');
      return;
    }
    await upsertRecord('payments', {
      ...payment,
      status: 'Dibatalkan',
      cancelReason: cancelReason.trim()
    });
    const inv = dbState.invoices.find((i) => i.id === payment.invoiceId);
    if (inv) {
      const nextPaid = Math.max(0, inv.paidAmount - payment.amount);
      const nextRemaining = Math.max(0, inv.total - nextPaid);
      await upsertRecord('invoices', {
        ...inv,
        paidAmount: nextPaid,
        remainingAmount: nextRemaining,
        status: nextPaid === 0 ? 'Belum Dibayar' : 'Piutang'
      });
    }
    setCancelTargetId(null);
    setCancelReason('');
    notifyToast(`Transaksi ${payment.receiptNumber} dibatalkan dan saldo tagihan dikembalikan.`, 'info');
  };

  const handleSubmitRefund = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!refundTargetPayment || !currentUser) return;
    const amt = Number(refundAmount || refundTargetPayment.amount);
    if (!refundReason.trim() || amt <= 0 || amt > refundTargetPayment.amount) {
      notifyToast('Periksa nominal dan alasan pengembalian dana (refund).', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const refund: Refund = {
      id: `ref-${Date.now()}`,
      paymentId: refundTargetPayment.id,
      receiptNumber: refundTargetPayment.receiptNumber,
      invoiceId: refundTargetPayment.invoiceId,
      patientName: refundTargetPayment.patientName,
      amount: amt,
      reason: refundReason.trim(),
      status: isRefundApprover ? 'Disetujui' : 'Menunggu Persetujuan',
      approvedBy: isRefundApprover ? currentUser.displayName : undefined,
      approvedAt: isRefundApprover ? nowIso : undefined,
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('refunds', refund);
    if (isRefundApprover) {
      await upsertRecord('payments', { ...refundTargetPayment, status: 'Dikembalikan' });
      await upsertRecord('cash_transactions', {
        id: `ctx-ref-${Date.now()}`,
        sessionId: openSession?.id,
        type: 'Keluar',
        category: 'Refund Pasien',
        amount: amt,
        method: refundTargetPayment.method,
        description: `Refund ${refundTargetPayment.receiptNumber} — ${refundTargetPayment.patientName}`,
        referenceId: refund.id,
        transactionDate: today,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      });
    } else {
      await pushNotification({
        category: 'Keuangan',
        title: 'Permintaan Persetujuan Refund',
        message: `${currentUser.displayName} mengajukan refund ${formatCurrencyIDR(amt)} untuk ${refundTargetPayment.receiptNumber}.`,
        severity: 'warning',
        targetRoles: ['SUPER_ADMIN'],
        linkView: 'payments'
      });
    }
    setRefundTargetPayment(null);
    setRefundReason('');
    setRefundAmount('');
    notifyToast(
      isRefundApprover
        ? 'Pengembalian dana disetujui dan dicatat pada kas keluar.'
        : 'Pengajuan refund dikirim untuk otorisasi Super Admin.',
      'success'
    );
  };

  const handleReviewRefund = async (refund: Refund, approve: boolean) => {
    if (!currentUser || !isRefundApprover) return;
    const nowIso = new Date().toISOString();
    await upsertRecord('refunds', {
      ...refund,
      status: approve ? 'Disetujui' : 'Ditolak',
      approvedBy: currentUser.displayName,
      approvedAt: nowIso
    });
    if (approve) {
      const payment = dbState.payments.find((p) => p.id === refund.paymentId);
      if (payment) {
        await upsertRecord('payments', { ...payment, status: 'Dikembalikan' });
      }
      await upsertRecord('cash_transactions', {
        id: `ctx-ref-${Date.now()}`,
        sessionId: openSession?.id,
        type: 'Keluar',
        category: 'Refund Pasien',
        amount: refund.amount,
        method: payment?.method || 'Tunai',
        description: `Refund Disetujui: ${refund.receiptNumber} — ${refund.patientName}`,
        referenceId: refund.id,
        transactionDate: today,
        createdAt: nowIso,
        createdBy: currentUser.id,
        updatedAt: nowIso,
        updatedBy: currentUser.id
      });
    }
    notifyToast(approve ? 'Refund disetujui.' : 'Permintaan refund ditolak.', approve ? 'success' : 'info');
  };

  const handleRecordManualCashIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const amt = Number(cashInForm.amount);
    if (!cashInForm.description.trim() || !Number.isFinite(amt) || amt <= 0) {
      notifyToast('Lengkapi keterangan dan nominal kas masuk.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    await upsertRecord('cash_transactions', {
      id: `ctx-in-${Date.now()}`,
      sessionId: openSession?.id,
      type: 'Masuk',
      category: cashInForm.category,
      amount: amt,
      method: cashInForm.method,
      description: cashInForm.description.trim(),
      transactionDate: cashInForm.date,
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    });
    setCashInForm({ ...cashInForm, description: '', amount: '' });
    notifyToast('Penerimaan kas masuk berhasil dicatat.', 'success');
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;
    const amt = Number(expenseForm.amount);
    if (!expenseForm.description.trim() || !Number.isFinite(amt) || amt <= 0) {
      notifyToast('Lengkapi keterangan dan nominal pengeluaran kas.', 'error');
      return;
    }
    const nowIso = new Date().toISOString();
    const exp: Expense = {
      id: `exp-${Date.now()}`,
      category: expenseForm.category,
      description: expenseForm.description.trim(),
      amount: amt,
      expenseDate: expenseForm.expenseDate,
      vendor: expenseForm.vendor.trim() || undefined,
      paymentMethod: expenseForm.paymentMethod,
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('expenses', exp);
    await upsertRecord('cash_transactions', {
      id: `ctx-out-${Date.now()}`,
      sessionId: openSession?.id,
      type: 'Keluar',
      category: expenseForm.category,
      amount: amt,
      method: expenseForm.paymentMethod,
      description: `${expenseForm.description.trim()}${expenseForm.vendor ? ` (${expenseForm.vendor})` : ''}`,
      referenceId: exp.id,
      transactionDate: expenseForm.expenseDate,
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    });
    setExpenseForm({ ...expenseForm, description: '', amount: '', vendor: '' });
    notifyToast('Pengeluaran operasional & kas keluar dicatat.', 'success');
  };

  const handleOpenCashSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || openSession) return;
    const opening = Math.max(0, Number(openingBalanceInput) || 0);
    const nowIso = new Date().toISOString();
    const session: CashSession = {
      id: `cs-${Date.now()}`,
      sessionDate: today,
      openedBy: currentUser.displayName,
      openedAt: nowIso,
      openingBalance: opening,
      cashInTotal: 0,
      cashOutTotal: 0,
      expectedBalance: opening,
      status: 'Terbuka',
      createdAt: nowIso,
      createdBy: currentUser.id,
      updatedAt: nowIso,
      updatedBy: currentUser.id
    };
    await upsertRecord('cash_sessions', session);
    notifyToast(`Sesi kas harian dibuka dengan saldo awal ${formatCurrencyIDR(opening)}.`, 'success');
  };

  const handleCloseCashSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser || !openSession) return;
    const actual = Number(actualClosingInput);
    if (!Number.isFinite(actual) || actual < 0) {
      notifyToast('Masukkan jumlah uang fisik di laci kas saat penutupan.', 'error');
      return;
    }
    const { expectedBalance, variance } = calculateCashSessionVariance(
      openSession.openingBalance,
      openSessionCashTotals.cashIn,
      openSessionCashTotals.cashOut,
      actual
    );
    const nowIso = new Date().toISOString();
    await upsertRecord('cash_sessions', {
      ...openSession,
      cashInTotal: openSessionCashTotals.cashIn,
      cashOutTotal: openSessionCashTotals.cashOut,
      expectedBalance,
      actualClosingBalance: actual,
      variance,
      closedBy: currentUser.displayName,
      closedAt: nowIso,
      notes: closingNotes.trim() || undefined,
      status: 'Ditutup'
    });
    if (variance !== 0) {
      await pushNotification({
        category: 'Keuangan',
        title: 'Selisih Tutup Kas Harian',
        message: `Tutup kas oleh ${currentUser.displayName} mencatat selisih ${formatCurrencyIDR(variance)}.`,
        severity: 'warning',
        targetRoles: ['SUPER_ADMIN'],
        linkView: 'cash-close'
      });
    }
    setActualClosingInput('');
    setClosingNotes('');
    notifyToast('Tutup kas harian berhasil disimpan.', 'success');
  };

  // ==================== SUPER ADMIN DELETE TRANSACTION HANDLERS ====================
  const handleDeleteInvoice = async (inv: Invoice) => {
    if (!isSuperAdmin) return;
    const linkedPayments = dbState.payments.filter((p) => p.invoiceId === inv.id);
    for (const p of linkedPayments) {
      const linkedCash = dbState.cash_transactions.filter((c) => c.referenceId === p.id);
      for (const c of linkedCash) {
        await deleteRecord('cash_transactions', c.id);
      }
      await deleteRecord('payments', p.id);
    }
    const linkedRefunds = dbState.refunds.filter((r) => r.invoiceId === inv.id);
    for (const r of linkedRefunds) {
      const linkedRefCash = dbState.cash_transactions.filter((c) => c.referenceId === r.id);
      for (const c of linkedRefCash) {
        await deleteRecord('cash_transactions', c.id);
      }
      await deleteRecord('refunds', r.id);
    }
    await deleteRecord('invoices', inv.id);
    const visit = dbState.visits.find((v) => v.id === inv.visitId);
    if (visit) {
      await upsertRecord('visits', { ...visit, paymentStatus: 'Belum Dibayar' });
    }
    setConfirmDeleteTxKey(null);
    notifyToast(`Transaksi tagihan ${inv.invoiceNumber} berhasil dihapus permanen.`, 'info');
  };

  const handleDeletePayment = async (payment: Payment) => {
    if (!isSuperAdmin) return;
    const linkedCash = dbState.cash_transactions.filter((c) => c.referenceId === payment.id);
    for (const c of linkedCash) {
      await deleteRecord('cash_transactions', c.id);
    }
    await deleteRecord('payments', payment.id);
    const inv = dbState.invoices.find((i) => i.id === payment.invoiceId);
    if (inv) {
      const remainingPaid = dbState.payments
        .filter((p) => p.invoiceId === inv.id && p.id !== payment.id && p.status === 'Sukses')
        .reduce((sum, p) => sum + p.amount, 0);
      const nextRemaining = Math.max(0, inv.total - remainingPaid);
      const nextStatus: Invoice['status'] =
        nextRemaining === 0 && inv.total > 0 ? 'Lunas' : remainingPaid > 0 ? 'Piutang' : 'Belum Dibayar';
      await upsertRecord('invoices', {
        ...inv,
        paidAmount: remainingPaid,
        remainingAmount: nextRemaining,
        status: nextStatus
      });
      const visit = dbState.visits.find((v) => v.id === inv.visitId);
      if (visit) {
        await upsertRecord('visits', { ...visit, paymentStatus: nextStatus });
      }
    }
    setConfirmDeleteTxKey(null);
    notifyToast(`Transaksi pembayaran ${payment.receiptNumber} berhasil dihapus permanen.`, 'info');
  };

  const handleDeleteRefund = async (refund: Refund) => {
    if (!isSuperAdmin) return;
    const linkedCash = dbState.cash_transactions.filter((c) => c.referenceId === refund.id);
    for (const c of linkedCash) {
      await deleteRecord('cash_transactions', c.id);
    }
    await deleteRecord('refunds', refund.id);
    setConfirmDeleteTxKey(null);
    notifyToast(`Data refund ${refund.receiptNumber} berhasil dihapus permanen.`, 'info');
  };

  const handleDeleteCashTransaction = async (tx: CashTransaction) => {
    if (!isSuperAdmin) return;
    if (tx.referenceId && dbState.expenses.some((e) => e.id === tx.referenceId)) {
      await deleteRecord('expenses', tx.referenceId);
    }
    await deleteRecord('cash_transactions', tx.id);
    setConfirmDeleteTxKey(null);
    notifyToast(`Transaksi kas "${tx.description}" berhasil dihapus permanen.`, 'info');
  };

  const handleDeleteCashSession = async (session: CashSession) => {
    if (!isSuperAdmin) return;
    await deleteRecord('cash_sessions', session.id);
    setConfirmDeleteTxKey(null);
    notifyToast(`Sesi kas tanggal ${session.sessionDate} berhasil dihapus permanen.`, 'info');
  };

  // ==================== VIEW: CASHIER ====================
  if (activeView === 'cashier') {
    const paymentPreviewAmount = Number(payAmount || activeInvoice?.remainingAmount || 0);
    const changePreview =
      payMethod === 'Tunai'
        ? Math.max(0, Number(receivedCash || paymentPreviewAmount) - paymentPreviewAmount)
        : 0;

    return (
      <div className="space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kasir &amp; Pembayaran Pasien</h1>
            <p className="text-sm text-slate-500">
              Proses tagihan layanan, penyesuaian administrasi, pembayaran tunai/non-tunai, piutang, dan cetak kuitansi.
            </p>
          </div>
          <div className="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0">
            <select
              value={newInvoiceVisitId}
              onChange={(e) => setNewInvoiceVisitId(e.target.value)}
              aria-label="Pilih kunjungan untuk buat tagihan"
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg text-slate-800 max-w-[260px] truncate"
            >
              <option value="">-- Pilih Kunjungan --</option>
              {dbState.visits.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.visitNumber} · {v.patientName} ({v.status})
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreateInvoiceFromVisit}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap shrink-0"
            >
              <Plus className="w-3.5 h-3.5" />
              Buat Tagihan Kunjungan
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
          {/* Left: Queue of Unpaid / Partial Invoices */}
          <div className="xl:col-span-4 bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <h2 className="text-sm font-bold text-slate-900">Antrean Tagihan Aktif</h2>
              <span className="text-xs font-mono tabular-nums text-teal-800 font-semibold">
                {unpaidOrPartialInvoices.length} tagihan
              </span>
            </div>
            <div className="divide-y divide-slate-100 max-h-[540px] overflow-y-auto">
              {unpaidOrPartialInvoices.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Seluruh tagihan saat ini telah lunas. Pilih kunjungan di kanan atas untuk membuat tagihan baru.
                </div>
              ) : (
                unpaidOrPartialInvoices.map((inv) => {
                  const selected = activeInvoice?.id === inv.id;
                  return (
                    <button
                      key={inv.id}
                      type="button"
                      onClick={() => {
                        setSelectedInvoiceId(inv.id);
                        setDiscountInput(inv.discount);
                        setPayAmount(String(inv.remainingAmount));
                      }}
                      className={`w-full text-left px-5 py-3.5 transition-colors ${
                        selected ? 'bg-teal-50/70' : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900 truncate">{inv.patientName}</p>
                        <span
                          className={`text-xs font-semibold ${
                            inv.status === 'Piutang' ? 'text-amber-700' : 'text-red-700'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between mt-1 text-xs text-slate-500">
                        <span className="font-mono tabular-nums">{inv.invoiceNumber}</span>
                        <span className="font-mono tabular-nums font-semibold text-slate-900">
                          Sisa {formatCurrencyIDR(inv.remainingAmount)}
                        </span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right: Active Billing Breakdown + Payment Form */}
          <div className="xl:col-span-8 space-y-5">
            {!activeInvoice ? (
              <div className="bg-white border border-slate-200 rounded-xl p-10 text-center">
                <Receipt className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">Belum ada tagihan dipilih</p>
                <p className="text-xs text-slate-500 mt-1">
                  Pilih tagihan dari daftar kiri atau buat tagihan baru dari kunjungan pasien.
                </p>
              </div>
            ) : (
              <>
                <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
                  <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div>
                      <p className="text-xs font-mono text-teal-800 font-semibold">{activeInvoice.invoiceNumber}</p>
                      <h2 className="text-lg font-bold text-slate-900">{activeInvoice.patientName}</h2>
                      <p className="text-xs text-slate-500 font-mono">No. RM: {activeInvoice.patientRm}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-slate-500">Sisa Harus Dibayar</p>
                      <p className="text-2xl font-bold font-mono tabular-nums text-teal-800">
                        {formatCurrencyIDR(activeInvoice.remainingAmount)}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Total {formatCurrencyIDR(activeInvoice.total)} · Terbayar {formatCurrencyIDR(activeInvoice.paidAmount)}
                      </p>
                    </div>
                  </div>

                  {/* Line Items Table */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-slate-500">
                          <th className="py-2 text-left font-semibold">Kategori</th>
                          <th className="py-2 text-left font-semibold">Deskripsi Layanan / Obat</th>
                          <th className="py-2 text-center font-semibold">Qty</th>
                          <th className="py-2 text-right font-semibold">Tarif</th>
                          <th className="py-2 text-right font-semibold">Subtotal</th>
                          <th className="py-2 text-right font-semibold">Hapus</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {activeInvoice.items.map((it) => (
                          <tr key={it.id}>
                            <td className="py-2.5 text-slate-600">{it.category}</td>
                            <td className="py-2.5 font-medium text-slate-900">{it.description}</td>
                            <td className="py-2.5 text-center font-mono tabular-nums">{it.qty}</td>
                            <td className="py-2.5 text-right font-mono tabular-nums">{formatCurrencyIDR(it.unitPrice)}</td>
                            <td className="py-2.5 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatCurrencyIDR(it.total)}
                            </td>
                            <td className="py-2.5 text-right">
                              <button
                                type="button"
                                onClick={() => handleRemoveBillingItem(it.id)}
                                aria-label={`Hapus ${it.description}`}
                                className="p-1 text-slate-400 hover:text-red-600"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Administrative Item Adjustment & Discount */}
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                    <p className="text-xs font-bold text-slate-800">
                      Penyesuaian Tagihan Administrasi (Tercatat di Audit Log)
                    </p>
                    <input
                      type="text"
                      value={adjustmentReason}
                      onChange={(e) => setAdjustmentReason(e.target.value)}
                      placeholder="Alasan penyesuaian wajib diisi (mis. Tambahan BHP, potongan diskon pasien kontrol)"
                      className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                    />
                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                      <select
                        value={customItemCat}
                        onChange={(e) => setCustomItemCat(e.target.value as InvoiceItem['category'])}
                        className="sm:col-span-3 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                      >
                        {ITEM_CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={customItemDesc}
                        onChange={(e) => setCustomItemDesc(e.target.value)}
                        placeholder="Nama item / layanan tambahan"
                        className="sm:col-span-4 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                      />
                      <input
                        type="number"
                        min={1}
                        value={customItemQty}
                        onChange={(e) => setCustomItemQty(Number(e.target.value))}
                        className="sm:col-span-1 px-2 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                      />
                      <input
                        type="number"
                        min={0}
                        value={customItemPrice}
                        onChange={(e) => setCustomItemPrice(Number(e.target.value))}
                        className="sm:col-span-2 px-2.5 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                      />
                      <button
                        type="button"
                        onClick={handleAddBillingItem}
                        className="sm:col-span-2 px-3 py-2 rounded-lg bg-slate-800 text-white text-xs font-semibold hover:bg-slate-900 whitespace-nowrap"
                      >
                        + Item
                      </button>
                    </div>
                    <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-200">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-slate-600">Diskon (Rp):</label>
                        <input
                          type="number"
                          min={0}
                          value={discountInput}
                          onChange={(e) => setDiscountInput(Number(e.target.value))}
                          className="w-32 px-2.5 py-1.5 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                        />
                        <button
                          type="button"
                          onClick={handleApplyDiscount}
                          className="px-3 py-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100 whitespace-nowrap"
                        >
                          Terapkan Diskon
                        </button>
                      </div>
                      <div className="text-xs text-slate-600 font-mono tabular-nums">
                        Subtotal: {formatCurrencyIDR(activeInvoice.subtotal)} · Diskon:{' '}
                        {formatCurrencyIDR(activeInvoice.discount)} · Pajak ({practice.taxRatePercent}%):{' '}
                        {formatCurrencyIDR(activeInvoice.tax)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Payment Checkout Panel */}
                {activeInvoice.remainingAmount > 0 && (
                  <form
                    onSubmit={handleProcessPayment}
                    className="bg-white border border-slate-200 rounded-xl p-5 space-y-4"
                  >
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <CreditCard className="w-4 h-4 text-teal-700" />
                      Proses Pembayaran &amp; Terbitkan Kuitansi
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">Metode Pembayaran</label>
                        <select
                          value={payMethod}
                          onChange={(e) => setPayMethod(e.target.value as PaymentMethod)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                        >
                          {PAYMENT_METHODS.map((m) => (
                            <option key={m} value={m}>
                              {m}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-slate-700 mb-1">
                          Nominal Dibayar (Rp)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={activeInvoice.remainingAmount}
                          value={payAmount}
                          onChange={(e) => setPayAmount(e.target.value)}
                          placeholder={String(activeInvoice.remainingAmount)}
                          className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                        />
                        <p className="text-[11px] text-slate-500 mt-0.5">
                          Isi lebih kecil untuk mencatat piutang / cicilan.
                        </p>
                      </div>
                      {payMethod === 'Tunai' ? (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">Uang Diterima (Rp)</label>
                          <input
                            type="number"
                            min={0}
                            value={receivedCash}
                            onChange={(e) => setReceivedCash(e.target.value)}
                            placeholder={String(paymentPreviewAmount)}
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
                          />
                          <p className="text-[11px] text-teal-800 font-mono tabular-nums mt-0.5">
                            Kembalian: {formatCurrencyIDR(changePreview)}
                          </p>
                        </div>
                      ) : (
                        <div>
                          <label className="block text-xs font-semibold text-slate-700 mb-1">
                            No. Referensi / Bukti Transfer
                          </label>
                          <input
                            type="text"
                            value={referenceNo}
                            onChange={(e) => setReferenceNo(e.target.value)}
                            placeholder="Ref QRIS / No. Rek / EDC"
                            className="w-full px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
                          />
                        </div>
                      )}
                      <div className="lg:pt-5">
                        <button
                          type="submit"
                          disabled={processingPayment}
                          className="w-full py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 disabled:opacity-60 whitespace-nowrap"
                        >
                          {processingPayment ? 'Memproses...' : 'Bayar & Cetak Kuitansi'}
                        </button>
                      </div>
                    </div>
                  </form>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: INVOICES ====================
  if (activeView === 'invoices') {
    const filtered = dbState.invoices.filter((inv) => {
      const matchQuery =
        !invoiceQuery.trim() ||
        inv.patientName.toLowerCase().includes(invoiceQuery.toLowerCase()) ||
        inv.invoiceNumber.toLowerCase().includes(invoiceQuery.toLowerCase()) ||
        inv.patientRm.toLowerCase().includes(invoiceQuery.toLowerCase());
      const matchStatus = invoiceStatusFilter === 'ALL' || inv.status === invoiceStatusFilter;
      return matchQuery && matchStatus;
    });

    return (
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Daftar Tagihan Pasien</h1>
            <p className="text-sm text-slate-500">Pemantauan seluruh faktur kunjungan, status pelunasan, dan sisa piutang.</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={invoiceQuery}
                onChange={(e) => setInvoiceQuery(e.target.value)}
                placeholder="Cari pasien / No. Tagihan..."
                className="pl-8 pr-3 py-2 text-xs bg-white border border-slate-200 rounded-lg w-56"
              />
            </div>
            <select
              value={invoiceStatusFilter}
              onChange={(e) => setInvoiceStatusFilter(e.target.value)}
              className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
            >
              <option value="ALL">Semua Status</option>
              <option value="Belum Dibayar">Belum Dibayar</option>
              <option value="Piutang">Piutang</option>
              <option value="Lunas">Lunas</option>
              <option value="Dibatalkan">Dibatalkan</option>
            </select>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">No. Tagihan</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-center font-semibold">Item</th>
                  <th className="px-4 py-3 text-right font-semibold">Total</th>
                  <th className="px-4 py-3 text-right font-semibold">Terbayar</th>
                  <th className="px-4 py-3 text-right font-semibold">Sisa</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono tabular-nums font-medium text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{inv.patientName}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{inv.patientRm}</p>
                    </td>
                    <td className="px-4 py-3 text-center font-mono tabular-nums">{inv.items.length}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-medium">
                      {formatCurrencyIDR(inv.total)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                      {formatCurrencyIDR(inv.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-red-700 font-semibold">
                      {formatCurrencyIDR(inv.remainingAmount)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`font-semibold ${
                          inv.status === 'Lunas'
                            ? 'text-emerald-700'
                            : inv.status === 'Piutang'
                              ? 'text-amber-700'
                              : 'text-red-700'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right space-x-2.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceId(inv.id);
                          setActiveView('cashier');
                        }}
                        className="text-xs font-semibold text-teal-700 hover:text-teal-900 whitespace-nowrap"
                      >
                        {inv.remainingAmount > 0 ? 'Proses Kasir' : 'Detail'}
                      </button>
                      {isSuperAdmin &&
                        (confirmDeleteTxKey === `inv:${inv.id}` ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteInvoice(inv)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTxKey(null)}
                              className="text-slate-500 hover:text-slate-800"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTxKey(`inv:${inv.id}`)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        ))}
                    </td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada tagihan yang sesuai kriteria pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: PAYMENTS & REFUNDS ====================
  if (activeView === 'payments') {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Riwayat Pembayaran, Kuitansi &amp; Refund</h1>
          <p className="text-sm text-slate-500">
            Cetak ulang kuitansi resmi, pembatalan transaksi berotorisasi, dan pengelolaan pengembalian dana (refund).
          </p>
        </div>

        {/* Refund Modal / Inline Drawer */}
        {refundTargetPayment && (
          <form
            onSubmit={handleSubmitRefund}
            className="bg-amber-50/70 border border-amber-200 rounded-xl p-5 space-y-3"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold text-slate-900">
                Ajukan Pengembalian Dana (Refund) — {refundTargetPayment.receiptNumber}
              </p>
              <button
                type="button"
                onClick={() => setRefundTargetPayment(null)}
                className="text-xs text-slate-500 hover:text-slate-800"
              >
                Tutup
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <input
                type="number"
                max={refundTargetPayment.amount}
                min={1}
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
                placeholder={`Maks ${refundTargetPayment.amount}`}
                className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg font-mono tabular-nums"
              />
              <input
                type="text"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="Alasan refund (wajib)"
                className="sm:col-span-2 px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-amber-700 text-white text-xs font-semibold hover:bg-amber-800 whitespace-nowrap"
            >
              {isRefundApprover ? 'Setujui & Proses Refund Langsung' : 'Kirim Permintaan Otorisasi Super Admin'}
            </button>
          </form>
        )}

        {/* Payments Table */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">No. Kuitansi</th>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-left font-semibold">Metode</th>
                  <th className="px-4 py-3 text-right font-semibold">Nominal</th>
                  <th className="px-4 py-3 text-left font-semibold">Kasir</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.payments.map((p) => {
                  const inv = dbState.invoices.find((i) => i.id === p.invoiceId);
                  return (
                    <React.Fragment key={p.id}>
                      <tr className="hover:bg-slate-50/70">
                        <td className="px-4 py-3 font-mono font-semibold text-slate-900">{p.receiptNumber}</td>
                        <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{p.paymentDate}</td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-900">{p.patientName}</p>
                          <p className="text-[11px] text-slate-500 font-mono">{p.invoiceNumber}</p>
                        </td>
                        <td className="px-4 py-3 text-slate-700">{p.method}</td>
                        <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                          {formatCurrencyIDR(p.amount)}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{p.cashierName}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`font-semibold ${
                              p.status === 'Sukses'
                                ? 'text-emerald-700'
                                : p.status === 'Dikembalikan'
                                  ? 'text-amber-700'
                                  : 'text-red-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() =>
                              setPrintPayload({
                                type: 'kuitansi',
                                title: 'KUITANSI PEMBAYARAN',
                                subtitle: p.receiptNumber,
                                data: {
                                  patientName: p.patientName,
                                  patientRm: p.patientRm,
                                  receiptNumber: p.receiptNumber,
                                  method: p.method,
                                  items: inv?.items || [],
                                  subtotal: inv?.subtotal || p.amount,
                                  discount: inv?.discount || 0,
                                  total: inv?.total || p.amount,
                                  amount: p.amount,
                                  remainingAmount: inv?.remainingAmount || 0,
                                  cashierName: p.cashierName
                                }
                              })
                            }
                            className="inline-flex items-center gap-1 text-teal-700 hover:text-teal-900 font-semibold"
                          >
                            <Printer className="w-3.5 h-3.5" />
                            Kuitansi
                          </button>
                          {p.status === 'Sukses' && (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  setRefundTargetPayment(p);
                                  setRefundAmount(String(p.amount));
                                }}
                                className="inline-flex items-center gap-1 text-amber-700 hover:text-amber-900 font-semibold"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                Refund
                              </button>
                              <button
                                type="button"
                                onClick={() => setCancelTargetId(cancelTargetId === p.id ? null : p.id)}
                                className="inline-flex items-center gap-1 text-red-700 hover:text-red-900 font-semibold"
                              >
                                <Ban className="w-3.5 h-3.5" />
                                Batal
                              </button>
                            </>
                          )}
                          {isSuperAdmin &&
                            (confirmDeleteTxKey === `pay:${p.id}` ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => void handleDeletePayment(p)}
                                  className="px-2 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                                >
                                  Ya, Hapus
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTxKey(null)}
                                  className="text-slate-500 hover:text-slate-800"
                                >
                                  Batal
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteTxKey(`pay:${p.id}`)}
                                className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                Hapus
                              </button>
                            ))}
                        </td>
                      </tr>
                      {cancelTargetId === p.id && (
                        <tr className="bg-red-50/60">
                          <td colSpan={8} className="px-4 py-3">
                            <div className="flex flex-wrap items-center gap-2">
                              <input
                                type="text"
                                value={cancelReason}
                                onChange={(e) => setCancelReason(e.target.value)}
                                placeholder="Masukkan alasan pembatalan transaksi..."
                                className="flex-1 min-w-[220px] px-3 py-1.5 text-xs bg-white border border-red-200 rounded-lg"
                              />
                              <button
                                type="button"
                                onClick={() => handleCancelPayment(p)}
                                className="px-3 py-1.5 rounded-lg bg-red-700 text-white text-xs font-semibold hover:bg-red-800 whitespace-nowrap"
                              >
                                Konfirmasi Pembatalan
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
                {dbState.payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                      Belum ada transaksi pembayaran tercatat.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Refunds Ledger */}
        {dbState.refunds.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200">
              <h2 className="text-sm font-bold text-slate-900">Daftar Pengajuan &amp; Otorisasi Refund</h2>
            </div>
            <div className="divide-y divide-slate-100">
              {dbState.refunds.map((ref) => (
                <div key={ref.id} className="px-5 py-3.5 flex flex-wrap items-center justify-between gap-4 text-xs">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {ref.receiptNumber} · {ref.patientName} —{' '}
                      <span className="font-mono tabular-nums text-red-700">{formatCurrencyIDR(ref.amount)}</span>
                    </p>
                    <p className="text-slate-500 mt-0.5">Alasan: {ref.reason}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`font-semibold ${
                        ref.status === 'Disetujui'
                          ? 'text-emerald-700'
                          : ref.status === 'Ditolak'
                            ? 'text-red-700'
                            : 'text-amber-700'
                      }`}
                    >
                      {ref.status}
                    </span>
                    {ref.status === 'Menunggu Persetujuan' && isRefundApprover && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleReviewRefund(ref, true)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-semibold hover:bg-emerald-800 whitespace-nowrap"
                        >
                          Setujui
                        </button>
                        <button
                          type="button"
                          onClick={() => handleReviewRefund(ref, false)}
                          className="px-3 py-1.5 rounded-lg border border-red-200 text-red-700 font-semibold hover:bg-red-50 whitespace-nowrap"
                        >
                          Tolak
                        </button>
                      </>
                    )}
                    {isSuperAdmin &&
                      (confirmDeleteTxKey === `ref:${ref.id}` ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void handleDeleteRefund(ref)}
                            className="px-2.5 py-1 rounded bg-red-600 text-white font-semibold hover:bg-red-700"
                          >
                            Ya, Hapus
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTxKey(null)}
                            className="text-slate-500 hover:text-slate-800"
                          >
                            Batal
                          </button>
                        </>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setConfirmDeleteTxKey(`ref:${ref.id}`)}
                          className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          Hapus
                        </button>
                      ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==================== VIEW: RECEIVABLES (PIUTANG) ====================
  if (activeView === 'receivables') {
    const totalReceivables = unpaidOrPartialInvoices.reduce((sum, inv) => sum + inv.remainingAmount, 0);
    return (
      <div className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Manajemen Piutang Pasien</h1>
            <p className="text-sm text-slate-500">Daftar tagihan belum lunas dan pembayaran cicilan yang masih berjalan.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-right">
            <p className="text-xs text-slate-500">Total Saldo Piutang Aktif</p>
            <p className="text-lg font-bold font-mono tabular-nums text-red-700">
              {formatCurrencyIDR(totalReceivables)}
            </p>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">No. Tagihan</th>
                  <th className="px-4 py-3 text-left font-semibold">Pasien</th>
                  <th className="px-4 py-3 text-right font-semibold">Total Tagihan</th>
                  <th className="px-4 py-3 text-right font-semibold">Sudah Dibayar</th>
                  <th className="px-4 py-3 text-right font-semibold">Sisa Piutang</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  <th className="px-4 py-3 text-right font-semibold">Pelunasan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaidOrPartialInvoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3 font-mono font-semibold text-slate-900">{inv.invoiceNumber}</td>
                    <td className="px-4 py-3">
                      <p className="font-semibold text-slate-900">{inv.patientName}</p>
                      <p className="text-[11px] font-mono text-slate-500">{inv.patientRm}</p>
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">{formatCurrencyIDR(inv.total)}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums text-emerald-700">
                      {formatCurrencyIDR(inv.paidAmount)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-bold text-red-700">
                      {formatCurrencyIDR(inv.remainingAmount)}
                    </td>
                    <td className="px-4 py-3 font-semibold text-amber-700">{inv.status}</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedInvoiceId(inv.id);
                          setPayAmount(String(inv.remainingAmount));
                          setActiveView('cashier');
                        }}
                        className="px-3 py-1.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
                      >
                        Bayar Cicilan / Lunasi
                      </button>
                    </td>
                  </tr>
                ))}
                {unpaidOrPartialInvoices.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                      Tidak ada saldo piutang aktif saat ini.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: CASH IN ====================
  if (activeView === 'cash-in') {
    const cashIns = dbState.cash_transactions.filter((t) => t.type === 'Masuk');
    const totalIn = cashIns.reduce((sum, t) => sum + t.amount, 0);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kas Masuk Praktik</h1>
            <p className="text-sm text-slate-500">Rekam seluruh penerimaan kas dari pembayaran pasien maupun penerimaan lain.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-right">
            <p className="text-xs text-slate-500">Akumulasi Kas Masuk</p>
            <p className="text-lg font-bold font-mono tabular-nums text-emerald-700">{formatCurrencyIDR(totalIn)}</p>
          </div>
        </div>

        <form
          onSubmit={handleRecordManualCashIn}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={cashInForm.date}
              onChange={(e) => setCashInForm({ ...cashInForm, date: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div className="lg:col-span-1">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori</label>
            <input
              type="text"
              value={cashInForm.category}
              onChange={(e) => setCashInForm({ ...cashInForm, category: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Keterangan</label>
            <input
              type="text"
              value={cashInForm.description}
              onChange={(e) => setCashInForm({ ...cashInForm, description: e.target.value })}
              placeholder="Contoh: Tambahan modal kas kecil"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              min={1}
              value={cashInForm.amount}
              onChange={(e) => setCashInForm({ ...cashInForm, amount: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            Catat Kas Masuk
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                  <th className="px-4 py-3 text-left font-semibold">Metode</th>
                  <th className="px-4 py-3 text-right font-semibold">Nominal</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashIns.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{t.transactionDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.category}</td>
                    <td className="px-4 py-3 text-slate-700">{t.description}</td>
                    <td className="px-4 py-3 text-slate-600">{t.method}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-emerald-700">
                      <span className="inline-flex items-center gap-1">
                        <ArrowDownLeft className="w-3 h-3" />
                        {formatCurrencyIDR(t.amount)}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {confirmDeleteTxKey === `ctx:${t.id}` ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCashTransaction(t)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTxKey(null)}
                              className="text-slate-500"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTxKey(`ctx:${t.id}`)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {cashIns.length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                      Belum ada pencatatan kas masuk.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: CASH OUT / EXPENSES ====================
  if (activeView === 'cash-out') {
    const cashOuts = dbState.cash_transactions.filter((t) => t.type === 'Keluar');
    const totalOut = cashOuts.reduce((sum, t) => sum + t.amount, 0);
    return (
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Kas Keluar &amp; Pengeluaran Operasional</h1>
            <p className="text-sm text-slate-500">Catat pembelian alkes, obat habis pakai, utilitas, dan biaya operasional praktik.</p>
          </div>
          <div className="bg-white border border-slate-200 rounded-xl px-5 py-3 text-right">
            <p className="text-xs text-slate-500">Akumulasi Kas Keluar</p>
            <p className="text-lg font-bold font-mono tabular-nums text-red-700">{formatCurrencyIDR(totalOut)}</p>
          </div>
        </div>

        <form
          onSubmit={handleRecordExpense}
          className="bg-white border border-slate-200 rounded-xl p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-3 items-end"
        >
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tanggal</label>
            <input
              type="date"
              value={expenseForm.expenseDate}
              onChange={(e) => setExpenseForm({ ...expenseForm, expenseDate: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Kategori Biaya</label>
            <select
              value={expenseForm.category}
              onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg bg-white"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
          <div className="lg:col-span-2">
            <label className="block text-xs font-semibold text-slate-700 mb-1">Deskripsi Pengeluaran</label>
            <input
              type="text"
              value={expenseForm.description}
              onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
              placeholder="Contoh: Gel USG 5L + Kertas Thermal"
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nominal (Rp)</label>
            <input
              type="number"
              min={1}
              value={expenseForm.amount}
              onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg font-mono tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="py-2 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
          >
            Simpan Kas Keluar
          </button>
        </form>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Kategori</th>
                  <th className="px-4 py-3 text-left font-semibold">Keterangan</th>
                  <th className="px-4 py-3 text-left font-semibold">Metode</th>
                  <th className="px-4 py-3 text-right font-semibold">Nominal</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {cashOuts.map((t) => (
                  <tr key={t.id}>
                    <td className="px-4 py-3 font-mono tabular-nums text-slate-600">{t.transactionDate}</td>
                    <td className="px-4 py-3 font-medium text-slate-800">{t.category}</td>
                    <td className="px-4 py-3 text-slate-700">{t.description}</td>
                    <td className="px-4 py-3 text-slate-600">{t.method}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums font-semibold text-red-700">
                      <span className="inline-flex items-center gap-1">
                        <ArrowUpRight className="w-3 h-3" />
                        {formatCurrencyIDR(t.amount)}
                      </span>
                    </td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {confirmDeleteTxKey === `ctx:${t.id}` ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCashTransaction(t)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTxKey(null)}
                              className="text-slate-500"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTxKey(`ctx:${t.id}`)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
                {cashOuts.length === 0 && (
                  <tr>
                    <td colSpan={isSuperAdmin ? 6 : 5} className="px-4 py-8 text-center text-slate-500">
                      Belum ada pencatatan kas keluar.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: DAILY CASH CLOSE ====================
  if (activeView === 'cash-close') {
    const previewVariance =
      openSession && actualClosingInput !== ''
        ? calculateCashSessionVariance(
            openSession.openingBalance,
            openSessionCashTotals.cashIn,
            openSessionCashTotals.cashOut,
            Number(actualClosingInput)
          )
        : null;

    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Buka &amp; Tutup Kas Harian</h1>
          <p className="text-sm text-slate-500">
            Rekonsiliasi saldo kas fisik laci dengan catatan transaksi sistem harian dan deteksi selisih kas.
          </p>
        </div>

        {!openSession ? (
          <form
            onSubmit={handleOpenCashSession}
            className="bg-white border border-slate-200 rounded-xl p-6 max-w-lg space-y-4"
          >
            <div className="flex items-center gap-2.5">
              <Wallet className="w-5 h-5 text-teal-700" />
              <h2 className="text-sm font-bold text-slate-900">Buka Sesi Kas Harian ({today})</h2>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Modal / Saldo Awal Kas (Rp)</label>
              <input
                type="number"
                min={0}
                value={openingBalanceInput}
                onChange={(e) => setOpeningBalanceInput(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
            >
              Buka Sesi Kasir Sekarang
            </button>
          </form>
        ) : (
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
              <div>
                <p className="text-xs font-semibold text-emerald-700">Sesi Kas Sedang Terbuka</p>
                <h2 className="text-base font-bold text-slate-900">
                  Tanggal {openSession.sessionDate} · Dibuka oleh {openSession.openedBy}
                </h2>
              </div>
              <p className="text-xs font-mono tabular-nums text-slate-500">
                Dibuka: {new Date(openSession.openedAt).toLocaleTimeString('id-ID')}
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Saldo Awal</p>
                <p className="text-base font-bold font-mono tabular-nums text-slate-900 mt-1">
                  {formatCurrencyIDR(openSession.openingBalance)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Kas Masuk Tunai</p>
                <p className="text-base font-bold font-mono tabular-nums text-emerald-700 mt-1">
                  +{formatCurrencyIDR(openSessionCashTotals.cashIn)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-slate-50 border border-slate-200">
                <p className="text-xs text-slate-500">Kas Keluar Tunai</p>
                <p className="text-base font-bold font-mono tabular-nums text-red-700 mt-1">
                  -{formatCurrencyIDR(openSessionCashTotals.cashOut)}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-teal-50/70 border border-teal-200">
                <p className="text-xs text-teal-800 font-semibold">Saldo Seharusnya (Sistem)</p>
                <p className="text-base font-bold font-mono tabular-nums text-teal-900 mt-1">
                  {formatCurrencyIDR(openSessionCashTotals.expected)}
                </p>
              </div>
            </div>

            <form onSubmit={handleCloseCashSession} className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hasil Hitung Kas Fisik Aktual (Rp)
                </label>
                <input
                  type="number"
                  min={0}
                  value={actualClosingInput}
                  onChange={(e) => setActualClosingInput(e.target.value)}
                  placeholder={String(openSessionCashTotals.expected)}
                  className="w-full px-3 py-2 text-sm border border-slate-200 rounded-lg font-mono tabular-nums"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Catatan Tutup Kas</label>
                <input
                  type="text"
                  value={closingNotes}
                  onChange={(e) => setClosingNotes(e.target.value)}
                  placeholder="Catatan serah terima / selisih"
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-lg"
                />
              </div>
              <button
                type="submit"
                className="py-2.5 px-4 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                Konfirmasi Tutup Kas Harian
              </button>
            </form>

            {previewVariance && (
              <div
                className={`p-3.5 rounded-lg border text-xs flex items-center gap-2 ${
                  previewVariance.variance === 0
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}
              >
                {previewVariance.variance === 0 ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                <span>
                  Pratinjau Selisih Kas:{' '}
                  <strong className="font-mono tabular-nums">
                    {formatCurrencyIDR(previewVariance.variance)}
                  </strong>{' '}
                  {previewVariance.variance === 0 ? '(Sesuai / Balance)' : '(Terdapat selisih fisik vs sistem)'}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Historical Cash Sessions */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-200">
            <h2 className="text-sm font-bold text-slate-900">Riwayat Sesi Tutup Kas</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Tanggal</th>
                  <th className="px-4 py-3 text-left font-semibold">Petugas</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo Awal</th>
                  <th className="px-4 py-3 text-right font-semibold">Saldo Sistem</th>
                  <th className="px-4 py-3 text-right font-semibold">Kas Fisik</th>
                  <th className="px-4 py-3 text-right font-semibold">Selisih</th>
                  <th className="px-4 py-3 text-left font-semibold">Status</th>
                  {isSuperAdmin && <th className="px-4 py-3 text-right font-semibold">Aksi</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {dbState.cash_sessions.map((s) => (
                  <tr key={s.id}>
                    <td className="px-4 py-3 font-mono tabular-nums">{s.sessionDate}</td>
                    <td className="px-4 py-3 text-slate-800">{s.closedBy || s.openedBy}</td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCurrencyIDR(s.openingBalance)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {formatCurrencyIDR(s.expectedBalance)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono tabular-nums">
                      {s.actualClosingBalance !== undefined ? formatCurrencyIDR(s.actualClosingBalance) : '-'}
                    </td>
                    <td
                      className={`px-4 py-3 text-right font-mono tabular-nums font-semibold ${
                        (s.variance || 0) === 0 ? 'text-emerald-700' : 'text-red-700'
                      }`}
                    >
                      {s.variance !== undefined ? formatCurrencyIDR(s.variance) : '-'}
                    </td>
                    <td className="px-4 py-3 font-semibold text-slate-700">{s.status}</td>
                    {isSuperAdmin && (
                      <td className="px-4 py-3 text-right whitespace-nowrap space-x-2">
                        {confirmDeleteTxKey === `cs:${s.id}` ? (
                          <>
                            <button
                              type="button"
                              onClick={() => void handleDeleteCashSession(s)}
                              className="px-2 py-1 rounded bg-red-600 text-white font-semibold"
                            >
                              Ya, Hapus
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteTxKey(null)}
                              className="text-slate-500"
                            >
                              Batal
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteTxKey(`cs:${s.id}`)}
                            className="inline-flex items-center gap-1 text-red-600 hover:text-red-800 font-semibold"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Hapus
                          </button>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // ==================== VIEW: FINANCE REPORTS (P&L) ====================
  const periodPayments = dbState.payments.filter(
    (p) => p.status === 'Sukses' && p.paymentDate >= reportStart && p.paymentDate <= reportEnd
  );
  const periodExpenses = dbState.expenses.filter(
    (e) => e.expenseDate >= reportStart && e.expenseDate <= reportEnd
  );
  const totalRevenue = periodPayments.reduce((s, p) => s + p.amount, 0);
  const totalExpense = periodExpenses.reduce((s, e) => s + e.amount, 0);
  const netProfit = totalRevenue - totalExpense;
  const outstandingPiutang = unpaidOrPartialInvoices.reduce((s, i) => s + i.remainingAmount, 0);

  const methodBreakdown = PAYMENT_METHODS.map((method) => ({
    method,
    total: periodPayments.filter((p) => p.method === method).reduce((s, p) => s + p.amount, 0)
  })).filter((m) => m.total > 0);

  const handleExportFinanceCsv = () => {
    const csv = exportRowsToCsv(
      ['Tanggal', 'Jenis', 'Kategori', 'Keterangan', 'Metode', 'Nominal'],
      dbState.cash_transactions
        .filter((t) => t.transactionDate >= reportStart && t.transactionDate <= reportEnd)
        .map((t) => [t.transactionDate, t.type, t.category, t.description, t.method, t.amount])
    );
    downloadCsvFile(`laporan-keuangan-${reportStart}-${reportEnd}.csv`, csv);
    notifyToast('File CSV Laporan Keuangan diunduh.', 'success');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Laporan Keuangan &amp; Laba Rugi</h1>
          <p className="text-sm text-slate-500">Ringkasan pendapatan, pengeluaran operasional, piutang, dan metode pembayaran.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="date"
            value={reportStart}
            onChange={(e) => setReportStart(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
          />
          <span className="text-xs text-slate-500">s.d.</span>
          <input
            type="date"
            value={reportEnd}
            onChange={(e) => setReportEnd(e.target.value)}
            className="px-3 py-2 text-xs bg-white border border-slate-200 rounded-lg"
          />
          <button
            type="button"
            onClick={handleExportFinanceCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 whitespace-nowrap"
          >
            <Download className="w-3.5 h-3.5" />
            Export CSV
          </button>
          <button
            type="button"
            onClick={() =>
              setPrintPayload({
                type: 'laporan',
                title: 'LAPORAN KEUANGAN PRAKTIK',
                subtitle: `${reportStart} s.d. ${reportEnd}`,
                data: {
                  content: [
                    `Periode Laporan: ${reportStart} sampai ${reportEnd}`,
                    `Total Pendapatan Diterima: ${formatCurrencyIDR(totalRevenue)}`,
                    `Total Pengeluaran Operasional: ${formatCurrencyIDR(totalExpense)}`,
                    `Laba Bersih Periode: ${formatCurrencyIDR(netProfit)}`,
                    `Total Piutang Pasien Berjalan: ${formatCurrencyIDR(outstandingPiutang)}`,
                    '',
                    'Rincian per Metode Pembayaran:',
                    ...methodBreakdown.map((m) => `- ${m.method}: ${formatCurrencyIDR(m.total)}`)
                  ].join('\n')
                }
              })
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-teal-700 text-white text-xs font-semibold hover:bg-teal-800 whitespace-nowrap"
          >
            <Printer className="w-3.5 h-3.5" />
            Cetak PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pendapatan Periode</p>
          <p className="text-xl font-bold font-mono tabular-nums text-emerald-700 mt-1">
            {formatCurrencyIDR(totalRevenue)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Pengeluaran Operasional</p>
          <p className="text-xl font-bold font-mono tabular-nums text-red-700 mt-1">
            {formatCurrencyIDR(totalExpense)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Laba Bersih</p>
          <p className="text-xl font-bold font-mono tabular-nums text-teal-800 mt-1">
            {formatCurrencyIDR(netProfit)}
          </p>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-5">
          <p className="text-xs text-slate-500">Piutang Berjalan</p>
          <p className="text-xl font-bold font-mono tabular-nums text-amber-700 mt-1">
            {formatCurrencyIDR(outstandingPiutang)}
          </p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5">
        <h2 className="text-sm font-bold text-slate-900 mb-4">Distribusi Penerimaan per Metode Pembayaran</h2>
        {methodBreakdown.length === 0 ? (
          <p className="text-xs text-slate-500 py-8 text-center">Belum ada transaksi sukses pada rentang tanggal ini.</p>
        ) : (
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={methodBreakdown}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip formatter={(val) => formatCurrencyIDR(Number(val ?? 0))} />
                <Bar dataKey="total" fill="#0f766e" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>
    </div>
  );
};
