import type { FastifyInstance } from 'fastify';
import { verifyAdmin } from '../../hooks/auth-hook';
import { writeAdminAuditLog } from '../../services/audit-service';
import { calculateCompleteness, extractManualProfileUpdates, mergeAssetProfile } from '../../services/asset-profile-service';

interface InventoryQuery {
  company_id?: string;
  source_type?: 'server' | 'network_device';
  asset_type?: string;
  customer_visible?: string;
  completeness_status?: string;
  search?: string;
}

export default async function adminInventoryRoutes(fastify: FastifyInstance): Promise<void> {
  const { supabaseAdmin } = fastify;
  fastify.addHook('preHandler', fastify.authenticate);
  fastify.addHook('preHandler', verifyAdmin);

  fastify.get<{ Querystring: InventoryQuery }>('/profiles', async (request, reply) => {
    const { company_id, source_type, asset_type, customer_visible, completeness_status, search } = request.query;
    let query = supabaseAdmin.from('asset_profiles').select('*, companies(name)').order('updated_at', { ascending: false });
    if (company_id) query = query.eq('company_id', company_id);
    if (source_type) query = query.eq('source_type', source_type);
    if (asset_type) query = query.eq('asset_type', asset_type);
    if (customer_visible === 'true' || customer_visible === 'false') query = query.eq('customer_visible', customer_visible === 'true');
    const { data, error } = await query;
    if (error) return reply.code(500).send({ error: error.message });

    let rows = (data || []).map((profile: any) => ({
      ...profile,
      company_name: profile.companies?.name,
      completeness_status: calculateCompleteness(profile),
    }));
    if (search) {
      const needle = search.toLowerCase();
      rows = rows.filter((row: any) =>
        [
          row.display_name,
          row.model,
          row.auto_data?.hostname,
          row.auto_data?.device_name,
          row.auto_data?.ip_address,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(needle))
      );
    }
    return completeness_status ? rows.filter((row: any) => row.completeness_status === completeness_status) : rows;
  });

  fastify.get<{ Params: { id: string } }>('/profiles/:id', async (request, reply) => {
    const { id } = request.params;
    const { data: profile, error } = await supabaseAdmin.from('asset_profiles').select('*').eq('id', id).maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!profile) return reply.code(404).send({ error: 'Perfil não encontrado' });

    const sourceTable = profile.source_type === 'server' ? 'servers' : 'network_devices';
    const { data: source, error: sourceError } = await supabaseAdmin.from(sourceTable).select('*').eq('id', profile.source_id).maybeSingle();
    if (sourceError) return reply.code(500).send({ error: sourceError.message });
    return mergeAssetProfile(profile, source);
  });

  fastify.patch<{ Params: { id: string }; Body: Record<string, any> }>('/profiles/:id', async (request, reply) => {
    const { id } = request.params;
    const { data: current, error: currentError } = await supabaseAdmin.from('asset_profiles').select('*').eq('id', id).maybeSingle();
    if (currentError) return reply.code(500).send({ error: currentError.message });
    if (!current) return reply.code(404).send({ error: 'Perfil não encontrado' });

    const { updates, manualData, manualOverrideFields } = extractManualProfileUpdates(request.body || {});
    const nextOverrides = Array.from(new Set([...(current.manual_override_fields || []), ...manualOverrideFields]));
    const payload = {
      ...updates,
      manual_data: { ...(current.manual_data || {}), ...manualData },
      manual_override_fields: nextOverrides,
      updated_by: (request.user as any)?.user?.id || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabaseAdmin.from('asset_profiles').update(payload).eq('id', id).select().single();
    if (error) return reply.code(500).send({ error: error.message });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'asset_profile.update',
      entityType: 'asset_profile',
      entityId: id,
      companyId: data.company_id,
      summary: `Ficha atualizada: ${data.display_name || id}`,
      metadata: { fields: Object.keys(updates) },
    });
    return { ...data, completeness_status: calculateCompleteness(data) };
  });

  fastify.patch<{ Params: { id: string }; Body: { customer_visible: boolean } }>('/profiles/:id/visibility', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabaseAdmin
      .from('asset_profiles')
      .update({
        customer_visible: Boolean(request.body?.customer_visible),
        updated_by: (request.user as any)?.user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'Perfil não encontrado' });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'asset_profile.visibility',
      entityType: 'asset_profile',
      entityId: id,
      companyId: data.company_id,
      summary: `${data.customer_visible ? 'Ativo publicado' : 'Ativo ocultado'}: ${data.display_name || id}`,
      metadata: { customer_visible: data.customer_visible },
    });
    return data;
  });

  fastify.post<{ Params: { id: string } }>('/profiles/:id/review', async (request, reply) => {
    const { id } = request.params;
    const { data, error } = await supabaseAdmin
      .from('asset_profiles')
      .update({
        last_reviewed_at: new Date().toISOString(),
        updated_by: (request.user as any)?.user?.id || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .maybeSingle();
    if (error) return reply.code(500).send({ error: error.message });
    if (!data) return reply.code(404).send({ error: 'Perfil não encontrado' });
    await writeAdminAuditLog(supabaseAdmin, request, {
      action: 'asset_profile.review',
      entityType: 'asset_profile',
      entityId: id,
      companyId: data.company_id,
      summary: `Revisão manual concluída: ${data.display_name || id}`,
    });
    return data;
  });
}
