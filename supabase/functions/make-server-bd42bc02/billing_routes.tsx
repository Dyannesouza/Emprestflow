import { Hono } from "npm:hono";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = (Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'))!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

const evolutionApiUrl = Deno.env.get('EVOLUTION_API_URL');
const evolutionApiKey = Deno.env.get('EVOLUTION_API_KEY');

// ============================================
// HELPER FUNCTIONS: Date Formatting (Fix Timezone Issues)
// ============================================

/**
 * Safely parse a date string avoiding timezone issues
 * Forces time to 12:00:00 to prevent date shifts
 */
function parseDateSafe(dateString: string): Date {
  const dateOnly = dateString.split('T')[0]; // Get only YYYY-MM-DD
  return new Date(`${dateOnly}T12:00:00`); // Force noon time
}

/**
 * Format date as DD/MM/YYYY manually to avoid timezone issues
 */
function formatDateBR(dateString: string): string {
  const dateOnly = dateString.split('T')[0]; // Get YYYY-MM-DD
  const [year, month, day] = dateOnly.split('-');
  return `${day}/${month}/${year}`;
}
const evolutionInstanceName = Deno.env.get('EVOLUTION_INSTANCE_NAME') || 'emprestflow';

interface MessageTemplate {
  id: string;
  name: string;
  type: 'before_due' | 'on_due_date' | 'after_due';
  daysOffset: number;
  enabled: boolean;
  message: string;
  createdAt: string;
  updatedAt: string;
}

interface BillingConfig {
  enabled: boolean;
  sendBeforeDue: boolean;
  daysBeforeDue: number;
  sendOnDueDate: boolean;
  sendAfterDue: boolean;
  daysAfterDue: number[];
  businessHoursOnly: boolean;
  startHour: number;
  endHour: number;
}

interface MessageLog {
  id: string;
  clientId: string;
  contractId: string;
  installmentNumber: number;
  templateId: string;
  phoneNumber: string;
  message: string;
  status: 'pending' | 'sent' | 'failed';
  sentAt?: string;
  error?: string;
}

export function addBillingRoutes(app: Hono, authenticateUser: any) {
  // ============================================
  // GET /billing/config - Get billing configuration
  // ============================================
  app.get('/make-server-bd42bc02/billing/config', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      
      console.log('[BILLING] /billing/config - Auth headers:', {
        hasAuthHeader: !!authHeader,
        hasUserTokenHeader: !!userTokenHeader,
      });
      
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      console.log('[BILLING] /billing/config - Auth result:', {
        hasUser: !!user,
        userId: user?.id,
        userRole: user?.role,
        error: error,
      });

      if (error || !user) {
        console.error('[BILLING] /billing/config - Authentication failed:', error);
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        console.error('[BILLING] /billing/config - Access denied. User role:', user.role);
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const config = await kv.get<BillingConfig>('billing:config');
      
      // Default config if not exists
      const defaultConfig: BillingConfig = {
        enabled: false,
        sendBeforeDue: true,
        daysBeforeDue: 3,
        sendOnDueDate: true,
        sendAfterDue: true,
        daysAfterDue: [1, 3, 7, 15],
        businessHoursOnly: true,
        startHour: 9,
        endHour: 18,
      };

      return c.json({ config: config || defaultConfig });
    } catch (error: any) {
      console.error('[BILLING] Error getting config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // POST /billing/config - Update billing configuration
  // ============================================
  app.post('/make-server-bd42bc02/billing/config', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const config = await c.req.json<BillingConfig>();
      await kv.set('billing:config', config);

      console.log('[BILLING] Config updated by user:', user.id, config);

      return c.json({ success: true, config });
    } catch (error: any) {
      console.error('[BILLING] Error updating config:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // GET /billing/templates - Get all templates
  // ============================================
  app.get('/make-server-bd42bc02/billing/templates', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const templates = await kv.getByPrefix<MessageTemplate>('billing:template:');
      
      return c.json({ templates: templates || [] });
    } catch (error: any) {
      console.error('[BILLING] Error getting templates:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // POST /billing/templates - Create template
  // ============================================
  app.post('/make-server-bd42bc02/billing/templates', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const body = await c.req.json();
      const id = crypto.randomUUID();
      
      const template: MessageTemplate = {
        id,
        name: body.name,
        type: body.type,
        daysOffset: body.daysOffset || 0,
        enabled: true,
        message: body.message,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`billing:template:${id}`, template);

      console.log('[BILLING] Template created:', id, 'by user:', user.id);

      return c.json({ success: true, template });
    } catch (error: any) {
      console.error('[BILLING] Error creating template:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // PUT /billing/templates/:id - Update template
  // ============================================
  app.put('/make-server-bd42bc02/billing/templates/:id', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const id = c.req.param('id');
      const body = await c.req.json();
      
      const existing = await kv.get<MessageTemplate>(`billing:template:${id}`);
      if (!existing) {
        return c.json({ error: 'Template não encontrado' }, 404);
      }

      const updated: MessageTemplate = {
        ...existing,
        name: body.name || existing.name,
        type: body.type || existing.type,
        daysOffset: body.daysOffset !== undefined ? body.daysOffset : existing.daysOffset,
        enabled: body.enabled !== undefined ? body.enabled : existing.enabled,
        message: body.message || existing.message,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`billing:template:${id}`, updated);

      console.log('[BILLING] Template updated:', id, 'by user:', user.id);

      return c.json({ success: true, template: updated });
    } catch (error: any) {
      console.error('[BILLING] Error updating template:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // DELETE /billing/templates/:id - Delete template
  // ============================================
  app.delete('/make-server-bd42bc02/billing/templates/:id', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const id = c.req.param('id');
      await kv.del(`billing:template:${id}`);

      console.log('[BILLING] Template deleted:', id, 'by user:', user.id);

      return c.json({ success: true });
    } catch (error: any) {
      console.error('[BILLING] Error deleting template:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // POST /billing/templates/:id/toggle - Toggle template
  // ============================================
  app.post('/make-server-bd42bc02/billing/templates/:id/toggle', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const id = c.req.param('id');
      const body = await c.req.json();
      
      const existing = await kv.get<MessageTemplate>(`billing:template:${id}`);
      if (!existing) {
        return c.json({ error: 'Template não encontrado' }, 404);
      }

      const updated: MessageTemplate = {
        ...existing,
        enabled: body.enabled,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`billing:template:${id}`, updated);

      console.log('[BILLING] Template toggled:', id, 'enabled:', body.enabled, 'by user:', user.id);

      return c.json({ success: true, template: updated });
    } catch (error: any) {
      console.error('[BILLING] Error toggling template:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // POST /billing/templates/:id/test - Send test message
  // ============================================
  app.post('/make-server-bd42bc02/billing/templates/:id/test', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const id = c.req.param('id');
      const template = await kv.get<MessageTemplate>(`billing:template:${id}`);
      
      if (!template) {
        return c.json({ error: 'Template não encontrado' }, 404);
      }

      // Replace variables with example data
      let message = template.message;
      message = message.replace(/{cliente}/g, 'João Silva');
      message = message.replace(/{valor}/g, 'R$ 500,00');
      message = message.replace(/{vencimento}/g, '15/03/2026');
      message = message.replace(/{parcela}/g, '3');
      message = message.replace(/{contrato}/g, '12345');
      message = message.replace(/{dias_atraso}/g, '2');

      // Send via Evolution API (to admin's WhatsApp)
      if (evolutionApiUrl && evolutionApiKey) {
        try {
          // Validate URL format
          if (!evolutionApiUrl.startsWith('http://') && !evolutionApiUrl.startsWith('https://')) {
            console.error('[BILLING] Invalid EVOLUTION_API_URL format. Must start with http:// or https://');
            console.error('[BILLING] Current value:', evolutionApiUrl);
            throw new Error(`Invalid EVOLUTION_API_URL format: "${evolutionApiUrl}". Must be a complete URL like https://api.evolution.com`);
          }

          const whatsappUrl = `${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`;
          console.log('[BILLING] Sending test message to Evolution API:', whatsappUrl);

          const response = await fetch(whatsappUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'apikey': evolutionApiKey,
            },
            body: JSON.stringify({
              number: '5581985828087', // Send test to admin
              text: `🧪 TESTE DE MENSAGEM\n\n${message}\n\n--- Esta é uma mensagem de teste ---`,
            }),
          });

          if (!response.ok) {
            const errorText = await response.text();
            console.error('[BILLING] Evolution API error response:', errorText);
            throw new Error(`Erro ao enviar mensagem de teste: ${errorText}`);
          }

          const result = await response.json();
          console.log('[BILLING] Evolution API success:', result);
        } catch (fetchError: any) {
          console.error('[BILLING] Error calling Evolution API:', fetchError);
          throw fetchError;
        }
      } else {
        console.warn('[BILLING] Evolution API not configured. Set EVOLUTION_API_URL and EVOLUTION_API_KEY');
        throw new Error('Evolution API não configurada. Configure as variáveis EVOLUTION_API_URL e EVOLUTION_API_KEY');
      }

      console.log('[BILLING] Test message sent for template:', id, 'by user:', user.id);

      return c.json({ success: true });
    } catch (error: any) {
      console.error('[BILLING] Error sending test message:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // GET /billing/stats - Get billing statistics
  // ============================================
  app.get('/make-server-bd42bc02/billing/stats', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      // Get message logs
      const logs = await kv.getByPrefix<MessageLog>('billing:log:');
      
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today.getTime() - 24 * 60 * 60 * 1000);

      const totalSent = logs.filter(log => log.status === 'sent').length;
      const sentToday = logs.filter(log => {
        const sentAt = log.sentAt ? new Date(log.sentAt) : null;
        return log.status === 'sent' && sentAt && sentAt >= today;
      }).length;
      
      const successRate = logs.length > 0 
        ? Math.round((totalSent / logs.length) * 100) 
        : 0;
      
      const pendingToSend = logs.filter(log => log.status === 'pending').length;
      
      const failedLast24h = logs.filter(log => {
        const sentAt = log.sentAt ? new Date(log.sentAt) : null;
        return log.status === 'failed' && sentAt && sentAt >= yesterday;
      }).length;

      const stats = {
        totalSent,
        sentToday,
        successRate,
        pendingToSend,
        failedLast24h,
      };

      return c.json({ stats });
    } catch (error: any) {
      console.error('[BILLING] Error getting stats:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // POST /billing/process - Process pending billings (CRON)
  // ============================================
  app.post('/make-server-bd42bc02/billing/process', async (c) => {
    try {
      console.log('[BILLING] Starting billing process...');

      // Check if billing is enabled
      const config = await kv.get<BillingConfig>('billing:config');
      if (!config || !config.enabled) {
        console.log('[BILLING] Billing is disabled');
        return c.json({ message: 'Billing is disabled', processed: 0 });
      }

      // Check business hours
      if (config.businessHoursOnly) {
        const now = new Date();
        const hour = now.getHours();
        if (hour < config.startHour || hour >= config.endHour) {
          console.log('[BILLING] Outside business hours');
          return c.json({ message: 'Outside business hours', processed: 0 });
        }
      }

      // Get all active contracts
      const contracts = await kv.getByPrefix('contract:');
      const activeContracts = contracts.filter((c: any) => c.status === 'active');

      console.log('[BILLING] Found active contracts:', activeContracts.length);

      // Get all templates
      const templates = await kv.getByPrefix<MessageTemplate>('billing:template:');
      const activeTemplates = templates.filter(t => t.enabled);

      console.log('[BILLING] Found active templates:', activeTemplates.length);

      let processed = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      // Process each contract
      for (const contract of activeContracts) {
        if (!contract.installmentsList || contract.installmentsList.length === 0) continue;

        // Get client info
        const clientData = await kv.get(`client:${contract.clientId}`);
        if (!clientData) {
          console.log('[BILLING] Client not found for contract:', contract.id, 'clientId:', contract.clientId);
          continue;
        }
        
        // Parse client data if it's a JSON string
        const client = typeof clientData === 'string' ? JSON.parse(clientData) : clientData;
        if (!client) {
          console.log('[BILLING] Failed to parse client data for:', contract.clientId);
          continue;
        }
        
        console.log('[BILLING] Processing contract:', contract.contractNumber, 'for client:', client.fullName, 'whatsapp:', client.whatsapp);

        // Process each installment
        for (const installment of contract.installmentsList) {
          if (installment.status === 'paid') continue;

          const dueDate = parseDateSafe(installment.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          // Check each template
          for (const template of activeTemplates) {
            let shouldSend = false;

            if (template.type === 'before_due' && diffDays === template.daysOffset) {
              shouldSend = true;
            } else if (template.type === 'on_due_date' && diffDays === 0) {
              shouldSend = true;
            } else if (template.type === 'after_due' && diffDays === -template.daysOffset) {
              shouldSend = true;
            }

            if (shouldSend) {
              // Check if already sent today
              const logKey = `billing:log:${contract.id}:${installment.number}:${template.id}:${today.toISOString().split('T')[0]}`;
              const existingLog = await kv.get(logKey);

              if (existingLog) {
                console.log('[BILLING] Already sent today:', logKey);
                continue;
              }

              // Format message
              let message = template.message;
              message = message.replace(/{cliente}/g, client.fullName || 'Cliente');
              message = message.replace(/{valor}/g, `R$ ${installment.amount.toFixed(2).replace('.', ',')}`);
              message = message.replace(/{vencimento}/g, formatDateBR(installment.dueDate));
              message = message.replace(/{parcela}/g, installment.number.toString());
              message = message.replace(/{contrato}/g, contract.contractNumber);
              
              const daysOverdue = Math.max(0, -diffDays);
              message = message.replace(/{dias_atraso}/g, daysOverdue.toString());

              // Send message
              const phoneNumber = client.whatsapp.replace(/\D/g, '');
              
              try {
                if (evolutionApiUrl && evolutionApiKey) {
                  const response = await fetch(`${evolutionApiUrl}/message/sendText/${evolutionInstanceName}`, {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'apikey': evolutionApiKey,
                    },
                    body: JSON.stringify({
                      number: phoneNumber,
                      text: message,
                    }),
                  });

                  if (!response.ok) {
                    throw new Error('Evolution API error');
                  }

                  // Log success
                  const log: MessageLog = {
                    id: crypto.randomUUID(),
                    clientId: contract.clientId,
                    contractId: contract.id,
                    installmentNumber: installment.number,
                    templateId: template.id,
                    phoneNumber,
                    message,
                    status: 'sent',
                    sentAt: new Date().toISOString(),
                  };

                  await kv.set(logKey, log);
                  processed++;

                  console.log('[BILLING] Message sent:', {
                    client: client.fullName,
                    contract: contract.contractNumber,
                    installment: installment.number,
                    template: template.name,
                  });
                }
              } catch (error: any) {
                console.error('[BILLING] Error sending message:', error);

                // Log failure
                const log: MessageLog = {
                  id: crypto.randomUUID(),
                  clientId: contract.clientId,
                  contractId: contract.id,
                  installmentNumber: installment.number,
                  templateId: template.id,
                  phoneNumber,
                  message,
                  status: 'failed',
                  sentAt: new Date().toISOString(),
                  error: error.message,
                };

                await kv.set(logKey, log);
              }
            }
          }
        }
      }

      console.log('[BILLING] Process completed. Processed:', processed);

      return c.json({ success: true, processed });
    } catch (error: any) {
      console.error('[BILLING] Error in process:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // GET /billing/upcoming - Get contracts due in 3 days
  // ============================================
  app.get('/make-server-bd42bc02/billing/upcoming', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      // Get all active contracts
      const contractsRaw = await kv.getByPrefix('contract:');
      console.log('[BILLING_UPCOMING] Total contracts found:', contractsRaw?.length || 0);
      
      // Parse contracts if they are strings
      const contracts = contractsRaw.map((c: any) => {
        if (typeof c === 'string') {
          return JSON.parse(c);
        }
        return c;
      });
      
      const activeContracts = contracts.filter((c: any) => c.status === 'active');
      console.log('[BILLING_UPCOMING] Active contracts:', activeContracts?.length || 0);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const threeDaysFromNow = new Date(today);
      threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

      const upcomingContracts: any[] = [];

      // Process each contract
      for (const contract of activeContracts) {
        if (!contract.installmentsList || contract.installmentsList.length === 0) {
          continue;
        }

        // Get client info
        const clientData = await kv.get(`client:${contract.clientId}`);
        
        if (!clientData) {
          console.log('[BILLING_UPCOMING] ❌ No client found for contract:', contract.contractNumber, 'clientId:', contract.clientId);
          continue;
        }
        
        // Parse client data if it's a JSON string
        const client = typeof clientData === 'string' ? JSON.parse(clientData) : clientData;
        
        if (!client) {
          console.log('[BILLING_UPCOMING] ❌ Failed to parse client for:', contract.clientId);
          continue;
        }

        console.log('[BILLING_UPCOMING] ✅ Processing contract:', contract.contractNumber, 'Client:', client.fullName);

        // Find unpaid installments due within 3 days
        for (const installment of contract.installmentsList) {
          if (installment.status === 'paid') continue;

          const dueDate = parseDateSafe(installment.dueDate);
          dueDate.setHours(0, 0, 0, 0);

          const diffDays = Math.floor((dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

          console.log('[BILLING_UPCOMING]   📅 Installment #', installment.number, 'Due:', installment.dueDate, 'Days:', diffDays);

          // Include contracts due in 0-3 days
          if (diffDays >= 0 && diffDays <= 3) {
            console.log('[BILLING_UPCOMING]   ✅ ADDING to upcoming list!');
            upcomingContracts.push({
              contractId: contract.id,
              contractNumber: contract.contractNumber,
              clientName: client.fullName,
              clientWhatsapp: client.whatsapp,
              installmentNumber: installment.number,
              installmentAmount: installment.amount,
              dueDate: installment.dueDate,
              daysUntilDue: diffDays,
              totalValue: contract.totalValue,
              installmentsCount: contract.installmentsCount,
            });
          }
        }
      }

      // Sort by days until due (ascending)
      upcomingContracts.sort((a, b) => a.daysUntilDue - b.daysUntilDue);

      console.log('[BILLING_UPCOMING] 🎯 FINAL RESULT: Found', upcomingContracts.length, 'upcoming contracts');

      return c.json({ contracts: upcomingContracts });
    } catch (error: any) {
      console.error('[BILLING] Error getting upcoming contracts:', error);
      return c.json({ error: error.message }, 500);
    }
  });
  
  // ============================================
  // GET /billing/calendar - Installments of a given month (calendar view)
  // ============================================
  app.get('/make-server-bd42bc02/billing/calendar', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      const year = parseInt(c.req.query('year') || '');
      const month = parseInt(c.req.query('month') || '');

      if (!year || !month || month < 1 || month > 12) {
        return c.json({ error: 'Parâmetros year e month são obrigatórios (ex: ?year=2026&month=6)' }, 400);
      }

      const contractsRaw = await kv.getByPrefix('contract:contract_');
      const contracts = contractsRaw.map((item: any) =>
        typeof item === 'string' ? JSON.parse(item) : item
      );
      const activeContracts = contracts.filter((contract: any) => contract.status === 'active');

      const todayStr = new Date().toISOString().split('T')[0];

      const installments: any[] = [];
      const summary = { total: 0, pending: 0, paid: 0, overdue: 0 };
      const clientCache = new Map<string, any>();

      for (const contract of activeContracts) {
        const installmentsList = contract.installmentsList || contract.installmentList || [];
        if (installmentsList.length === 0) continue;

        // Does this contract have any installment in the requested month?
        // dueDate is stored as "YYYY-MM-DD" or "YYYY-MM-DDT12:00:00" — compare by string to avoid timezone shifts
        const monthPrefix = `${year}-${String(month).padStart(2, '0')}-`;
        const monthInstallments = installmentsList.filter((inst: any) =>
          inst.dueDate && String(inst.dueDate).startsWith(monthPrefix)
        );
        if (monthInstallments.length === 0) continue;

        // Resolve client (with cache to avoid repeated KV reads)
        let client = clientCache.get(contract.clientId);
        if (client === undefined) {
          const clientData = await kv.get(`client:${contract.clientId}`);
          client = clientData
            ? (typeof clientData === 'string' ? JSON.parse(clientData) : clientData)
            : null;
          clientCache.set(contract.clientId, client);
        }

        const clientName = client?.fullName || 'Cliente não encontrado';
        const clientPhone = client?.whatsapp || client?.phone || '';
        const contractNumber = contract.contractNumber || contract.id.split('_')[1] || contract.id;
        const totalInstallments = contract.installments || contract.installmentsCount || installmentsList.length;

        for (const inst of monthInstallments) {
          if (inst.status === 'cancelled') continue;

          const number = inst.number ?? inst.installmentNumber;
          const amount = inst.amount ?? inst.value ?? 0;
          const dueDateStr = String(inst.dueDate).split('T')[0];

          // Fix status: pending + past due date => overdue
          let status: 'pending' | 'paid' | 'overdue' = inst.status === 'paid' ? 'paid' : 'pending';
          if (status === 'pending' && dueDateStr < todayStr) {
            status = 'overdue';
          }

          summary.total++;
          summary[status]++;

          installments.push({
            id: `${contract.id}-${number}`,
            contractId: contract.id,
            contractNumber,
            clientName,
            clientPhone,
            number,
            total: totalInstallments,
            dueDate: dueDateStr,
            status,
            paidAt: inst.paidAt || null,
            paidAmount: inst.paidAmount ?? null,
            amount,
          });
        }
      }

      installments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

      console.log('[BILLING_CALENDAR]', `${year}-${month}:`, summary);

      return c.json({ success: true, year, month, installments, summary });
    } catch (error: any) {
      console.error('[BILLING] Error getting calendar:', error);
      return c.json({ error: error.message }, 500);
    }
  });

  // ============================================
  // GET /diagnostic/data - Complete system diagnostic
  // ============================================
  app.get('/make-server-bd42bc02/diagnostic/data', async (c) => {
    try {
      const authHeader = c.req.header('Authorization');
      const userTokenHeader = c.req.header('X-User-Token');
      const { user, error } = await authenticateUser(authHeader, userTokenHeader);

      if (error || !user) {
        return c.json({ error: 'Unauthorized' }, 401);
      }

      if (user.role !== 'admin' && user.role !== 'operator') {
        return c.json({ error: 'Acesso negado' }, 403);
      }

      // Get ALL data
      const allClientsRaw = await kv.getByPrefix('client:');
      const allContractsRaw = await kv.getByPrefix('contract:');
      
      const clients = allClientsRaw.map((c: any) => {
        if (typeof c === 'string') return JSON.parse(c);
        return c;
      });
      
      const contracts = allContractsRaw.map((c: any) => {
        if (typeof c === 'string') return JSON.parse(c);
        return c;
      });

      const activeContracts = contracts.filter((c: any) => c.status === 'active');
      
      // Detailed contract info
      const contractDetails = await Promise.all(activeContracts.map(async (contract: any) => {
        const clientData = await kv.get(`client:${contract.clientId}`);
        const client = clientData ? (typeof clientData === 'string' ? JSON.parse(clientData) : clientData) : null;
        
        return {
          contractNumber: contract.contractNumber,
          contractId: contract.id,
          clientId: contract.clientId,
          clientFound: !!client,
          clientName: client?.fullName || 'NOT FOUND',
          clientWhatsapp: client?.whatsapp || 'N/A',
          installmentsCount: contract.installmentsCount,
          totalValue: contract.totalValue,
          installments: contract.installmentsList?.map((inst: any) => ({
            number: inst.number,
            amount: inst.amount,
            dueDate: inst.dueDate,
            status: inst.status,
            daysUntilDue: Math.floor((parseDateSafe(inst.dueDate).getTime() - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24))
          })) || []
        };
      }));

      return c.json({
        summary: {
          totalClients: clients.length,
          totalContracts: contracts.length,
          activeContracts: activeContracts.length,
        },
        clients: clients.map((c: any) => ({
          id: c.id,
          fullName: c.fullName,
          whatsapp: c.whatsapp,
          cpf: c.cpf
        })),
        contracts: contractDetails
      });
    } catch (error: any) {
      console.error('[DIAGNOSTIC] Error:', error);
      return c.json({ error: error.message }, 500);
    }
  });
}