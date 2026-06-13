import { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Users, DollarSign, AlertTriangle, TrendingUp, FileText, RefreshCw, Bell, Clock, XCircle } from 'lucide-react';
import { apiCall, supabase } from '../lib/supabase';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AuthDiagnostic } from '../components/AuthDiagnostic';
import AppHeader from '../components/AppHeader';
import { Badge } from '../components/ui/badge';
import { toast } from 'sonner';

interface Stats {
  totalClients: number;
  activeClients: number;
  totalContracts: number;
  activeContracts: number;
  totalRevenue: number;
  totalOutstanding: number;
  totalOverdue: number;
  defaultRate: number;
  paidInstallments: number;
  overdueInstallments: number;
  // Monthly stats
  monthlyOutstanding: number;
  monthlyOverdue: number;
  monthlyDefaultRate: number;
}

interface MonthlyData {
  month: string;
  paid: number;
  overdue: number;
  id?: string; // Unique identifier for React keys
}

interface DueReminder {
  id: string;
  clientId: string;
  clientName: string;
  clientPhone: string;
  contractId: string;
  contractNumber: string;
  installmentNumber: number;
  totalInstallments: number;
  amount: number;
  dueDate: string;
  status: 'upcoming' | 'due_today' | 'overdue';
  daysUntilDue: number;
}

// Counter for generating truly unique IDs
let idCounter = 0;

export default function Dashboard() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [monthlyData, setMonthlyData] = useState<MonthlyData[]>([]);
  const [reminders, setReminders] = useState<DueReminder[]>([]);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, []);

  // Memoize chart data separately for each chart to prevent key conflicts
  // MUST be here (before early returns) to follow Rules of Hooks
  const lineChartData = useMemo(() => {
    return monthlyData.map((item, index) => ({
      // Use ONLY month as identifier + create unique internal _id
      month: `${item.month}`,
      paid: item.paid,
      overdue: item.overdue,
      // Add unique identifier for React key (Recharts uses this internally)
      key: `line-data-${item.id || index}`,
    }));
  }, [monthlyData]);

  const barChartData = useMemo(() => {
    return monthlyData.map((item, index) => ({
      // Use ONLY month as identifier + create unique internal _id
      month: `${item.month}`,
      paid: item.paid,
      overdue: item.overdue,
      // Add unique identifier for React key (Recharts uses this internally)
      key: `bar-data-${item.id || index}`,
    }));
  }, [monthlyData]);

  const loadDashboardData = async () => {
    try {
      setError(null);
      const data = await apiCall('/dashboard/stats');
      setStats(data.stats || null);
      
      // Remove duplicates and ensure unique keys for monthlyData
      const rawData = data.monthlyData || [];

      // If no data, set empty array
      if (!rawData || rawData.length === 0) {
        setMonthlyData([]);
        setReminders(data.reminders || []);
        return;
      }

      // Use Map for O(1) lookups during deduplication - STRICT version
      const monthMap = new Map<string, { month: string; paid: number; overdue: number }>();

      rawData.forEach((item: MonthlyData) => {
        const monthKey = item.month;

        // Skip items without valid month - STRICT validation
        if (!monthKey || typeof monthKey !== 'string' || monthKey.trim() === '') {
          console.warn('[Dashboard] Skipping item with invalid month:', item);
          return;
        }

        // Normalize month key to avoid case/whitespace issues
        const normalizedMonth = monthKey.trim();

        if (monthMap.has(normalizedMonth)) {
          // Merge with existing entry by summing values
          const existing = monthMap.get(normalizedMonth)!;
          existing.paid += (item.paid || 0);
          existing.overdue += (item.overdue || 0);
        } else {
          // Add new entry
          monthMap.set(normalizedMonth, {
            month: normalizedMonth,
            paid: item.paid || 0,
            overdue: item.overdue || 0,
          });
        }
      });

      // Convert Map to array with guaranteed unique IDs using timestamp + counter
      const timestamp = Date.now();
      const uniqueMonthlyData = Array.from(monthMap.entries())
        .map(([month, data], index) => {
          idCounter++; // Increment global counter for truly unique IDs
          return {
            month: month,
            paid: data.paid,
            overdue: data.overdue,
            id: `month-${timestamp}-${idCounter}-${index}`, // Triple-unique identifier
          };
        })
        .sort((a, b) => a.month.localeCompare(b.month));

      // Final verification - ensure NO duplicates using Set
      const monthSet = new Set<string>();
      const finalData = uniqueMonthlyData.filter(item => {
        if (monthSet.has(item.month)) {
          console.error('[Dashboard] CRITICAL: Duplicate month detected after deduplication:', item.month);
          return false; // Skip duplicates
        }
        monthSet.add(item.month);
        return true;
      });

      // Debug logging
      console.log('[Dashboard] Raw data length:', rawData.length);
      console.log('[Dashboard] Deduplicated length:', finalData.length);
      console.log('[Dashboard] Months:', finalData.map(d => d.month));
      console.log('[Dashboard] IDs:', finalData.map(d => d.id));

      setMonthlyData(finalData);
      setReminders(data.reminders || []);
    } catch (error) {
      console.error('Error loading dashboard:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setStats(null);
      setMonthlyData([]);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  const handleResetTestData = async () => {
    if (!confirm('Tem certeza que deseja resetar todos os dados de teste? Isso irá remover todos os clientes e contratos existentes e criar novos dados de exemplo.')) {
      return;
    }

    setResetting(true);
    try {
      const result = await apiCall('/seed', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      
      if (result.success) {
        toast.success(`✅ Dados resetados com sucesso!\n\n📊 Resumo:\n- ${result.summary.clients} clientes criados (sem documentos)\n- ${result.summary.contracts} contratos criados\n\n💡 Use o formulário de cadastro de clientes para fazer upload de documentos (RG, selfie, vídeo).`);
        
        // Recarregar dashboard
        await loadDashboardData();
      }
    } catch (error) {
      console.error('Error resetting test data:', error);
      toast.error('❌ Erro ao resetar dados de teste. Verifique o console para mais detalhes.');
    } finally {
      setResetting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (error) {
    return (
      <div className="space-y-6 max-w-full">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Dashboard Gerencial</h1>
          <p className="text-sm md:text-base text-gray-600 mt-1">Visão geral do sistema de cobrança</p>
        </div>
        
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Erro ao Carregar Dashboard
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-red-600 mb-4">{error}</p>
            {error.includes('401') && (
              <div className="bg-white p-4 rounded border border-red-300 mb-4">
                <p className="font-semibold text-gray-900 mb-2">Possíveis causas:</p>
                <ul className="list-disc list-inside text-gray-700 space-y-1 text-sm">
                  <li>Sua sessão expirou - faça login novamente</li>
                  <li>Token de autenticação inválido</li>
                  <li>Problemas de conexo com o servidor</li>
                </ul>
              </div>
            )}
            <div className="flex gap-2">
              <button
                onClick={loadDashboardData}
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
              >
                Tentar Novamente
              </button>
              <Link
                to="/login"
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors inline-block"
              >
                Fazer Login
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Diagnostic tool for debugging */}
        <AuthDiagnostic />
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(value);
  };

  // Calculate current month revenue
  const currentDate = new Date();
  const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const currentMonthData = monthlyData.find(m => m.month === currentMonthKey);
  const monthlyRevenue = currentMonthData?.paid || 0;

  return (
    <div className="space-y-6 max-w-full">
      <AppHeader />
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Link to="/clients">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-blue-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total de Clientes Ativos</CardTitle>
              <Users className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats?.activeClients || 0}</div>
              <p className="text-xs text-gray-600 mt-1">
                {(stats?.totalClients || 0) - (stats?.activeClients || 0)} inativos
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/contracts">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-green-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Receita do Mês</CardTitle>
              <DollarSign className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(monthlyRevenue)}</div>
              <p className="text-xs text-gray-600 mt-1">
                Fev/2026 • Total: {formatCurrency(stats?.totalRevenue || 0)}
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/contracts">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-orange-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Contratos Ativos</CardTitle>
              <FileText className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{stats?.activeContracts || 0}</div>
              <p className="text-xs text-gray-600 mt-1">
                {(stats?.totalContracts || 0) - (stats?.activeContracts || 0)} inativos
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/contracts">
          <Card className="cursor-pointer hover:shadow-lg transition-shadow duration-200 hover:border-red-500">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inadimplência (Fev/2026)</CardTitle>
              <AlertTriangle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-xl md:text-2xl font-bold">{formatCurrency(stats?.monthlyOverdue || 0)}</div>
              <p className="text-xs text-red-600 mt-1">
                Taxa do mês: {stats?.monthlyDefaultRate?.toFixed(2) || 0}%
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Reminders Card - Clients Due for Payment */}
      {reminders && reminders.length > 0 && (
        null
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Evolução Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              {lineChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} minWidth={300}>
                  <LineChart data={lineChartData} id="line-chart-evolution">
                    <CartesianGrid strokeDasharray="3 3" key="line-grid" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} key="line-xaxis" />
                    <YAxis tick={{ fontSize: 12 }} key="line-yaxis" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      key="line-tooltip"
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} key="line-legend" />
                    <Line
                      key="evolution-paid-line"
                      type="monotone"
                      dataKey="paid"
                      stroke="#10b981"
                      name="Pagos"
                      strokeWidth={2}
                      isAnimationActive={false}
                      id="line-paid"
                    />
                    <Line
                      key="evolution-overdue-line"
                      type="monotone"
                      dataKey="overdue"
                      stroke="#ef4444"
                      name="Atrasados"
                      strokeWidth={2}
                      isAnimationActive={false}
                      id="line-overdue"
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base md:text-lg">Pagos vs Atrasados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="w-full overflow-x-auto">
              {barChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300} minWidth={300}>
                  <BarChart data={barChartData} id="bar-chart-comparison">
                    <CartesianGrid strokeDasharray="3 3" key="bar-grid" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} key="bar-xaxis" />
                    <YAxis tick={{ fontSize: 12 }} key="bar-yaxis" />
                    <Tooltip
                      formatter={(value: number) => formatCurrency(value)}
                      key="bar-tooltip"
                    />
                    <Legend wrapperStyle={{ fontSize: '12px' }} key="bar-legend" />
                    <Bar 
                      key="comparison-paid-bar" 
                      dataKey="paid" 
                      fill="#10b981" 
                      name="Pagos" 
                      isAnimationActive={false}
                      id="bar-paid"
                    />
                    <Bar 
                      key="comparison-overdue-bar" 
                      dataKey="overdue" 
                      fill="#ef4444" 
                      name="Atrasados" 
                      isAnimationActive={false}
                      id="bar-overdue"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-[300px] flex items-center justify-center text-gray-500">
                  <p>Nenhum dado disponível</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base md:text-lg">Ações Rápidas</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link
              to="/clients/new"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-colors text-center"
            >
              <Users className="h-8 w-8 text-blue-600 mx-auto mb-2" />
              <p className="font-medium text-sm md:text-base">Novo Cliente</p>
              <p className="text-xs text-gray-600">Cadastrar cliente</p>
            </Link>

            <Link
              to="/contracts/new"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-emerald-500 hover:bg-emerald-50 transition-colors text-center"
            >
              <DollarSign className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
              <p className="font-medium text-sm md:text-base">⚡ Empréstimo Rápido</p>
              <p className="text-xs text-gray-600">Registrar empréstimo</p>
            </Link>

            <Link
              to="/contracts/new"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-green-500 hover:bg-green-50 transition-colors text-center"
            >
              <FileText className="h-8 w-8 text-green-600 mx-auto mb-2" />
              <p className="font-medium text-sm md:text-base">Novo Contrato</p>
              <p className="text-xs text-gray-600">Criar contrato</p>
            </Link>

            <Link
              to="/clients"
              className="p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-purple-500 hover:bg-purple-50 transition-colors text-center"
            >
              <TrendingUp className="h-8 w-8 text-purple-600 mx-auto mb-2" />
              <p className="font-medium text-sm md:text-base">Ver Clientes</p>
              <p className="text-xs text-gray-600">Lista completa</p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}