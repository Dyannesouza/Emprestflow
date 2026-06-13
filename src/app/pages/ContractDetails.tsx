import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '../components/ui/dialog';
import { Label } from '../components/ui/label';
import { Input } from '../components/ui/input';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, DollarSign, Calendar, TrendingUp, CheckCircle, Send, Home, Edit } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table';

export default function ContractDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contract, setContract] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [paymentDialog, setPaymentDialog] = useState<{ open: boolean; installment: any }>(({
    open: false,
    installment: null,
  }));
  const [paymentAmount, setPaymentAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split('T')[0]);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentType, setPaymentType] = useState<'full' | 'interest_only'>('full');

  useEffect(() => {
    if (id) {
      loadContract();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadContract = async () => {
    if (!id) return;
    
    try {
      const data = await apiCall(`/contracts/${id}`);
      setContract(data.contract);
    } catch (error) {
      console.error('Error loading contract:', error);
    } finally {
      setLoading(false);
    }
  };

  // Dias de atraso de uma parcela (0 se em dia)
  const getDaysOverdue = (dueDate: string) => {
    const due = new Date(String(dueDate).split('T')[0] + 'T12:00:00');
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const diff = Math.floor((today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 0;
  };

  // Componentes financeiros de uma parcela (juros, amortização, multa de atraso)
  const getInstallmentBreakdown = (installment: any) => {
    if (!installment) {
      return { full: 0, interest: 0, principal: 0, lateFee: 0, daysOverdue: 0 };
    }
    const lateFeePerDay = contract?.lateFeePerDay ?? 30;
    const daysOverdue = getDaysOverdue(installment.dueDate);
    const lateFee = daysOverdue * lateFeePerDay;
    // Fallback caso a parcela seja de um contrato antigo sem os campos separados
    const interest = installment.interestAmount ??
      ((contract.totalAmount * ((contract.interestRate ?? 20) / 100)) / contract.installments);
    const principal = installment.principalAmount ?? (installment.amount - interest);
    return {
      full: installment.amount,
      interest: parseFloat(interest.toFixed(2)),
      principal: parseFloat(principal.toFixed(2)),
      lateFee,
      daysOverdue,
    };
  };

  const openPaymentDialog = (installment: any) => {
    const bd = getInstallmentBreakdown(installment);
    setPaymentType('full');
    setPaymentAmount((bd.full + bd.lateFee).toFixed(2));
    setPaymentDate(new Date().toISOString().split('T')[0]);
    setPaymentDialog({ open: true, installment });
  };

  const selectPaymentMode = (mode: 'full' | 'interest_only') => {
    setPaymentType(mode);
    const bd = getInstallmentBreakdown(paymentDialog.installment);
    const base = mode === 'interest_only' ? bd.interest : bd.full;
    setPaymentAmount((base + bd.lateFee).toFixed(2));
  };

  const handlePayment = async () => {
    if (!paymentDialog.installment) return;

    setPaymentLoading(true);
    try {
      const response = await apiCall(`/contracts/${id}/installments/${paymentDialog.installment.number}/pay`, {
        method: 'POST',
        body: JSON.stringify({
          amount: parseFloat(paymentAmount),
          paymentDate,
          paymentType,
        }),
      });

      toast.success(
        paymentType === 'interest_only'
          ? 'Juros recebidos! A dívida foi mantida e o vencimento renovado.'
          : 'Pagamento registrado com sucesso!'
      );

      // Show notification about financial transaction
      if (response.transactionId) {
        toast.success('💰 Receita adicionada ao Financeiro automaticamente!', {
          duration: 4000,
        });
      }

      setPaymentDialog({ open: false, installment: null });
      await loadContract(); // Reload contract data
    } catch (error: any) {
      console.error('Payment error:', error);
      toast.error(error.message || 'Erro ao registrar pagamento');

      // Close dialog and reload data even on error to sync state
      setPaymentDialog({ open: false, installment: null });
      await loadContract();
    } finally {
      setPaymentLoading(false);
    }
  };

  const handleSendReminder = async (installment: any, type: string) => {
    try {
      const result = await apiCall('/whatsapp/send-reminder', {
        method: 'POST',
        body: JSON.stringify({
          clientId: contract.clientId,
          contractId: contract.id,
          installmentNumber: installment.number,
          type,
        }),
      });

      if (result.success) {
        toast.success('✅ Mensagem WhatsApp enviada com sucesso!');
      }
    } catch (error: any) {
      console.error('Reminder error:', error);
      
      // Show specific error messages
      if (error.message?.includes('não configurada')) {
        toast.error('⚠️ WhatsApp não configurado. Configure EVOLUTION_API_URL e EVOLUTION_API_KEY.');
      } else if (error.message?.includes('não possui WhatsApp')) {
        toast.error('⚠️ Cliente não possui número WhatsApp cadastrado.');
      } else {
        toast.error(`❌ ${error.message || 'Erro ao enviar lembrete'}`);
      }
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('pt-BR');
  };

  const isOverdue = (dueDate: string, status: string) => {
    return status !== 'paid' && new Date(dueDate) < new Date();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!contract) {
    return <div>Contrato não encontrado</div>;
  }

  const totalPaid = contract.installmentsList
    .filter((i: any) => i.status === 'paid')
    .reduce((sum: number, i: any) => sum + (i.paidAmount || i.amount), 0);

  const totalPending = contract.installmentsList
    .filter((i: any) => i.status !== 'paid')
    .reduce((sum: number, i: any) => sum + i.amount, 0);

  const bd = paymentDialog.installment ? getInstallmentBreakdown(paymentDialog.installment) : null;

  return (
    <div className="space-y-6 max-w-full">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
          <h1 className="text-xl md:text-3xl font-bold text-gray-900">Contrato #{contract.id.slice(-8)}</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">
            Cliente: {contract.client?.fullName || 'Não encontrado'}
          </p>
        </div>
        <div className="flex gap-2">
          <Link to={`/contracts/${id}/edit`}>
            <Button variant="default" size="sm" className="gap-2">
              <Edit className="h-4 w-4" />
              Editar Contrato
            </Button>
          </Link>
          <Link to={`/clients/${contract.clientId}`}>
            <Button variant="outline" size="sm" className="text-sm">Ver Cliente</Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Total</CardTitle>
            <DollarSign className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold break-words">{formatCurrency(contract.totalAmount)}</div>
            <p className="text-xs text-gray-600 mt-1">
              {contract.installments} parcelas de {formatCurrency(contract.installmentAmount)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pago</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold break-words">{formatCurrency(totalPaid)}</div>
            <p className="text-xs text-gray-600 mt-1">
              {contract.installmentsList.filter((i: any) => i.status === 'paid').length} parcelas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendente</CardTitle>
            <TrendingUp className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold break-words">{formatCurrency(totalPending)}</div>
            <p className="text-xs text-gray-600 mt-1">
              {contract.installmentsList.filter((i: any) => i.status !== 'paid').length} parcelas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Taxa de Juros</CardTitle>
            <Calendar className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-lg font-bold break-words">{contract.interestRate}%</div>
            <p className="text-xs text-gray-600 mt-1">Multa: {formatCurrency(contract.lateFeePerDay ?? 30)}/dia</p>
            <p className="text-xs text-gray-600 mt-1">
              Parcelas: {contract.installmentPeriod === 'daily' ? 'Diárias' : contract.installmentPeriod === 'weekly' ? 'Semanais' : 'Mensais'}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Parcelas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nº</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Pago em</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contract.installmentsList.map((installment: any) => {
                  const overdue = isOverdue(installment.dueDate, installment.status);

                  return (
                    <TableRow key={installment.number}>
                      <TableCell className="font-medium">{installment.number}</TableCell>
                      <TableCell>
                        <span className={overdue ? 'text-red-600 font-medium' : ''}>
                          {formatDate(installment.dueDate)}
                        </span>
                      </TableCell>
                      <TableCell>{formatCurrency(installment.amount)}</TableCell>
                      <TableCell>
                        {installment.status === 'paid' ? (
                          <Badge variant="default" className="bg-green-600">
                            Pago
                          </Badge>
                        ) : overdue ? (
                          <Badge variant="destructive">Atrasado</Badge>
                        ) : (
                          <Badge variant="secondary">Pendente</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {installment.paidAt ? formatDate(installment.paidAt) : '-'}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          {installment.status !== 'paid' && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => openPaymentDialog(installment)}
                              >
                                <DollarSign className="h-3 w-3 mr-1" />
                                Pagar
                              </Button>
                              
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog open={paymentDialog.open} onOpenChange={(open) => setPaymentDialog({ open, installment: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar Pagamento</DialogTitle>
            <DialogDescription>
              Parcela {paymentDialog.installment?.number} / {contract.installments}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Resumo financeiro da parcela */}
            {bd && (
              <div className="rounded-lg border bg-gray-50 p-3 space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Amortização (principal)</span>
                  <span className="font-medium">{formatCurrency(bd.principal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Juros do período ({contract.interestRate}%)</span>
                  <span className="font-medium">{formatCurrency(bd.interest)}</span>
                </div>
                {bd.daysOverdue > 0 && (
                  <div className="flex justify-between text-red-600">
                    <span>Multa de atraso ({bd.daysOverdue} {bd.daysOverdue === 1 ? 'dia' : 'dias'} × {formatCurrency(contract.lateFeePerDay ?? 30)})</span>
                    <span className="font-medium">{formatCurrency(bd.lateFee)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t pt-1 mt-1">
                  <span className="font-semibold">Parcela completa</span>
                  <span className="font-bold">{formatCurrency(bd.full + bd.lateFee)}</span>
                </div>
              </div>
            )}

            {/* Seleção do tipo de pagamento */}
            <div className="space-y-2">
              <Label>Tipo de pagamento</Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => selectPaymentMode('full')}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    paymentType === 'full'
                      ? 'border-emerald-600 bg-emerald-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold">Parcela completa</p>
                  <p className="text-xs text-gray-600">Amortiza a dívida</p>
                </button>
                <button
                  type="button"
                  onClick={() => selectPaymentMode('interest_only')}
                  className={`rounded-lg border-2 p-3 text-left transition-colors ${
                    paymentType === 'interest_only'
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold">Somente juros</p>
                  <p className="text-xs text-gray-600">Mantém a dívida, renova o vencimento</p>
                </button>
              </div>
              {paymentType === 'interest_only' && (
                <p className="text-xs text-amber-700 bg-amber-50 rounded p-2">
                  ⚠️ O valor emprestado <strong>não será reduzido</strong>. O vencimento desta parcela será adiado em 1 período e os juros entram como receita.
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="paymentAmount">Valor Recebido</Label>
              <Input
                id="paymentAmount"
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentDate">Data do Pagamento</Label>
              <Input
                id="paymentDate"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePayment} disabled={paymentLoading}>
                {paymentLoading
                  ? 'Processando...'
                  : paymentType === 'interest_only'
                  ? 'Receber Juros'
                  : 'Confirmar Pagamento'}
              </Button>
              <Button variant="outline" onClick={() => setPaymentDialog({ open: false, installment: null })}>
                Cancelar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}