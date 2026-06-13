import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { apiCall } from '../lib/supabase';
import { ArrowLeft, Edit, Phone, Mail, MapPin, Briefcase, DollarSign, FileText, Home, RefreshCw, AlertCircle, User } from 'lucide-react';
import { MediaDebug } from '../components/MediaDebug';

export default function ClientDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [client, setClient] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshingDocs, setRefreshingDocs] = useState(false);
  const [docsError, setDocsError] = useState<string | null>(null);

  useEffect(() => {
    loadClient();
  }, [id]);
  
  // ✨ AUTO-RELOAD: Recarregar quando a página ganhar foco (usuário voltou de outra página)
  useEffect(() => {
    const handleFocus = () => {
      console.log('🔄 [ClientDetails] Page focused - reloading client data');
      loadClient();
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [id]);

  const loadClient = async () => {
    try {
      setDocsError(null);
      console.log('🔍 [ClientDetails] Loading client:', id);
      
      const data = await apiCall(`/clients/${id}`);
      
      console.log('📦 [ClientDetails] API Response:', data);
      console.log('👤 [ClientDetails] Client data:', data.client);
      
      // Debug documents structure
      if (data.client?.documents) {
        console.log('📄 [ClientDetails] Documents object:', data.client.documents);
        
        // Check photos
        ['foto1', 'foto2', 'foto3', 'foto4', 'foto5', 'foto6'].forEach(type => {
          const doc = data.client.documents[type];
          console.log(`📷 [ClientDetails] ${type}:`, {
            exists: !!doc,
            type: typeof doc,
            isObject: typeof doc === 'object',
            hasUrl: doc?.url,
            hasPath: doc?.path,
            url: doc?.url || doc?.path || doc,
            fullDoc: doc
          });
        });
        
        // Check videos
        ['video1', 'video2'].forEach(type => {
          const doc = data.client.documents[type];
          console.log(`🎥 [ClientDetails] ${type}:`, {
            exists: !!doc,
            type: typeof doc,
            isObject: typeof doc === 'object',
            hasUrl: doc?.url,
            hasPath: doc?.path,
            url: doc?.url || doc?.path || doc,
            fullDoc: doc
          });
        });
      } else {
        console.warn('⚠️ [ClientDetails] No documents found');
      }
      
      setClient(data.client);
    } catch (error: any) {
      console.error('❌ [ClientDetails] Error loading client:', error);
      if (error.message?.includes('JWT') || error.message?.includes('exp claim')) {
        setDocsError('Sessão expirada. Por favor, faça login novamente.');
      } else {
        setDocsError(error.message || 'Erro ao carregar cliente');
      }
    } finally {
      setLoading(false);
    }
  };

  const refreshDocuments = async () => {
    try {
      setRefreshingDocs(true);
      setDocsError(null);
      const data = await apiCall(`/clients/${id}?refresh=true`);
      setClient(data.client);
    } catch (error: any) {
      console.error('Error refreshing documents:', error);
      setDocsError(error.message || 'Erro ao atualizar documentos');
    } finally {
      setRefreshingDocs(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!client) {
    return <div>Cliente não encontrado</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Link to="/clients" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
              <ArrowLeft className="h-4 w-4" />
              Voltar para Clientes
            </Link>
            <span className="text-gray-400">|</span>
            <Link to="/" className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm">
              <Home className="h-4 w-4" />
              Dashboard
            </Link>
          </div>
          <div className="flex items-center gap-4">
            {/* Foto de Perfil */}
            {(() => {
              const foto1 = client.documents?.foto1;
              const isObject = foto1 && typeof foto1 === 'object';
              const fotoUrl = isObject ? (foto1.url || foto1.path) : foto1;
              
              return fotoUrl ? (
                <img 
                  src={fotoUrl} 
                  alt={client.fullName}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[#115740] shadow-md"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-gray-200 border-2 border-gray-300 flex items-center justify-center">
                  <User className="h-8 w-8 text-gray-400" />
                </div>
              );
            })()}
            
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{client.fullName}</h1>
              <p className="text-sm md:text-base text-gray-600 mt-1">Detalhes do cliente</p>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          <Link to={`/clients/${id}/edit`}>
            <Button className="gap-2">
              <Edit className="h-4 w-4" />
              Editar
            </Button>
          </Link>
          <Link to={`/contracts/new?clientId=${id}`}>
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Novo Contrato
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Informações Pessoais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <p className="text-sm text-gray-600">CPF/CNPJ</p>
              <p className="font-medium">{client.cpfCnpj}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">RG</p>
              <p className="font-medium">{client.rg}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Data de Nascimento</p>
              <p className="font-medium">
                {client.birthDate ? new Date(client.birthDate).toLocaleDateString('pt-BR') : '-'}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <Badge variant={client.status === 'active' ? 'default' : 'secondary'}>
                {client.status === 'active' ? 'Ativo' : 'Inativo'}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Telefone</p>
                <p className="font-medium">{client.phone}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">WhatsApp</p>
                <p className="font-medium">{client.whatsapp || '-'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Mail className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">E-mail</p>
                <p className="font-medium">{client.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Endereço</p>
                <p className="font-medium">{client.address || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Dados Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Profissão</p>
                <p className="font-medium">{client.occupation || '-'}</p>
              </div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Empresa</p>
              <p className="font-medium">{client.company || '-'}</p>
            </div>
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-gray-400" />
              <div>
                <p className="text-sm text-gray-600">Renda Mensal</p>
                <p className="font-medium">{client.monthlyIncome || '-'}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {client.referredBy && (
          <Card>
            <CardHeader>
              <CardTitle>Indicação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Indicado por</p>
                <p className="font-medium">{client.referredBy.name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Telefone</p>
                <p className="font-medium">{client.referredBy.phone}</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Debug Component - Remove after investigation */}
      <MediaDebug client={client} />

      <Card>
        <CardHeader>
          <CardTitle>Documentos</CardTitle>
          <p className="text-sm text-gray-600 mt-1">
            Fotos e vídeos enviados pelo cliente no primeiro acesso
          </p>
        </CardHeader>
        <CardContent>
          {/* Fotos */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              📷 Fotos (1 obrigatória + 1 opcional)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['foto1', 'foto2'].map((type, index) => {
                const isRequired = index === 0;
                const document = client.documents?.[type];

                // Handle both object format and legacy string format
                const isObject = document && typeof document === 'object';
                const isString = document && typeof document === 'string';
                const hasDocument = isObject ? (document.url || document.path) : isString;
                const documentUrl = isObject ? (document.url || document.path) : document;

                return (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg text-center ${
                      hasDocument
                        ? 'border-green-500 bg-green-50'
                        : isRequired
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium">
                      Foto {index + 1}
                      {!isRequired && <span className="text-gray-500"> (opcional)</span>}
                    </p>
                    <p className="text-xs mt-1">
                      {hasDocument ? (
                        <span className="text-green-600 font-semibold">✓ Enviada</span>
                      ) : (
                        <span className={isRequired ? 'text-red-600' : 'text-gray-500'}>
                          ✗ {isRequired ? 'Obrigatória' : 'Não enviada'}
                        </span>
                      )}
                    </p>
                    {hasDocument && documentUrl && (
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                      >
                        Ver foto
                      </a>
                    )}
                    {isObject && document.fileName && (
                      <p className="text-[10px] text-gray-500 mt-1 truncate" title={document.fileName}>
                        {document.fileName}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Vídeos */}
          <div>
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
              🎥 Vídeos (opcionais)
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {['video1', 'video2', 'video3', 'video4'].map((type, index) => {
                const isRequired = false;
                const document = client.documents?.[type];
                
                // Handle both object format and legacy string format
                const isObject = document && typeof document === 'object';
                const isString = document && typeof document === 'string';
                const hasDocument = isObject ? (document.url || document.path) : isString;
                const documentUrl = isObject ? (document.url || document.path) : document;
                
                return (
                  <div
                    key={type}
                    className={`p-4 border rounded-lg text-center ${
                      hasDocument
                        ? 'border-green-500 bg-green-50'
                        : isRequired
                        ? 'border-red-300 bg-red-50'
                        : 'border-gray-300 bg-gray-50'
                    }`}
                  >
                    <p className="text-sm font-medium">
                      Vídeo {index + 1}
                      {!isRequired && <span className="text-gray-500"> (opcional)</span>}
                    </p>
                    <p className="text-xs text-gray-600 mt-1">
                      {hasDocument ? (
                        <span className="text-green-600 font-semibold">✓ Enviado</span>
                      ) : (
                        <span className={isRequired ? 'text-red-600' : 'text-gray-500'}>
                          ✗ {isRequired ? 'Obrigatório' : 'Não enviado'}
                        </span>
                      )}
                    </p>
                    {hasDocument && documentUrl && (
                      <>
                        <a
                          href={documentUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800 underline font-medium"
                        >
                          🎬 Ver vídeo
                        </a>
                        {isObject && document.fileName && (
                          <p className="text-xs text-gray-500 mt-2 truncate" title={document.fileName}>
                            {document.fileName}
                          </p>
                        )}
                        {isObject && document.uploadedAt && (
                          <p className="text-[10px] text-gray-400 mt-1">
                            Enviado em: {new Date(document.uploadedAt).toLocaleDateString('pt-BR')}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Legenda */}
          <div className="mt-6 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <span className="font-semibold">ℹ️ Informação:</span> Documentos com fundo verde foram enviados. 
              Documentos com fundo vermelho são obrigatórios e ainda não foram enviados. 
              Limite: 5MB por foto, 30MB por vídeo.
            </p>
          </div>

          {/* Botão de atualização */}
          <div className="mt-6">
            <Button
              variant="outline"
              className="gap-2"
              onClick={refreshDocuments}
              disabled={refreshingDocs}
            >
              <RefreshCw className={`h-4 w-4 ${refreshingDocs ? 'animate-spin' : ''}`} />
              {refreshingDocs ? 'Atualizando...' : 'Atualizar Documentos'}
            </Button>
            {docsError && (
              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-red-800">{docsError}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}