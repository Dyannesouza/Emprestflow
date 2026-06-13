import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { projectId, publicAnonKey } from '/utils/supabase/info';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { AlertCircle, CheckCircle, XCircle } from 'lucide-react';

interface DiagnosticCheck {
  name: string;
  status: 'success' | 'warning' | 'error';
  message: string;
  details: any;
}

interface DiagnosticResult {
  timestamp: string;
  checks: DiagnosticCheck[];
  error?: string;
}

export function AuthDiagnostic() {
  const [result, setResult] = useState<DiagnosticResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [creatingAdmin, setCreatingAdmin] = useState(false);
  const [fixingProfiles, setFixingProfiles] = useState(false);

  const runDiagnostic = async () => {
    setLoading(true);
    const diagnosticResult: DiagnosticResult = {
      timestamp: new Date().toISOString(),
      checks: []
    };

    try {
      // Check 1: Session exists
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      diagnosticResult.checks.push({
        name: 'Sessão do Supabase',
        status: session ? 'success' : 'error',
        message: session ? 'Sessão encontrada' : 'Nenhuma sessão ativa',
        details: session ? {
          userId: session.user?.id?.substring(0, 8) + '...',
          email: session.user?.email,
          expiresAt: new Date(session.expires_at! * 1000).toLocaleString('pt-BR'),
          tokenLength: session.access_token?.length
        } : null
      });

      // Check 2: Token validity
      if (session?.access_token) {
        try {
          const parts = session.access_token.split('.');
          if (parts.length === 3) {
            const payload = JSON.parse(atob(parts[1]));
            const isExpired = payload.exp * 1000 < Date.now();
            diagnosticResult.checks.push({
              name: 'Validade do Token',
              status: isExpired ? 'error' : 'success',
              message: isExpired ? 'Token expirado' : 'Token válido',
              details: {
                expiresAt: new Date(payload.exp * 1000).toLocaleString('pt-BR'),
                issuedAt: new Date(payload.iat * 1000).toLocaleString('pt-BR'),
                subject: payload.sub?.substring(0, 8) + '...'
              }
            });
          }
        } catch (error) {
          diagnosticResult.checks.push({
            name: 'Validade do Token',
            status: 'error',
            message: 'Erro ao decodificar token',
            details: String(error)
          });
        }
      }

      // Check 3: Backend health (WITH ANON KEY)
      try {
        const healthResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02/health`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );
        const healthData = await healthResponse.json().catch(() => ({}));
        diagnosticResult.checks.push({
          name: 'Saúde do Backend',
          status: healthResponse.ok ? 'success' : 'error',
          message: healthResponse.ok ? 'Backend respondendo' : 'Backend com problemas',
          details: {
            status: healthResponse.status,
            statusText: healthResponse.statusText,
            response: healthData
          }
        });
      } catch (error) {
        diagnosticResult.checks.push({
          name: 'Saúde do Backend',
          status: 'error',
          message: 'Erro ao conectar com backend',
          details: String(error)
        });
      }

      // Check 4: Public test endpoint (WITH ANON KEY)
      try {
        const publicTestResponse = await fetch(
          `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02/public-test`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${publicAnonKey}`
            }
          }
        );
        const publicTestData = await publicTestResponse.json().catch(() => ({}));
        diagnosticResult.checks.push({
          name: 'Endpoint Público',
          status: publicTestResponse.ok ? 'success' : 'error',
          message: publicTestResponse.ok ? 'Endpoint público funcionando' : 'Endpoint público com problemas',
          details: {
            status: publicTestResponse.status,
            response: publicTestData
          }
        });
      } catch (error) {
        diagnosticResult.checks.push({
          name: 'Endpoint Público',
          status: 'error',
          message: 'Erro ao conectar',
          details: String(error)
        });
      }

      // Check 5: LocalStorage
      const hasLocalStorage = !!localStorage.getItem('sb-' + projectId.split('.')[0] + '-auth-token');
      diagnosticResult.checks.push({
        name: 'LocalStorage',
        status: hasLocalStorage ? 'success' : 'warning',
        message: hasLocalStorage ? 'Token armazenado localmente' : 'Nenhum token no localStorage',
        details: null
      });

      // Check 6: Backend authentication with token
      if (session?.access_token) {
        try {
          const authResponse = await fetch(
            `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02/auth/me`,
            {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${publicAnonKey}`,
                'X-User-Token': session.access_token
              }
            }
          );
          const authData = await authResponse.json().catch(() => ({}));
          diagnosticResult.checks.push({
            name: 'Autenticação no Backend',
            status: authResponse.ok ? 'success' : 'error',
            message: authResponse.ok ? 'Autenticação bem-sucedida' : 'Falha na autenticação',
            details: authResponse.ok ? {
              userId: authData.user?.id?.substring(0, 8) + '...',
              email: authData.user?.email,
              role: authData.user?.role
            } : {
              code: authData.code || authResponse.status,
              message: authData.message || authData.error || 'Erro desconhecido'
            }
          });
        } catch (error) {
          diagnosticResult.checks.push({
            name: 'Autenticação no Backend',
            status: 'error',
            message: 'Erro ao autenticar',
            details: String(error)
          });
        }
      }

    } catch (error) {
      diagnosticResult.error = String(error);
    } finally {
      setLoading(false);
      setResult(diagnosticResult);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning':
        return <AlertCircle className="h-5 w-5 text-yellow-600" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-red-600" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const createTestAdmin = async () => {
    setCreatingAdmin(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02/create-admin`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        alert(`✅ Administrador criado!\n\nEmail: ${data.credentials.email}\nSenha: ${data.credentials.password}\n\nAgora você pode fazer login como administrador!`);
      } else {
        alert(`❌ Erro ao criar administrador:\n${data.error}`);
      }
    } catch (error) {
      alert(`❌ Erro:\n${error}`);
    } finally {
      setCreatingAdmin(false);
    }
  };

  const fixUserProfiles = async () => {
    setFixingProfiles(true);
    try {
      const response = await fetch(
        `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02/fix-user-profiles`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${publicAnonKey}`
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok) {
        const fixesList = data.fixes.map((f: any) => 
          `- ${f.email}: ${f.action}${f.clientId ? ' (ID: ' + f.clientId + ')' : ''}`
        ).join('\n');
        
        alert(`✅ ${data.message}\n\n${fixesList || 'Nenhum perfil precisou ser corrigido.'}\n\nAgora tente fazer login novamente!`);
      } else {
        alert(`❌ Erro ao corrigir perfis:\n${data.error}`);
      }
    } catch (error) {
      alert(`❌ Erro:\n${error}`);
    } finally {
      setFixingProfiles(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base md:text-lg">Diagnóstico de Autenticação</CardTitle>
      </CardHeader>
      <CardContent>
        <Button
          onClick={runDiagnostic}
          disabled={loading}
          className="w-full mb-4"
        >
          {loading ? 'Executando diagnóstico...' : '🔍 Executar Diagnóstico'}
        </Button>

        <Button
          onClick={createTestAdmin}
          disabled={creatingAdmin}
          variant="outline"
          className="w-full mb-4"
        >
          {creatingAdmin ? 'Criando administrador...' : '👥 Criar Administrador de Teste'}
        </Button>

        <Button
          onClick={fixUserProfiles}
          disabled={fixingProfiles}
          variant="outline"
          className="w-full mb-4"
        >
          {fixingProfiles ? 'Corrigindo perfis...' : '🔧 Corrigir Perfis de Usuário'}
        </Button>

        {result && (
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Executado em: {new Date(result.timestamp).toLocaleString('pt-BR')}
            </p>
            
            {result.checks.map((check: any, index: number) => (
              <div
                key={index}
                className={`p-3 border rounded-lg ${getStatusColor(check.status)}`}
              >
                <div className="flex items-start gap-2">
                  {getStatusIcon(check.status)}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{check.name}</p>
                    <p className="text-sm mt-1">{check.message}</p>
                    {check.details && (
                      <pre className="text-xs mt-2 p-2 bg-white rounded border overflow-x-auto">
                        {JSON.stringify(check.details, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {result.error && (
              <div className="p-3 border rounded-lg bg-red-50 border-red-200">
                <p className="font-semibold text-sm text-red-700">Erro Geral</p>
                <p className="text-sm text-red-600 mt-1">{result.error}</p>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}