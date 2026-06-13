// Health check endpoint for monitoring
export function addHealthRoutes(app: any) {
  // Simple health check
  app.get('/make-server-bd42bc02/health', (c: any) => {
    return c.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      service: 'emprestflow-api'
    });
  });

  // Detailed health check
  app.get('/make-server-bd42bc02/health/detailed', (c: any) => {
    const hasSupabaseUrl = !!Deno.env.get('SUPABASE_URL');
    const hasServiceKey = !!(Deno.env.get('SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));
    const hasAnonKey = !!Deno.env.get('SUPABASE_ANON_KEY');
    const hasEvolutionUrl = !!Deno.env.get('EVOLUTION_API_URL');
    const hasEvolutionKey = !!Deno.env.get('EVOLUTION_API_KEY');

    const allRequiredPresent = hasSupabaseUrl && hasServiceKey && hasAnonKey;

    return c.json({
      status: allRequiredPresent ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      version: '2.1.0',
      service: 'emprestflow-api',
      environment: {
        supabase: {
          url: hasSupabaseUrl,
          serviceKey: hasServiceKey,
          anonKey: hasAnonKey,
          configured: hasSupabaseUrl && hasServiceKey && hasAnonKey
        },
        evolution: {
          apiUrl: hasEvolutionUrl,
          apiKey: hasEvolutionKey,
          configured: hasEvolutionUrl && hasEvolutionKey
        }
      },
      features: {
        authentication: allRequiredPresent,
        whatsapp: hasEvolutionUrl && hasEvolutionKey,
        storage: allRequiredPresent
      }
    });
  });
}