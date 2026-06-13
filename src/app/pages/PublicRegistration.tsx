import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Textarea } from '../components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Checkbox } from '../components/ui/checkbox';
import { toast } from 'sonner';
import { CheckCircle, Send, Upload, ShieldCheck } from 'lucide-react';
import FileUploadPreview from '../components/FileUploadPreview';
import { projectId, publicAnonKey } from '/utils/supabase/info';

interface RegistrationFormData {
  fullName: string;
  cpfCnpj: string;
  rg: string;
  birthDate: string;
  phone: string;
  email: string;
  address: string;
  occupation: string;
  company: string;
  monthlyIncome: string;
  referredByName?: string;
  referredByPhone?: string;
  lgpdConsent: boolean;
}

interface DocumentFile {
  file: File;
  preview: string;
}

type DocumentType = 'front' | 'back' | 'selfie' | 'video';

const API_BASE = `https://${projectId}.supabase.co/functions/v1/make-server-bd42bc02`;

async function publicApiCall(endpoint: string, body: any) {
  const isFormData = body instanceof FormData;

  const headers: Record<string, string> = {
    'Authorization': `Bearer ${publicAnonKey}`,
  };
  if (!isFormData) {
    headers['Content-Type'] = 'application/json';
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers,
    body: isFormData ? body : JSON.stringify(body),
  });

  const data = await response.json().catch(() => ({ error: 'Erro de comunicação com o servidor' }));

  if (!response.ok) {
    const error: any = new Error(data.error || `HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return data;
}

// Masks
const maskCpf = (value: string) =>
  value
    .replace(/\D/g, '')
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d{1,2})$/, '$1-$2');

const maskPhone = (value: string) => {
  const digits = value.replace(/\D/g, '').slice(0, 11);
  if (digits.length <= 2) return digits.replace(/(\d{0,2})/, '($1');
  if (digits.length <= 6) return digits.replace(/(\d{2})(\d{0,4})/, '($1) $2');
  if (digits.length <= 10) return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3');
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3');
};

const maskMoney = (value: string) => {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';
  const amount = parseInt(digits, 10) / 100;
  return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
};

export default function PublicRegistration() {
  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<RegistrationFormData>({
    defaultValues: { lgpdConsent: false },
  });

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [documents, setDocuments] = useState<Record<DocumentType, DocumentFile | null>>({
    front: null,
    back: null,
    selfie: null,
    video: null,
  });

  const lgpdConsent = watch('lgpdConsent');

  const setDocument = (type: DocumentType) => (file: File, preview: string) => {
    setDocuments((prev) => ({ ...prev, [type]: { file, preview } }));
  };

  const removeDocument = (type: DocumentType) => () => {
    setDocuments((prev) => ({ ...prev, [type]: null }));
  };

  const onSubmit = async (data: RegistrationFormData) => {
    if (!data.lgpdConsent) {
      toast.error('É necessário aceitar o termo de consentimento LGPD');
      return;
    }

    const requiredDocs: { type: DocumentType; label: string }[] = [
      { type: 'front', label: 'RG (Frente)' },
      { type: 'back', label: 'RG (Verso)' },
      { type: 'selfie', label: 'Selfie com documento' },
    ];

    for (const doc of requiredDocs) {
      if (!documents[doc.type]) {
        toast.error(`Documento obrigatório: ${doc.label}`);
        return;
      }
    }

    setLoading(true);

    try {
      // 1. Register the client
      const payload = {
        fullName: data.fullName,
        cpfCnpj: data.cpfCnpj,
        rg: data.rg,
        birthDate: data.birthDate,
        phone: data.phone,
        whatsapp: data.phone,
        email: data.email,
        address: data.address,
        occupation: data.occupation,
        company: data.company,
        monthlyIncome: data.monthlyIncome,
        referredBy: data.referredByName
          ? { name: data.referredByName, phone: data.referredByPhone || '' }
          : null,
        lgpdConsent: data.lgpdConsent,
      };

      const response = await publicApiCall('/public/register', payload);
      const { clientId, uploadToken } = response;

      // 2. Upload the documents (FormData, same pattern as the admin uploader)
      const uploads = (Object.keys(documents) as DocumentType[]).filter((type) => documents[type]);
      for (const type of uploads) {
        const doc = documents[type]!;
        const formData = new FormData();
        formData.append('file', doc.file);
        formData.append('documentType', type);
        formData.append('uploadToken', uploadToken);
        await publicApiCall(`/public/register/${clientId}/documents`, formData);
      }

      // 3. Confirmation screen
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error: any) {
      console.error('[PUBLIC_REGISTRATION] Error:', error);
      if (error.status === 409) {
        toast.error('Este CPF já possui cadastro. Nossa equipe entrará em contato.');
      } else {
        toast.error(error.message || 'Erro ao enviar o cadastro. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 flex items-center justify-center p-4">
        <Card className="max-w-md w-full rounded-2xl shadow-2xl border-t-4 border-amber-500">
          <CardContent className="pt-10 pb-10 text-center space-y-4">
            <div className="mx-auto w-20 h-20 rounded-full bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-12 w-12 text-emerald-700" />
            </div>
            <h1 className="text-2xl font-bold text-emerald-900">Cadastro enviado!</h1>
            <p className="text-gray-600">
              Recebemos suas informações com sucesso.
              <br />
              Nossa equipe entrará em contato.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-900 to-emerald-950 py-8 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-3">
          <img
            src="/logo.png"
            alt="ALEMÃO.CREFISA"
            className="h-20 w-20 mx-auto object-contain rounded-full drop-shadow-lg"
          />
          <h1 className="text-2xl md:text-3xl font-bold text-amber-400">Ficha de Cadastro</h1>
          <p className="text-emerald-100 text-sm md:text-base">
            Preencha seus dados abaixo. Após o envio, nossa equipe entrará em contato.
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Dados Pessoais */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle>Dados Pessoais</CardTitle>
              <CardDescription>Informações básicas para o cadastro</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="fullName">Nome Completo *</Label>
                  <Input
                    id="fullName"
                    {...register('fullName', { required: 'Campo obrigatório' })}
                    placeholder="Seu nome completo"
                  />
                  {errors.fullName && (
                    <p className="text-sm text-red-600">{errors.fullName.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="cpfCnpj">CPF *</Label>
                  <Input
                    id="cpfCnpj"
                    inputMode="numeric"
                    {...register('cpfCnpj', {
                      required: 'Campo obrigatório',
                      minLength: { value: 14, message: 'CPF incompleto' },
                    })}
                    onChange={(e) => setValue('cpfCnpj', maskCpf(e.target.value))}
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

                <div className="space-y-2">
                  <Label htmlFor="phone">Telefone / WhatsApp *</Label>
                  <Input
                    id="phone"
                    inputMode="numeric"
                    {...register('phone', {
                      required: 'Campo obrigatório',
                      minLength: { value: 14, message: 'Telefone incompleto' },
                    })}
                    onChange={(e) => setValue('phone', maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                  {errors.phone && (
                    <p className="text-sm text-red-600">{errors.phone.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">E-mail *</Label>
                  <Input
                    id="email"
                    type="email"
                    {...register('email', { required: 'Campo obrigatório' })}
                    placeholder="seuemail@exemplo.com"
                  />
                  {errors.email && (
                    <p className="text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="address">Endereço Completo *</Label>
                  <Textarea
                    id="address"
                    {...register('address', { required: 'Campo obrigatório' })}
                    placeholder="Rua, número, complemento, bairro, cidade, estado, CEP"
                    rows={3}
                  />
                  {errors.address && (
                    <p className="text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Dados Profissionais */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle>Dados Profissionais</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="occupation">Profissão *</Label>
                  <Input
                    id="occupation"
                    {...register('occupation', { required: 'Campo obrigatório' })}
                    placeholder="Ex: Vendedor"
                  />
                  {errors.occupation && (
                    <p className="text-sm text-red-600">{errors.occupation.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="company">Empresa *</Label>
                  <Input
                    id="company"
                    {...register('company', { required: 'Campo obrigatório' })}
                    placeholder="Onde você trabalha"
                  />
                  {errors.company && (
                    <p className="text-sm text-red-600">{errors.company.message}</p>
                  )}
                </div>

                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="monthlyIncome">Renda Mensal *</Label>
                  <Input
                    id="monthlyIncome"
                    inputMode="numeric"
                    {...register('monthlyIncome', { required: 'Campo obrigatório' })}
                    onChange={(e) => setValue('monthlyIncome', maskMoney(e.target.value))}
                    placeholder="R$ 0,00"
                  />
                  {errors.monthlyIncome && (
                    <p className="text-sm text-red-600">{errors.monthlyIncome.message}</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Indicação */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle>Indicação (Opcional)</CardTitle>
              <CardDescription>Se alguém indicou você, informe abaixo</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="referredByName">Nome de quem indicou</Label>
                  <Input
                    id="referredByName"
                    {...register('referredByName')}
                    placeholder="Nome da pessoa"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="referredByPhone">Telefone de quem indicou</Label>
                  <Input
                    id="referredByPhone"
                    inputMode="numeric"
                    {...register('referredByPhone')}
                    onChange={(e) => setValue('referredByPhone', maskPhone(e.target.value))}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Documentos */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Documentos
              </CardTitle>
              <CardDescription>
                Envie fotos legíveis dos seus documentos. Os itens marcados com * são obrigatórios.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>📄 RG (Frente) *</Label>
                  <FileUploadPreview
                    id="doc-front"
                    type="image"
                    onUpload={setDocument('front')}
                    onRemove={removeDocument('front')}
                    file={documents.front?.file}
                    preview={documents.front?.preview}
                  />
                </div>

                <div className="space-y-2">
                  <Label>📄 RG (Verso) *</Label>
                  <FileUploadPreview
                    id="doc-back"
                    type="image"
                    onUpload={setDocument('back')}
                    onRemove={removeDocument('back')}
                    file={documents.back?.file}
                    preview={documents.back?.preview}
                  />
                </div>

                <div className="space-y-2">
                  <Label>🤳 Selfie com documento *</Label>
                  <FileUploadPreview
                    id="doc-selfie"
                    type="image"
                    onUpload={setDocument('selfie')}
                    onRemove={removeDocument('selfie')}
                    file={documents.selfie?.file}
                    preview={documents.selfie?.preview}
                  />
                </div>

                <div className="space-y-2">
                  <Label>🎥 Vídeo de confirmação (opcional)</Label>
                  <FileUploadPreview
                    id="doc-video"
                    type="video"
                    onUpload={setDocument('video')}
                    onRemove={removeDocument('video')}
                    file={documents.video?.file}
                    preview={documents.video?.preview}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* LGPD */}
          <Card className="rounded-2xl shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldCheck className="h-5 w-5" />
                Consentimento LGPD
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start space-x-3">
                <Checkbox
                  id="lgpdConsent"
                  checked={lgpdConsent}
                  onCheckedChange={(checked) => {
                    setValue('lgpdConsent', checked === true || checked === 'indeterminate');
                  }}
                />
                <div className="grid gap-1.5 leading-none">
                  <label htmlFor="lgpdConsent" className="text-sm font-medium leading-none">
                    Aceito o tratamento de dados pessoais *
                  </label>
                  <p className="text-sm text-gray-600">
                    Declaro estar ciente e concordo com a coleta, armazenamento e tratamento dos
                    meus dados pessoais e documentos conforme a Lei Geral de Proteção de Dados
                    (LGPD - Lei nº 13.709/2018). Os dados serão utilizados exclusivamente para
                    fins de análise de crédito, controle e cobrança.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            disabled={loading || !lgpdConsent}
            className="w-full h-12 gap-2 bg-amber-500 hover:bg-amber-600 text-emerald-950 font-bold text-base rounded-xl shadow-lg"
          >
            <Send className="h-5 w-5" />
            {loading ? 'Enviando cadastro...' : 'Enviar Cadastro'}
          </Button>

          <p className="text-center text-xs text-emerald-200 pb-4">
            Seus dados estão protegidos e serão tratados com confidencialidade.
          </p>
        </form>
      </div>
    </div>
  );
}
