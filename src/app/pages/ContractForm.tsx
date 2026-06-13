import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, useParams, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, Save, Home, AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription } from '../components/ui/alert';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog';

interface ContractFormData {
  clientId: string;
  totalAmount: number;
  installments: number;
  installmentPeriod: 'daily' | 'weekly' | 'monthly';
  firstDueDate: string;
  interestRate: number;
  installmentValue: number; // valor de cada parcela (apenas UI — sincronizado com a taxa)
  lateFeePerDay: number;
  description: string;
}

export default function ContractForm() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const preselectedClientId = searchParams.get('clientId');
  const isEditMode = !!id;

  const { register, handleSubmit, setValue, watch, getValues, formState: { errors } } = useForm<ContractFormData>({
    defaultValues: {
      lateFeePerDay: 30,
      interestRate: 20,
      clientId: preselectedClientId || '',
      installmentPeriod: 'monthly',
    },
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditMode);
  const [clients, setClients] = useState<any[]>([]);
  const [contract, setContract] = useState<any>(null);
  const [selectedClientId, setSelectedClientId] = useState(preselectedClientId || '');
  const [selectedPeriod, setSelectedPeriod] = useState('monthly');
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadClients();
    if (isEditMode) {
      loadContract();
    } else if (preselectedClientId) {
      setValue('clientId', preselectedClientId);
      setSelectedClientId(preselectedClientId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const loadContract = async () => {
    if (!id) return;
    
    try {
      const data = await apiCall(`/contracts/${id}`);
      const contractData = data.contract;
      setContract(contractData);
      
      // Preencher formulário com dados do contrato
      setValue('clientId', contractData.clientId);
      setValue('totalAmount', contractData.totalAmount);
      setValue('installments', contractData.installments);
      setValue('installmentPeriod', contractData.installmentPeriod || 'monthly');
      setValue('firstDueDate', contractData.firstDueDate.split('T')[0]);
      setValue('interestRate', contractData.interestRate);
      setValue('installmentValue', parseFloat(Number(contractData.installmentAmount || 0).toFixed(2)));
      setValue('lateFeePerDay', contractData.lateFeePerDay ?? 30);
      setValue('description', contractData.description || '');
      setSelectedClientId(contractData.clientId);
      setSelectedPeriod(contractData.installmentPeriod || 'monthly');
    } catch (error) {
      console.error('Error loading contract:', error);
      toast.error('Erro ao carregar contrato');
    } finally {
      setLoadingData(false);
    }
  };

  const loadClients = async () => {
    try {
      const data = await apiCall('/clients');
      setClients(data.clients);
    } catch (error) {
      console.error('Error loading clients:', error);
    }
  };

  const onSubmit = async (data: ContractFormData) => {
    setLoading(true);

    try {
      // Preparar dados com conversões corretas
      const contractData = {
        clientId: data.clientId,
        totalAmount: parseFloat(String(data.totalAmount)),
        installments: parseInt(String(data.installments)),
        installmentPeriod: data.installmentPeriod,
        firstDueDate: data.firstDueDate, // Data no formato YYYY-MM-DD
        interestRate: parseFloat(String(data.interestRate || 0)),
        lateFeePerDay: parseFloat(String(data.lateFeePerDay ?? 30)),
        description: data.description || '',
      };

      console.log('Dados sendo enviados:', contractData);

      if (isEditMode) {
        // Atualizar contrato existente
        await apiCall(`/contracts/${id}`, {
          method: 'PUT',
          body: JSON.stringify(contractData),
        });
        toast.success('Contrato atualizado com sucesso!');
        navigate(`/contracts/${id}`);
      } else {
        // Criar novo contrato
        const response = await apiCall('/contracts', {
          method: 'POST',
          body: JSON.stringify(contractData),
        });
        toast.success('Contrato criado com sucesso!');
        navigate(`/contracts/${response.contract.id}`);
      }
    } catch (error: any) {
      console.error('Error saving contract:', error);
      toast.error(error.message || `Erro ao ${isEditMode ? 'atualizar' : 'criar'} contrato`);
    } finally {
      setLoading(false);
    }
  };

  const deleteContract = async () => {
    setDeleting(true);

    try {
      await apiCall(`/contracts/${id}`, {
        method: 'DELETE',
      });
      toast.success('Contrato excluído com sucesso!');
      navigate('/contracts');
    } catch (error: any) {
      console.error('Error deleting contract:', error);
      toast.error(error.message || 'Erro ao excluir contrato');
    } finally {
      setDeleting(false);
      setShowDeleteDialog(false);
    }
  };

  // Modelo: parcela = (principal / N) + (principal × taxa)
  // total = principal × (1 + N × taxa)

  // total + parcelas + juros  =>  valor da parcela
  const recalcInstallmentFromInterest = () => {
    const totalAmount = parseFloat(String(getValues('totalAmount')) || '0');
    const installments = parseInt(String(getValues('installments')) || '0');
    const rate = parseFloat(String(getValues('interestRate')) || '0');

    if (!totalAmount || !installments || installments <= 0) return;

    const installmentValue = (totalAmount / installments) + (totalAmount * (rate / 100));
    setValue('installmentValue', parseFloat(installmentValue.toFixed(2)));
  };

  // total + parcelas + valor da parcela  =>  juros
  const recalcInterestFromInstallment = () => {
    const totalAmount = parseFloat(String(getValues('totalAmount')) || '0');
    const installments = parseInt(String(getValues('installments')) || '0');
    const installmentValue = parseFloat(String(getValues('installmentValue')) || '0');

    if (!totalAmount || !installments || installments <= 0 || !installmentValue) return;

    const rate = ((installmentValue / totalAmount) - (1 / installments)) * 100;
    setValue('interestRate', parseFloat(rate.toFixed(2)));
  };

  // Valores derivados para o resumo (recalculados a cada render)
  const summaryTotal = parseFloat(String(watch('totalAmount')) || '0');
  const summaryInstallments = parseInt(String(watch('installments')) || '0');
  const summaryRate = parseFloat(String(watch('interestRate')) || '0');
  const summaryInstallmentValue =
    summaryTotal && summaryInstallments > 0
      ? (summaryTotal / summaryInstallments) + (summaryTotal * (summaryRate / 100))
      : 0;
  const summaryTotalToPay = summaryInstallmentValue * summaryInstallments;
  const summaryInterestPerInstallment = summaryTotal * (summaryRate / 100);

  const formatBRL = (v: number) =>
    v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <div className="flex items-center gap-2 mb-2">
          <Link to="/contracts" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Contratos
          </Link>
          <span className="text-gray-400">|</span>
          <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
            <Home className="h-4 w-4" />
            Dashboard
          </Link>
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEditMode ? 'Editar Contrato' : 'Novo Contrato'}
        </h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">
          {isEditMode ? 'Atualize as informações do contrato' : 'Crie um novo contrato de cobrança'}
        </p>
      </div>

      {isEditMode && contract?.installmentsList?.some((i: any) => i.status === 'paid') && (
        <Alert className="bg-yellow-50 border-yellow-200">
          <AlertCircle className="h-4 w-4 text-yellow-600" />
          <AlertDescription className="text-yellow-800">
            <strong>Atenção:</strong> Este contrato possui parcelas pagas. Alterações em valores e parcelas 
            não afetarão parcelas já pagas, apenas as pendentes.
          </AlertDescription>
        </Alert>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações do Contrato</CardTitle>
            <CardDescription>Preencha os dados do contrato</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="clientId">Cliente *</Label>
              <Select
                value={selectedClientId || undefined}
                onValueChange={(value) => {
                  setValue('clientId', value);
                  setSelectedClientId(value);
                }}
                disabled={isEditMode}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o cliente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.fullName} - {client.cpfCnpj}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {isEditMode && (
                <p className="text-xs text-gray-500">O cliente não pode ser alterado após criação</p>
              )}
              {errors.clientId && (
                <p className="text-sm text-red-600">{errors.clientId.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="totalAmount">Valor Total *</Label>
                <Input
                  id="totalAmount"
                  type="number"
                  step="0.01"
                  {...register('totalAmount', {
                    required: 'Campo obrigatório',
                    min: { value: 0, message: 'Valor deve ser positivo' },
                  })}
                  onChange={(e) => {
                    register('totalAmount').onChange(e);
                    recalcInstallmentFromInterest();
                  }}
                />
                {errors.totalAmount && (
                  <p className="text-sm text-red-600">{errors.totalAmount.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="installments">Número de Parcelas *</Label>
                <Input
                  id="installments"
                  type="number"
                  {...register('installments', {
                    required: 'Campo obrigatório',
                    min: { value: 1, message: 'Mínimo 1 parcela' },
                  })}
                  onChange={(e) => {
                    register('installments').onChange(e);
                    recalcInstallmentFromInterest();
                  }}
                />
                {errors.installments && (
                  <p className="text-sm text-red-600">{errors.installments.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="installmentPeriod">Periodicidade das Parcelas *</Label>
                <Select
                  value={selectedPeriod}
                  onValueChange={(value) => {
                    setValue('installmentPeriod', value as 'daily' | 'weekly' | 'monthly');
                    setSelectedPeriod(value);
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a periodicidade" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Diária</SelectItem>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-gray-500">
                  Define o intervalo entre os vencimentos das parcelas
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="installmentValue">Valor de Cada Parcela</Label>
                <Input
                  id="installmentValue"
                  type="number"
                  step="0.01"
                  {...register('installmentValue')}
                  onChange={(e) => {
                    register('installmentValue').onChange(e);
                    recalcInterestFromInstallment();
                  }}
                />
                <p className="text-xs text-blue-600">
                  💡 Calculado automaticamente a partir dos juros. Se você editar aqui, a taxa de juros é recalculada.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="firstDueDate">Primeiro Vencimento *</Label>
                <Input
                  id="firstDueDate"
                  type="date"
                  {...register('firstDueDate', { required: 'Campo obrigatório' })}
                />
                {errors.firstDueDate && (
                  <p className="text-sm text-red-600">{errors.firstDueDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="interestRate">Taxa de Juros (% por período)</Label>
                <Input
                  id="interestRate"
                  type="number"
                  step="0.01"
                  {...register('interestRate')}
                  onChange={(e) => {
                    register('interestRate').onChange(e);
                    recalcInstallmentFromInterest();
                  }}
                />
                <p className="text-xs text-gray-500">
                  Juros aplicados a cada período (dia/semana/mês) sobre o valor emprestado. Padrão 20%.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="lateFeePerDay">Multa por dia de atraso (R$)</Label>
                <Input
                  id="lateFeePerDay"
                  type="number"
                  step="0.01"
                  {...register('lateFeePerDay')}
                />
                <p className="text-xs text-gray-500">
                  Valor fixo cobrado por dia de atraso. Padrão R$ 30,00.
                </p>
              </div>
            </div>

            {/* Resumo do cálculo */}
            {summaryTotal > 0 && summaryInstallments > 0 && (
              <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm space-y-1">
                <p className="font-semibold text-emerald-900">Resumo do contrato</p>
                <div className="flex justify-between">
                  <span className="text-gray-600">{summaryInstallments}x de</span>
                  <span className="font-bold">{formatBRL(summaryInstallmentValue)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Juros por parcela ({summaryRate}%)</span>
                  <span>{formatBRL(summaryInterestPerInstallment)}</span>
                </div>
                <div className="flex justify-between border-t border-emerald-200 pt-1 mt-1">
                  <span className="font-semibold text-emerald-900">Total a receber</span>
                  <span className="font-bold text-emerald-900">{formatBRL(summaryTotalToPay)}</span>
                </div>
                {summaryInstallmentValue < (summaryTotal / summaryInstallments) && (
                  <p className="text-xs text-red-600 pt-1">
                    ⚠️ A parcela está menor que a amortização — a taxa de juros ficou negativa. Revise os valores.
                  </p>
                )}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="description">Descrição</Label>
              <Textarea
                id="description"
                {...register('description')}
                placeholder="Detalhes do contrato..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        <div className="flex flex-col sm:flex-row gap-4 justify-between">
          <div className="flex gap-4">
            <Button type="submit" disabled={loading} className="gap-2">
              <Save className="h-4 w-4" />
              {loading ? 'Salvando...' : (isEditMode ? 'Atualizar Contrato' : 'Criar Contrato')}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate(-1)}>
              Cancelar
            </Button>
          </div>
          {isEditMode && (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setShowDeleteDialog(true)}
              className="gap-2"
            >
              <Trash2 className="h-4 w-4" />
              <span className="hidden sm:inline">Excluir Contrato</span>
              <span className="sm:hidden">Excluir</span>
            </Button>
          )}
        </div>
      </form>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Contrato</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este contrato? Esta ação não pode ser desfeita.
              {contract?.installmentsList?.some((i: any) => i.status === 'paid') && (
                <span className="block mt-2 text-red-600 font-medium">
                  ⚠️ Este contrato possui parcelas pagas e não pode ser excluído.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={deleteContract}
              disabled={deleting || contract?.installmentsList?.some((i: any) => i.status === 'paid')}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? 'Excluindo...' : 'Excluir'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}