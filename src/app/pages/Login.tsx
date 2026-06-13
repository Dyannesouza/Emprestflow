import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link, useSearchParams } from 'react-router';
import { useAuth } from '../lib/auth-context';
import { supabase } from '../lib/supabase';
import { projectId } from '/utils/supabase/info';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Alert, AlertDescription } from '../components/ui/alert';
import { Lock, Mail, User, BarChart3, AlertCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

const apiUrl = `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02`;

export default function Login() {
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [accessCode, setAccessCode] = useState(''); // Security code for admin signup
  const [showAccessCode, setShowAccessCode] = useState(false); // Toggle visibility
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugInfo, setDebugInfo] = useState('');

  const { signIn, signUp, user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const redirectedRef = useRef(false);

  // Check if redirected due to session expiry
  const sessionExpired = searchParams.get('reason') === 'session_expired';

  // Show toast if session expired
  useEffect(() => {
    if (sessionExpired) {
      toast.error('Sua sessão expirou. Por favor, faça login novamente.', {
        duration: 5000,
        icon: <Clock className="h-4 w-4" />
      });
    }
  }, [sessionExpired]);

  // Redirect if already logged in - ONLY ONCE
  useEffect(() => {
    if (!authLoading && user && !redirectedRef.current) {
      redirectedRef.current = true;
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  // Don't render form while checking auth
  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900">
        <div className="text-white text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto"></div>
          <p className="mt-4">Verificando autenticação...</p>
        </div>
      </div>
    );
  }

  const testBackendAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        setDebugInfo('Nenhuma sessão ativa');
        return;
      }

      const response = await fetch(`${apiUrl}/debug/auth`, {
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();
      setDebugInfo(JSON.stringify(result, null, 2));
    } catch (err: any) {
      setDebugInfo('Erro: ' + err.message);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setDebugInfo('');
    setLoading(true);

    try {
      if (isSignUp) {
        // Validate access code for admin signup
        if (!accessCode) {
          setError('O código de acesso é obrigatório para criar conta de administrador.');
          toast.error('Por favor, informe o código de acesso fornecido pela empresa.');
          setLoading(false);
          return;
        }

        const role = 'admin';
        await signUp(email, password, name, role, accessCode);
        toast.success('Conta criada com sucesso!');
      } else {
        await signIn(email, password);
        toast.success('Login realizado com sucesso!');
      }
      // Navigation will happen automatically via useEffect when user state updates
    } catch (err: any) {
      console.error('Auth error:', err);
      
      // Better error handling for common cases
      let errorMessage = err.message || 'Erro ao autenticar. Verifique suas credenciais.';
      
      if (errorMessage.includes('already been registered') || errorMessage.includes('já está cadastrado')) {
        errorMessage = '⚠️ Este e-mail já está cadastrado no sistema!\n\n' +
                      '💡 Opções:\n' +
                      '• Use "Esqueci minha senha" para recuperar seu acesso\n' +
                      '• Ou faça login se já possui uma conta';
        
        // Show a more helpful toast
        toast.error('E-mail já cadastrado!', {
          description: 'Use "Esqueci minha senha" ou faça login',
          duration: 5000
        });
        
        // Automatically switch to login mode after a delay
        setTimeout(() => {
          setIsSignUp(false);
          toast.info('Redirecionado para login. Use suas credenciais existentes.');
        }, 3000);
      } else if (errorMessage.includes('Invalid login credentials')) {
        errorMessage = '🔒 E-mail ou senha incorretos. Verifique suas credenciais.';
        
        // Show helpful toast with suggestions
        toast.error('Credenciais inválidas', {
          description: 'Verifique seu e-mail e senha, ou use "Esqueci minha senha"',
          duration: 5000
        });
      } else if (errorMessage.includes('Código de acesso inválido')) {
        errorMessage = '❌ Código de acesso inválido! O código correto é fornecido pela administração da empresa. Verifique se digitou corretamente (sensível a maiúsculas/minúsculas).';
      } else if (errorMessage.includes('Esqueci minha senha')) {
        // User should use the forgot password flow
        errorMessage = errorMessage; // Keep the original message
      }
      
      setError(errorMessage);
      
      // Only show toast if we haven't shown a custom one
      if (!errorMessage.includes('já está cadastrado')) {
        toast.error(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-700 to-emerald-900 p-4">
      <Card className="w-full max-w-md shadow-2xl border-2 border-amber-500/20">
        <CardHeader className="space-y-1 text-center bg-gradient-to-r from-emerald-50 to-amber-50/30 rounded-t-lg">
          {/* Logo dentro do modal */}
          <div className="flex items-center justify-center gap-3 mb-2">
            <img src="/logo.png" alt="ALEMÃO.CREFISA" className="h-12 w-12 object-contain rounded-full drop-shadow-md" />
            <div className="text-left">
              <h1 className="text-xl font-bold text-amber-600">ALEMÃO.CREFISA</h1>
              <p className="text-xs text-emerald-700">Sistema de Gestão</p>
            </div>
          </div>
          
          <CardTitle className="text-2xl font-bold text-emerald-900">Acesso ao Sistema</CardTitle>
          <CardDescription className="text-emerald-700">
            {isSignUp ? 'Criar nova conta' : 'Entre com suas credenciais'}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-6">
          {/* Show registration mode when signing up */}
          {isSignUp && (
            <Alert className="mb-4 bg-emerald-50 border-emerald-300">
              <AlertDescription className="text-xs">
                <div className="font-semibold mb-1 text-emerald-900">
                  ⚙️ Cadastro de Administrador
                </div>
                <div className="text-emerald-700">
                  Você está criando uma conta de administrador com acesso total ao sistema.
                </div>
              </AlertDescription>
            </Alert>
          )}

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                {error}
                {error.includes('já está cadastrado') && (
                  <div className="mt-2 flex gap-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError('');
                      }}
                      className="text-xs"
                    >
                      Ir para Login
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      type="button"
                      onClick={() => {
                        setEmail('');
                        setError('');
                      }}
                      className="text-xs"
                    >
                      Usar outro e-mail
                    </Button>
                  </div>
                )}
              </AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="name"
                    type="text"
                    placeholder="Seu nome completo"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="pl-10"
                    required
                  />
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">E-mail</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-10"
                  required
                  minLength={6}
                />
              </div>
              {!isSignUp && (
                <div className="flex justify-end">
                   <p className="text-xs p-0 h-auto text-blue-600 hover:text-blue-800 text-center w-full">
                      Esqueceu a senha? Peça para um administrador resetá-la.
                    </p>
                 </div>
              )}
            </div>

            {isSignUp && (
              <div className="space-y-2">
                <Label htmlFor="accessCode" className="flex items-center justify-between">
                  <span>Código de Acesso</span>
                  <span className="text-xs text-red-600 font-semibold">⚠️ OBRIGATÓRIO</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                  <Input
                    id="accessCode"
                    type={showAccessCode ? "text" : "password"}
                    placeholder="Digite a senha de permissão"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value.trim())}
                    className="pl-10 pr-20 border-2 border-amber-400 focus:border-amber-600"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccessCode(!showAccessCode)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-600 hover:text-gray-900 px-2 py-1 rounded"
                  >
                    {showAccessCode ? '🙈 Ocultar' : '👁️ Mostrar'}
                  </button>
                </div>
                <div className="flex gap-2">
                  
                  
                </div>
                
              </div>
            )}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Processando...' : isSignUp ? 'Criar Conta' : 'Entrar'}
            </Button>

            <div className="text-center text-sm">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-emerald-700 hover:underline font-medium"
              >
                {isSignUp
                  ? 'Já tem uma conta? Faça login'
                  : 'Não tem conta? Cadastre-se'}
              </button>
            </div>

            <div className="text-center text-sm">
              
            </div>
          </form>

          {isSignUp && (
            <div className="mt-4 p-3 bg-emerald-50 rounded-lg text-xs text-emerald-800 border border-emerald-200">
              <p className="font-semibold mb-1">⚠️ Conformidade LGPD:</p>
              <p>
                Ao criar uma conta, você concorda com nossa Política de Privacidade e 
                o tratamento de dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD).
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <p className="text-center text-xs text-emerald-100 mt-10">
        Sistema seguro com criptografia end-to-end e conformidade LGPD
      </p>
    </div>
  );
}