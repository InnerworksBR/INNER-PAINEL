import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { SupabaseClient } from '@supabase/supabase-js';

// Extend Fastify instance with our custom decorators
declare module 'fastify' {
  interface FastifyInstance {
    supabase: SupabaseClient;
    supabaseAdmin: SupabaseClient;
    authenticate: (request: FastifyRequest, reply: FastifyReply) => Promise<void>;
  }
}

// JWT User Payload
export interface UserProfile {
  id: string;
  email: string;
  role: 'admin' | 'client';
  company_id: string | null;
  company_name?: string;
  status?: string;
}

export interface JWTPayload {
  user: UserProfile;
}

// Extend FastifyRequest for JWT decoded payload
declare module '@fastify/jwt' {
  interface FastifyJWT {
    payload: JWTPayload;
    user: JWTPayload;
  }
}

// Database Models
export interface Company {
  id: string;
  name: string;
  cnpj: string;
  sector?: string;
  status: string;
  created_at: string;
  company_integrations?: CompanyIntegration[];
}

export interface CompanyIntegration {
  company_id: string;
  glpi_entity_id?: number | null;
  zabbix_api_url?: string;
  zabbix_user?: string;
  zabbix_password?: string;
  ms_graph_tenant_id?: string;
  ms_graph_client_id?: string;
  ms_graph_client_secret?: string;
  ms365_last_sync_at?: string | null;
  ms365_last_sync_error?: string | null;
  ms365_last_sync_count?: number;
  zabbix_last_sync_at?: string | null;
  zabbix_last_sync_error?: string | null;
  zabbix_last_sync_count?: number;
  zabbix_network_last_sync_at?: string | null;
  zabbix_network_last_sync_error?: string | null;
  zabbix_network_last_sync_count?: number;
  glpi_last_sync_at?: string | null;
  glpi_last_sync_error?: string | null;
  glpi_last_sync_count?: number;
  updated_at: string;
}

export interface Profile {
  id: string;
  full_name: string;
  role: 'admin' | 'client';
  company_id: string | null;
  status?: string;
  last_login_at?: string | null;
  created_at?: string;
  updated_at: string;
  companies?: { name: string };
}

export interface MS365Metric {
  id: string;
  company_id: string;
  license_name: string;
  total: number;
  used: number;
  available: number;
  last_updated: string;
}

export interface Server {
  id: string;
  company_id: string;
  hostname: string;
  cpu_usage: number;
  memory_usage: number;
  disk_usage: number;
  memory_total: number;
  memory_used: number;
  disk_total: number;
  disk_used: number;
  status: string;
  last_updated: string;
}

export interface GLPITicket {
  id: string;
  company_id: string;
  glpi_id: number;
  title: string;
  status: string;
  sla_status: string;
  priority?: string;
  requester?: string;
  department?: string;
  category?: string;
  resolution_date?: string;
  created_at: string;
}

export interface Document {
  id: string;
  company_id: string;
  title: string;
  category: string;
  file_url: string;
  created_at: string;
}

export interface NetworkDevice {
  id: string;
  company_id: string;
  device_name: string;
  device_type: string;
  location: string;
  ip_address?: string;
  uptime_percent: number;
  status: string;
  contract_ref?: string;
  last_updated: string;
}

export interface SystemSetting {
  key: string;
  value: string;
  updated_at: string;
}
