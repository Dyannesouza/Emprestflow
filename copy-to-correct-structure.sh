#!/bin/bash

# Script para copiar os arquivos da Edge Function para a estrutura correta
# Executar na raiz do projeto

echo "🚀 Copiando arquivos para a estrutura correta do Supabase..."

# Criar a pasta correta
mkdir -p supabase/functions/make-server-bd42bc02

# Copiar todos os arquivos
echo "📦 Copiando arquivos..."
cp supabase/functions/server/index.tsx supabase/functions/make-server-bd42bc02/index.ts
cp supabase/functions/server/kv_store.tsx supabase/functions/make-server-bd42bc02/kv_store.tsx
cp supabase/functions/server/billing_routes.tsx supabase/functions/make-server-bd42bc02/billing_routes.tsx
cp supabase/functions/server/health.tsx supabase/functions/make-server-bd42bc02/health.tsx

echo "✅ Arquivos copiados com sucesso!"
echo ""
echo "📂 Estrutura criada:"
ls -la supabase/functions/make-server-bd42bc02/
echo ""
echo "🚀 Próximo passo: Fazer re-deploy"
echo "   supabase functions deploy make-server-bd42bc02 --no-verify-jwt"
