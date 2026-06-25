import { useState, useEffect, useRef } from 'react';
import { useNavigate, useParams, Link } from 'react-router';
import { useForm } from 'react-hook-form';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Checkbox } from '../components/ui/checkbox';
import { apiCall } from '../lib/supabase';
import { toast } from 'sonner';
import { ArrowLeft, Save, Upload, FileText, Eye, Download, CheckCircle, Clock, Home, X, Trash2, Plus, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import MediaGalleryUploader from '../components/MediaGalleryUploader';
import { useAuth } from '../lib/auth-context';

interface ClientFormData {
  fullName: string;
  cpfCnpj: string;
  rg: string;
  birthDate: string;
  phone: string;
  whatsapp: string;
  email: string;
  address: string;
  occupation: string;
  company: string;
  monthlyIncome: string;
  paymentMethod?: string;
  status: string;
  referredByName?: string;
  referredByPhone?: string;
  lgpdConsent: boolean;
}

interface DocumentInfo {
  path: string;
  fileName: string;
  mimeType: string;
  uploadedAt: string;
  url?: string;
}

export default function ClientForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEditing = !!id;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<ClientFormData>({
    defaultValues: {
      status: 'active',
      lgpdConsent: false,
      paymentMethod: 'pix',
    },
  });

  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(isEditing);
  const [clientId, setClientId] = useState<string | null>(id || null);
  const [clientDocuments, setClientDocuments] = useState<any>({
    front: null,
    back: null,
    selfie: null,
    video: null,
  });
  const [loadingDocuments, setLoadingDocuments] = useState(false);
  const [existingClient, setExistingClient] = useState<any>(null); // 🔥 Store full client for merge

  // Refs for document uploaders
  const frontUploaderRef = useRef<HTMLDivElement>(null);
  const backUploaderRef = useRef<HTMLDivElement>(null);
  const selfieUploaderRef = useRef<HTMLDivElement>(null);
  const videoUploaderRef = useRef<HTMLDivElement>(null);

  const lgpdConsent = watch('lgpdConsent');

  // Debug: Log clientId changes
  useEffect(() => {
    console.log('[CLIENT_FORM] clientId changed to:', clientId);
  }, [clientId]);

  useEffect(() => {
    if (isEditing && id) {
      loadClient();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, isEditing]);

  useEffect(() => {
    if (clientId) {
      loadClientDocuments();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientId]);

  const loadClient = async () => {
    try {
      const data = await apiCall(`/clients/${id}`);
      const client = data.client;

      Object.keys(client).forEach((key) => {
        setValue(key as any, client[key]);
      });

      if (client.referredBy) {
        setValue('referredByName', client.referredBy.name);
        setValue('referredByPhone', client.referredBy.phone);
      }

      setExistingClient(client); // 🔥 Store full client for merge
    } catch (error) {
      console.error('Error loading client:', error);
      toast.error('Erro ao carregar dados do cliente');
    } finally {
      setLoadingData(false);
    }
  };

  const loadClientDocuments = async () => {
    setLoadingDocuments(true);
    try {
      console.log('[CLIENT_FORM] Loading documents for client:', clientId);
      const data = await apiCall(`/clients/${clientId}`);
      console.log('[CLIENT_FORM] Documents received:', data.client.documents);
      console.log('[CLIENT_FORM] Front doc:', data.client.documents?.front);
      console.log('[CLIENT_FORM] Back doc:', data.client.documents?.back);
      console.log('[CLIENT_FORM] Selfie doc:', data.client.documents?.selfie);
      console.log('[CLIENT_FORM] Video doc:', data.client.documents?.video);
      setClientDocuments(data.client.documents || {
        front: null,
        back: null,
        selfie: null,
        video: null,
      });
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setLoadingDocuments(false);
    }
  };

  const viewDocument = async (documentType: string) => {
    try {
      // Check if document exists before making API call
      const doc = clientDocuments[documentType];
      if (!doc || !doc.path) {
        toast.error('Documento não encontrado');
        return;
      }
      
      const data = await apiCall(`/clients/${clientId}/documents/${documentType}`);
      if (data.url) {
        window.open(data.url, '_blank');
      }
    } catch (error) {
      console.error('Error viewing document:', error);
      toast.error('Erro ao visualizar documento');
    }
  };

  const scrollToUploader = (documentType: string) => {
    const refs = {
      front: frontUploaderRef,
      back: backUploaderRef,
      selfie: selfieUploaderRef,
      video: videoUploaderRef,
    };

    const ref = refs[documentType as keyof typeof refs];
    if (ref?.current) {
      ref.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a highlight effect
      ref.current.classList.add('ring-4', 'ring-blue-400', 'ring-opacity-50');
      setTimeout(() => {
        ref.current?.classList.remove('ring-4', 'ring-blue-400', 'ring-opacity-50');
      }, 2000);
    }
  };

  const onSubmit = async (data: ClientFormData) => {
    if (!data.lgpdConsent) {
      toast.error('É necessário aceitar os termos da LGPD');
      return;
    }

    setLoading(true);

    try {
      const payload = {
        ...data,
        referredBy: data.referredByName
          ? {
              name: data.referredByName,
              phone: data.referredByPhone,
            }
          : null,
      };
      
      // 🔥 CRITICAL: Remove documents from payload to prevent overwriting
      // Documents are managed separately via upload endpoints
      delete (payload as any).documents;
      
      console.log('[CLIENT_FORM] Payload keys:', Object.keys(payload));

      if (isEditing) {
        console.log('[CLIENT_FORM] Updating client, excluding documents from payload');
        const response = await apiCall(`/clients/${id}`, {
          method: 'PUT',
          body: JSON.stringify(payload),
        });
        toast.success('Cliente atualizado com sucesso!');
        navigate(`/clients/${id}`);
      } else {
        console.log('[CLIENT_FORM] Creating new client...');
        const response = await apiCall('/clients', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        console.log('[CLIENT_FORM] Response from server:', response);
        console.log('[CLIENT_FORM] Client ID:', response.client?.id);
        
        if (response.client && response.client.id) {
          toast.success('Cliente cadastrado com sucesso! Agora faça o upload dos documentos.');
          setClientId(response.client.id);
          
          // Scroll to upload section after a short delay
          setTimeout(() => {
            const uploadSection = document.getElementById('upload-section');
            if (uploadSection) {
              uploadSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
          }, 500);
        } else {
          console.error('[CLIENT_FORM] No client ID in response');
          toast.error('Cliente criado, mas houve erro ao carregar upload de documentos');
        }
      }
    } catch (error: any) {
      console.error('Error saving client:', error);
      toast.error(error.message || 'Erro ao salvar cliente');
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Funcionário (não-admin) não pode editar o cadastro do cliente
  if (isEditing && user?.role !== 'admin') {
    return (
      <div className="max-w-2xl mx-auto mt-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-8 text-center space-y-3">
            <p className="text-red-800 font-semibold">Acesso restrito</p>
            <p className="text-sm text-red-700">
              Apenas administradores podem editar o cadastro de um cliente.
            </p>
            <Button variant="outline" onClick={() => navigate(`/clients/${id}`)}>
              Voltar para o cliente
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
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
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          {isEditing ? 'Editar Cliente' : 'Novo Cliente'}
        </h1>
        <p className="text-sm md:text-base text-gray-600 mt-1">
          {isEditing ? 'Atualize os dados do cliente' : 'Cadastre um novo cliente no sistema'}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Dados Pessoais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Pessoais</CardTitle>
            <CardDescription>Informações básicas do cliente</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Nome Completo *</Label>
                <Input
                  id="fullName"
                  {...register('fullName', { required: 'Campo obrigatório' })}
                  placeholder="Nome completo do cliente"
                />
                {errors.fullName && (
                  <p className="text-sm text-red-600">{errors.fullName.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="cpfCnpj">CPF/CNPJ *</Label>
                <Input
                  id="cpfCnpj"
                  {...register('cpfCnpj', { required: 'Campo obrigatório' })}
                  placeholder="000.000.000-00"
                />
                {errors.cpfCnpj && (
                  <p className="text-sm text-red-600">{errors.cpfCnpj.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="rg">RG *</Label>
                <Input
                  id="rg"
                  {...register('rg', { required: 'Campo obrigatório' })}
                  placeholder="00.000.000-0"
                />
                {errors.rg && <p className="text-sm text-red-600">{errors.rg.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthDate">Data de Nascimento *</Label>
                <Input
                  id="birthDate"
                  type="date"
                  {...register('birthDate', { required: 'Campo obrigatório' })}
                />
                {errors.birthDate && (
                  <p className="text-sm text-red-600">{errors.birthDate.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Contato */}
        <Card>
          <CardHeader>
            <CardTitle>Contato</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone *</Label>
                <Input
                  id="phone"
                  {...register('phone', { required: 'Campo obrigatório' })}
                  placeholder="(11) 98765-4321"
                />
                {errors.phone && (
                  <p className="text-sm text-red-600">{errors.phone.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatsapp">WhatsApp</Label>
                <Input
                  id="whatsapp"
                  {...register('whatsapp')}
                  placeholder="(11) 98765-4321"
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">E-mail *</Label>
                <Input
                  id="email"
                  type="email"
                  {...register('email', { required: 'Campo obrigatório' })}
                  placeholder="cliente@email.com"
                />
                {errors.email && (
                  <p className="text-sm text-red-600">{errors.email.message}</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Endereço */}
        <Card>
          <CardHeader>
            <CardTitle>Endereço</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="address">Endereço Completo</Label>
              <Textarea
                id="address"
                {...register('address')}
                placeholder="Rua, número, complemento, bairro, cidade, estado, CEP"
                rows={3}
              />
            </div>
          </CardContent>
        </Card>

        {/* Dados Profissionais */}
        <Card>
          <CardHeader>
            <CardTitle>Dados Profissionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="occupation">Profissão</Label>
                <Input
                  id="occupation"
                  {...register('occupation')}
                  placeholder="Ex: Desenvolvedor"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="company">Empresa</Label>
                <Input
                  id="company"
                  {...register('company')}
                  placeholder="Nome da empresa"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="monthlyIncome">Renda Mensal</Label>
                <Input
                  id="monthlyIncome"
                  {...register('monthlyIncome')}
                  placeholder="R$ 5.000,00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  defaultValue="active"
                  onValueChange={(value) => setValue('status', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Ativo</SelectItem>
                    <SelectItem value="inactive">Inativo</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="paymentMethod">Forma de Pagamento</Label>
                <Select
                  value={watch('paymentMethod') || 'pix'}
                  onValueChange={(value) => setValue('paymentMethod', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pix">💠 Pix</SelectItem>
                    <SelectItem value="dinheiro">💵 Dinheiro</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Indicação */}
        

        {/* LGPD Consent */}
        <Card>
          <CardHeader>
            <CardTitle>Consentimento LGPD</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start space-x-2">
              <Checkbox
                id="lgpdConsent"
                checked={lgpdConsent}
                onCheckedChange={(checked) => {
                  // Handle both boolean and 'indeterminate' string
                  setValue('lgpdConsent', checked === true || checked === 'indeterminate');
                }}
              />
              <div className="grid gap-1.5 leading-none">
                <label
                  htmlFor="lgpdConsent"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                >
                  Aceito o tratamento de dados pessoais *
                </label>
                <p className="text-sm text-gray-600">
                  Declaro estar ciente e concordo com a coleta, armazenamento e tratamento dos
                  meus dados pessoais conforme a Lei Geral de Proteção de Dados (LGPD - Lei nº
                  13.709/2018). Os dados serão utilizados exclusivamente para fins de controle e
                  cobrança.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Document Upload Section - Show always */}
        <Card id="upload-section" className={!clientId ? 'border-amber-200 bg-amber-50/30' : ''}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Upload de Documentos
            </CardTitle>
            <CardDescription>
              Envie as fotos (4 obrigatórias + 2 opcionais) e vídeos (1 obrigatório + 1 opcional) do cliente
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {!clientId ? (
              <div className="text-center py-8 px-4 bg-white rounded-lg border-2 border-dashed border-amber-300">
                <Upload className="h-12 w-12 mx-auto mb-3 text-amber-500" />
                <p className="text-amber-800 font-medium mb-1">
                  📋 Primeiro, salve os dados do cliente
                </p>
                <p className="text-sm text-amber-600">
                  Após salvar o formulário acima, você poderá fazer o upload dos documentos aqui mesmo.
                </p>
              </div>
            ) : (
              <>
                {/* Fotos Gallery */}
                <MediaGalleryUploader
                  clientId={clientId}
                  mediaType="foto"
                  label="📷 Fotos do Documento (RG, CNH, etc.)"
                  maxCount={6}
                  requiredCount={4}
                  maxSizeMB={5}
                  onUpdate={loadClientDocuments}
                />

                {/* Vídeos Gallery */}
                <MediaGalleryUploader
                  clientId={clientId}
                  mediaType="video"
                  label="🎥 Vídeos de Validação"
                  maxCount={2}
                  requiredCount={1}
                  maxSizeMB={35}
                  onUpdate={loadClientDocuments}
                />

                <div className="mt-6 flex gap-4">
                  <Button type="button" onClick={() => navigate(`/clients/${clientId}`)}>
                    Ver Detalhes do Cliente
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        <div className="flex gap-4">
          <Button type="submit" disabled={loading || !lgpdConsent} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? 'Salvando...' : isEditing ? 'Atualizar Cliente' : 'Completar Cadastro'}
          </Button>
          <Button type="button" variant="outline" onClick={() => navigate(-1)}>
            Cancelar
          </Button>
        </div>
      </form>
    </div>
  );
}