import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { apiCall } from '../lib/supabase';
import { formatDateBR } from '../lib/date-utils';
import { toast } from 'sonner';
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Clock,
  Phone,
  FileText,
  MessageSquare,
} from 'lucide-react';

interface CalendarInstallment {
  id: string;
  contractId: string;
  contractNumber: string;
  clientName: string;
  clientPhone: string;
  number: number;
  total: number;
  dueDate: string; // YYYY-MM-DD
  status: 'pending' | 'paid' | 'overdue';
  paidAt: string | null;
  paidAmount: number | null;
  amount: number;
}

interface CalendarSummary {
  total: number;
  pending: number;
  paid: number;
  overdue: number;
}

type StatusFilter = 'all' | 'pending' | 'overdue' | 'paid';

const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

const MONTH_NAMES = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
];

const STATUS_INFO: Record<string, { label: string; pill: string; badge: string }> = {
  pending: {
    label: 'Pendente',
    pill: 'bg-[#fef3c7] text-amber-900 hover:bg-amber-200',
    badge: 'bg-amber-100 text-amber-800',
  },
  paid: {
    label: 'Pago',
    pill: 'bg-[#d1fae5] text-emerald-900 hover:bg-emerald-200',
    badge: 'bg-emerald-100 text-emerald-800',
  },
  overdue: {
    label: 'Atrasado',
    pill: 'bg-[#fee2e2] text-red-900 hover:bg-red-200',
    badge: 'bg-red-100 text-red-800',
  },
};

const formatCurrency = (value: number) =>
  (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const localDateStr = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

export default function BillingCalendar() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [loading, setLoading] = useState(true);
  const [installments, setInstallments] = useState<CalendarInstallment[]>([]);
  const [summary, setSummary] = useState<CalendarSummary>({ total: 0, pending: 0, paid: 0, overdue: 0 });
  const [filter, setFilter] = useState<StatusFilter>('all');

  const [selected, setSelected] = useState<CalendarInstallment | null>(null);
  const [dayDetails, setDayDetails] = useState<number | null>(null);

  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState('');
  const [paymentLoading, setPaymentLoading] = useState(false);

  const todayStr = localDateStr(new Date());

  useEffect(() => {
    loadCalendar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [year, month]);

  const loadCalendar = async () => {
    try {
      setLoading(true);
      const response = await apiCall(`/billing/calendar?year=${year}&month=${month}`);
      setInstallments(response.installments || []);
      setSummary(response.summary || { total: 0, pending: 0, paid: 0, overdue: 0 });
    } catch (error: any) {
      console.error('[BILLING_CALENDAR] Erro ao carregar:', error);
      toast.error('Erro ao carregar calendário: ' + (error.message || 'Erro desconhecido'));
      setInstallments([]);
      setSummary({ total: 0, pending: 0, paid: 0, overdue: 0 });
    } finally {
      setLoading(false);
    }
  };

  const goToPreviousMonth = () => {
    if (month === 1) {
      setMonth(12);
      setYear((y) => y - 1);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (month === 12) {
      setMonth(1);
      setYear((y) => y + 1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const filteredInstallments = useMemo(
    () => installments.filter((inst) => filter === 'all' || inst.status === filter),
    [installments, filter]
  );

  // Group installments by day of month
  const installmentsByDay = useMemo(() => {
    const map = new Map<number, CalendarInstallment[]>();
    for (const inst of filteredInstallments) {
      const day = parseInt(inst.dueDate.split('-')[2], 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(inst);
    }
    return map;
  }, [filteredInstallments]);

  // Amount totals for the summary cards
  const totals = useMemo(() => {
    let pending = 0;
    let paid = 0;
    let overdue = 0;
    let today = 0;
    for (const inst of installments) {
      if (inst.status === 'paid') paid += inst.paidAmount ?? inst.amount;
      if (inst.status === 'pending') pending += inst.amount;
      if (inst.status === 'overdue') overdue += inst.amount;
      if (inst.dueDate === todayStr && inst.status !== 'paid') today += inst.amount;
    }
    return { pending, paid, overdue, today };
  }, [installments, todayStr]);

  // Calendar grid cells (leading blanks + days of the month)
  const calendarCells = useMemo(() => {
    const firstWeekday = new Date(year, month - 1, 1).getDay(); // 0 = Sunday
    const daysInMonth = new Date(year, month, 0).getDate();
    const cells: (number | null)[] = [];
    for (let i = 0; i < firstWeekday; i++) cells.push(null);
    for (let day = 1; day <= daysInMonth; day++) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [year, month]);

  const dateStrOf = (day: number) =>
    `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const openInstallment = (inst: CalendarInstallment) => {
    setDayDetails(null);
    setSelected(inst);
    setShowPaymentForm(false);
    setPaymentAmount(String((inst.amount || 0).toFixed(2)));
    setPaymentDate(todayStr);
  };

  const closeModal = () => {
    setSelected(null);
    setShowPaymentForm(false);
  };

  const handleRegisterPayment = async () => {
    if (!selected) return;

    const amount = parseFloat(paymentAmount.replace(',', '.'));
    if (!amount || amount <= 0) {
      toast.error('Informe um valor válido');
      return;
    }

    try {
      setPaymentLoading(true);
      await apiCall(`/contracts/${selected.contractId}/installments/${selected.number}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amount,
          paymentDate: paymentDate || todayStr,
        }),
      });
      toast.success('Pagamento registrado com sucesso!');
      closeModal();
      loadCalendar();
    } catch (error: any) {
      console.error('[BILLING_CALENDAR] Erro ao registrar pagamento:', error);
      toast.error(error.message || 'Erro ao registrar pagamento');
    } finally {
      setPaymentLoading(false);
    }
  };

  const openWhatsApp = (phone: string) => {
    const digits = (phone || '').replace(/\D/g, '');
    if (!digits) {
      toast.error('Cliente não possui telefone cadastrado');
      return;
    }
    const number = digits.startsWith('55') ? digits : `55${digits}`;
    window.open(`https://wa.me/${number}`, '_blank');
  };

  const filterButtons: { key: StatusFilter; label: string; count: number }[] = [
    { key: 'all', label: 'Todos', count: summary.total },
    { key: 'pending', label: 'Pendentes', count: summary.pending },
    { key: 'overdue', label: 'Atrasados', count: summary.overdue },
    { key: 'paid', label: 'Pagos', count: summary.paid },
  ];

  const summaryCards = [
    {
      label: 'A receber',
      value: totals.pending,
      icon: Clock,
      accent: 'text-amber-300',
    },
    {
      label: 'Recebido',
      value: totals.paid,
      icon: CheckCircle,
      accent: 'text-emerald-300',
    },
    {
      label: 'Em atraso',
      value: totals.overdue,
      icon: AlertTriangle,
      accent: 'text-red-300',
    },
    {
      label: 'Hoje',
      value: totals.today,
      icon: CalendarIcon,
      accent: 'text-blue-300',
    },
  ];

  const dayDetailsList = dayDetails !== null ? installmentsByDay.get(dayDetails) || [] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-emerald-900 to-emerald-800 rounded-2xl shadow-lg border-b-4 border-amber-500 p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="bg-amber-500 rounded-xl p-2.5">
              <CalendarIcon className="h-6 w-6 text-emerald-950" />
            </div>
            <div>
              <h1 className="text-xl md:text-2xl font-bold text-white">Calendário de Cobranças</h1>
              <p className="text-sm text-emerald-100">Todos os pagamentos do mês em um só lugar</p>
            </div>
          </div>

          {/* Month navigation */}
          <div className="flex items-center gap-2 bg-emerald-950/40 rounded-xl px-2 py-1.5">
            <button
              onClick={goToPreviousMonth}
              className="p-2 rounded-lg text-amber-300 hover:bg-emerald-800 transition-colors"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <span className="text-white font-semibold min-w-[160px] text-center">
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <button
              onClick={goToNextMonth}
              className="p-2 rounded-lg text-amber-300 hover:bg-emerald-800 transition-colors"
              aria-label="Próximo mês"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {summaryCards.map(({ label, value, icon: Icon, accent }) => (
            <div key={label} className="bg-emerald-950/40 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`h-4 w-4 ${accent}`} />
                <p className="text-xs text-emerald-100">{label}</p>
              </div>
              <p className="text-lg md:text-xl font-bold text-white truncate">
                {formatCurrency(value)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap gap-2">
        {filterButtons.map(({ key, label, count }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors shadow-sm ${
              filter === key
                ? 'bg-emerald-900 text-amber-300'
                : 'bg-white text-gray-700 hover:bg-emerald-50 border border-gray-200'
            }`}
          >
            {label} <span className="opacity-70">({count})</span>
          </button>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-2xl shadow-md overflow-hidden border border-gray-200">
        {loading ? (
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-700"></div>
          </div>
        ) : (
          <>
            {/* Weekday headers */}
            <div className="grid grid-cols-7 bg-emerald-900">
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  className="py-2 text-center text-xs md:text-sm font-semibold text-amber-300"
                >
                  {day}
                </div>
              ))}
            </div>

            {/* Day cells */}
            <div className="grid grid-cols-7">
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div key={`empty-${index}`} className="bg-gray-50/60 border-b border-r border-gray-100 min-h-[90px] md:min-h-[110px]" />;
                }

                const dayInstallments = installmentsByDay.get(day) || [];
                const isToday = dateStrOf(day) === todayStr;
                const isWeekend = index % 7 === 0 || index % 7 === 6;
                const hasOverdue = dayInstallments.some((inst) => inst.status === 'overdue');

                return (
                  <div
                    key={day}
                    className={`relative border-b border-r border-gray-100 min-h-[90px] md:min-h-[110px] p-1.5 flex flex-col gap-1 ${
                      hasOverdue ? 'bg-red-50/40' : isWeekend ? 'bg-gray-50' : 'bg-white'
                    }`}
                  >
                    <span
                      className={`inline-flex items-center justify-center text-xs font-semibold w-6 h-6 rounded-full ${
                        isToday ? 'bg-amber-400 text-white shadow' : 'text-gray-600'
                      }`}
                    >
                      {day}
                    </span>

                    {dayInstallments.slice(0, 2).map((inst) => (
                      <button
                        key={inst.id}
                        onClick={() => openInstallment(inst)}
                        title={`${inst.clientName} - ${formatCurrency(inst.amount)}`}
                        className={`w-full text-left px-1.5 py-0.5 rounded-md text-[10px] md:text-xs font-medium truncate transition-colors ${STATUS_INFO[inst.status].pill}`}
                      >
                        {inst.clientName.split(' ')[0]} · {formatCurrency(inst.amount)}
                      </button>
                    ))}

                    {dayInstallments.length > 2 && (
                      <button
                        onClick={() => setDayDetails(day)}
                        className="text-[10px] md:text-xs text-emerald-700 hover:text-emerald-900 font-semibold text-left px-1.5"
                      >
                        +{dayInstallments.length - 2} mais
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {!loading && installments.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <CalendarIcon className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p>Nenhuma parcela encontrada em {MONTH_NAMES[month - 1]} de {year}.</p>
        </div>
      )}

      {/* Day details modal (+N mais) */}
      <Dialog open={dayDetails !== null} onOpenChange={(open) => !open && setDayDetails(null)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle>
              Parcelas de {dayDetails !== null ? formatDateBR(dateStrOf(dayDetails)) : ''}
            </DialogTitle>
            <DialogDescription>
              {dayDetailsList.length} parcela{dayDetailsList.length !== 1 ? 's' : ''} neste dia
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {dayDetailsList.map((inst) => (
              <button
                key={inst.id}
                onClick={() => openInstallment(inst)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${STATUS_INFO[inst.status].pill}`}
              >
                <span className="truncate">{inst.clientName}</span>
                <span className="ml-2 flex-shrink-0">{formatCurrency(inst.amount)}</span>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Installment details modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md rounded-2xl">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  {selected.clientName}
                  <Badge className={STATUS_INFO[selected.status].badge}>
                    {STATUS_INFO[selected.status].label}
                  </Badge>
                </DialogTitle>
                <DialogDescription className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Parcela {selected.number}/{selected.total} · Contrato{' '}
                  <Link
                    to={`/contracts/${selected.contractId}`}
                    className="text-emerald-700 hover:underline font-medium"
                  >
                    {selected.contractNumber}
                  </Link>
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-3 text-sm">
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <DollarSign className="h-3.5 w-3.5" /> Valor
                    </p>
                    <p className="font-bold text-gray-900 mt-0.5">
                      {formatCurrency(selected.amount)}
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <CalendarIcon className="h-3.5 w-3.5" /> Vencimento
                    </p>
                    <p className="font-bold text-gray-900 mt-0.5">{formatDateBR(selected.dueDate)}</p>
                  </div>
                  {selected.status === 'paid' && (
                    <div className="bg-emerald-50 rounded-xl p-3">
                      <p className="text-xs text-emerald-700 flex items-center gap-1">
                        <CheckCircle className="h-3.5 w-3.5" /> Pago em
                      </p>
                      <p className="font-bold text-emerald-900 mt-0.5">
                        {selected.paidAt ? formatDateBR(selected.paidAt) : '-'}
                      </p>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-xl p-3">
                    <p className="text-xs text-gray-500 flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" /> Telefone
                    </p>
                    <p className="font-bold text-gray-900 mt-0.5">
                      {selected.clientPhone || 'Não informado'}
                    </p>
                  </div>
                </div>

                {/* Payment form */}
                {showPaymentForm && selected.status !== 'paid' && (
                  <div className="border-2 border-emerald-200 bg-emerald-50/50 rounded-xl p-4 space-y-3">
                    <p className="font-semibold text-emerald-900">Registrar Pagamento</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label htmlFor="paymentAmount" className="text-xs">Valor pago (R$)</Label>
                        <Input
                          id="paymentAmount"
                          inputMode="decimal"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor="paymentDate" className="text-xs">Data do pagamento</Label>
                        <Input
                          id="paymentDate"
                          type="date"
                          value={paymentDate}
                          onChange={(e) => setPaymentDate(e.target.value)}
                        />
                      </div>
                    </div>
                    <Button
                      onClick={handleRegisterPayment}
                      disabled={paymentLoading}
                      className="w-full bg-emerald-700 hover:bg-emerald-800 rounded-xl"
                    >
                      {paymentLoading ? 'Registrando...' : 'Confirmar Pagamento'}
                    </Button>
                  </div>
                )}
              </div>

              <DialogFooter className="flex-col sm:flex-row gap-2">
                {selected.status !== 'paid' && !showPaymentForm && (
                  <Button
                    onClick={() => setShowPaymentForm(true)}
                    className="bg-emerald-700 hover:bg-emerald-800 gap-2 rounded-xl"
                  >
                    <DollarSign className="h-4 w-4" />
                    Registrar Pagamento
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => openWhatsApp(selected.clientPhone)}
                  className="gap-2 border-emerald-600 text-emerald-700 hover:bg-emerald-50 rounded-xl"
                >
                  <MessageSquare className="h-4 w-4" />
                  WhatsApp
                </Button>
                <Button variant="ghost" onClick={closeModal} className="rounded-xl">
                  Fechar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
