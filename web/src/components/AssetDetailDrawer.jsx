import React, { useEffect, useState } from 'react';
import { X, RefreshCw, Monitor, Server, Cpu, HardDrive, Wifi, MapPin, Calendar, Shield } from 'lucide-react';
import api from '../services/api';
import { useClientRequestConfig } from '../context/ClientPreviewContext';

const labels = {
  manufacturer: 'Fabricante',
  model: 'Modelo',
  serial_number: 'Número de série',
  operating_system: 'Sistema operacional',
  operating_system_version: 'Versão do SO',
  firmware_version: 'Firmware',
  physical_or_virtual: 'Formato',
  location: 'Localização',
};

const AssetDetailDrawer = ({ asset, onClose }) => {
  const requestConfig = useClientRequestConfig();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const sourceType = asset?.hostname ? 'server' : 'network';

  useEffect(() => {
    if (!asset) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const endpoint = sourceType === 'server'
          ? `/client/metrics/servers/${asset.id}/details`
          : `/client/network/devices/${asset.id}/details`;
        const response = await api.get(endpoint, requestConfig);
        if (active) setDetail(response.data);
      } catch (err) {
        if (active) setError(err.response?.data?.error || 'Não foi possível carregar os detalhes.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [asset, sourceType, requestConfig]);

  if (!asset) return null;

  const telemetry = detail?.telemetry || {};
  const technicalFields = Object.entries(labels).filter(([key]) => detail?.[key]);
  const isServer = sourceType === 'server';

  const getStatusColor = (status) => {
    switch (status?.toLowerCase()) {
      case 'online': return { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'offline': return { bg: 'bg-red-50', text: 'text-red-700', border: 'border-red-200' };
      default: return { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' };
    }
  };

  const statusConfig = telemetry.status ? getStatusColor(telemetry.status) : getStatusColor('online');

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer */}
      <div className="relative h-full w-full max-w-md bg-white shadow-2xl overflow-y-auto animate-slide-in-right">
        {/* Header */}
        <div
          className="sticky top-0 z-10 p-6 border-b border-neutral-100"
          style={{ background: 'linear-gradient(180deg, #ffffff 0%, #fafaf9 100%)' }}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-neutral-400">
                  {detail?.asset_type || 'Ativo'}
                </span>
              </div>
              <h2 className="text-xl font-bold text-neutral-900 truncate">
                {detail?.display_name || asset?.hostname || asset?.device_name}
              </h2>
              <div className="flex flex-wrap gap-2 mt-3">
                {telemetry.status && (
                  <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusConfig.bg} ${statusConfig.text} border ${statusConfig.border}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${statusConfig.text.replace('text-', 'bg-')}`} />
                    {telemetry.status}
                  </span>
                )}
                {detail?.environment && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-100">
                    {detail.environment}
                  </span>
                )}
                {detail?.criticality && (
                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-100">
                    <Shield size={10} />
                    {detail.criticality}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
              aria-label="Fechar detalhes"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center gap-3 py-12 text-neutral-500">
              <RefreshCw className="animate-spin" size={20} />
              <span className="text-sm font-medium">Carregando ficha técnica...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-1.5 h-1.5 rounded-full bg-red-500" />
                <span className="font-semibold">Erro ao carregar</span>
              </div>
              {error}
            </div>
          ) : detail ? (
            <>
              {/* Business Purpose */}
              <section className="rounded-2xl border border-neutral-200/60 p-5 bg-gradient-to-br from-neutral-50/50 to-white">
                <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-3">
                  <MapPin size={16} className="text-emerald-600" />
                  Propósito no Negócio
                </h3>
                <p className="text-sm text-neutral-600 leading-relaxed">
                  {detail.notes_for_customer || detail.business_purpose || detail.technical_purpose || 'Informações técnicas ainda não cadastradas.'}
                </p>
              </section>

              {/* Telemetry - For Servers */}
              {isServer && (
                <section className="rounded-2xl border border-neutral-200/60 p-5">
                  <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-4">
                    <Activity size={16} className="text-blue-600" />
                    Métricas em Tempo Real
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div className="rounded-xl bg-blue-50/50 border border-blue-100 p-4 text-center">
                      <Cpu size={18} className="text-blue-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-blue-600">{telemetry.cpu_usage ?? 0}%</p>
                      <p className="text-[10px] font-medium text-blue-500 uppercase tracking-wide mt-1">CPU</p>
                    </div>
                    <div className="rounded-xl bg-purple-50/50 border border-purple-100 p-4 text-center">
                      <HardDrive size={18} className="text-purple-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-purple-600">{telemetry.memory_usage ?? 0}%</p>
                      <p className="text-[10px] font-medium text-purple-500 uppercase tracking-wide mt-1">MEM</p>
                    </div>
                    <div className="rounded-xl bg-emerald-50/50 border border-emerald-100 p-4 text-center">
                      <HardDrive size={18} className="text-emerald-600 mx-auto mb-2" />
                      <p className="text-2xl font-bold text-emerald-600">{telemetry.disk_usage ?? 0}%</p>
                      <p className="text-[10px] font-medium text-emerald-500 uppercase tracking-wide mt-1">DISCO</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Telemetry - For Network Devices */}
              {!isServer && (
                <section className="rounded-2xl border border-neutral-200/60 p-5">
                  <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-4">
                    <Wifi size={16} className="text-violet-600" />
                    Informações de Rede
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-neutral-50/50 border border-neutral-100 p-4">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-1">Status</p>
                      <p className="text-lg font-bold text-neutral-900">{telemetry.status || '-'}</p>
                    </div>
                    <div className="rounded-xl bg-neutral-50/50 border border-neutral-100 p-4">
                      <p className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-1">IP</p>
                      <p className="text-lg font-bold text-neutral-900 font-mono">{telemetry.ip_address || '-'}</p>
                    </div>
                  </div>
                </section>
              )}

              {/* Technical Specs */}
              <section className="rounded-2xl border border-neutral-200/60 p-5">
                <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-4">
                  <Monitor size={16} className="text-amber-600" />
                  Ficha Técnica
                </h3>
                {technicalFields.length > 0 ? (
                  <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {technicalFields.map(([key, label]) => (
                      <div key={key} className="bg-neutral-50/50 rounded-xl p-3">
                        <dt className="text-[10px] font-medium text-neutral-400 uppercase tracking-wide mb-1">{label}</dt>
                        <dd className="text-sm font-semibold text-neutral-900">{detail[key]}</dd>
                      </div>
                    ))}
                  </dl>
                ) : (
                  <p className="text-sm text-neutral-500 bg-neutral-50 rounded-xl p-4 text-center">
                    Informações técnicas ainda não cadastradas.
                  </p>
                )}
              </section>

              {/* Last Updates */}
              <section className="rounded-2xl border border-neutral-200/60 p-5">
                <h3 className="text-sm font-semibold text-neutral-700 flex items-center gap-2 mb-4">
                  <Calendar size={16} className="text-neutral-600" />
                  Histórico de Atualização
                </h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/50">
                    <span className="text-sm text-neutral-600">Sincronização automática</span>
                    <span className="text-sm font-semibold text-neutral-900">{formatDate(detail.last_synced_at)}</span>
                  </div>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-neutral-50/50">
                    <span className="text-sm text-neutral-600">Revisão manual</span>
                    <span className="text-sm font-semibold text-neutral-900">{formatDate(detail.last_reviewed_at)}</span>
                  </div>
                </div>
              </section>
            </>
          ) : null}
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from {
            transform: translateX(100%);
            opacity: 0;
          }
          to {
            transform: translateX(0);
            opacity: 1;
          }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';

export default AssetDetailDrawer;
