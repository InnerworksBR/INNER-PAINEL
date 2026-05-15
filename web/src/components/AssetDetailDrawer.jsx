import React, { useEffect, useState } from 'react';
import { X, RefreshCw } from 'lucide-react';
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

const AssetDetailDrawer = ({ open, asset, sourceType, onClose }) => {
  const requestConfig = useClientRequestConfig();
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open || !asset) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError('');
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
  }, [open, asset, sourceType, requestConfig]);

  if (!open) return null;

  const telemetry = detail?.telemetry || {};
  const technicalFields = Object.entries(labels).filter(([key]) => detail?.[key]);
  const isServer = sourceType === 'server';

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/30 backdrop-blur-sm">
      <div className="h-full w-full max-w-xl bg-white shadow-2xl overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-slate-200 p-5 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-400">{detail?.asset_type || 'Ativo'}</p>
            <h2 className="text-2xl font-bold text-slate-900">{detail?.display_name || asset?.hostname || asset?.device_name}</h2>
            <div className="mt-2 flex flex-wrap gap-2 text-xs">
              {telemetry.status && <span className="rounded-full bg-slate-100 px-2 py-1">{telemetry.status}</span>}
              {detail?.environment && <span className="rounded-full bg-blue-50 text-blue-700 px-2 py-1">{detail.environment}</span>}
              {detail?.criticality && <span className="rounded-full bg-amber-50 text-amber-700 px-2 py-1">{detail.criticality}</span>}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-full hover:bg-slate-100" aria-label="Fechar detalhes">
            <X size={20} />
          </button>
        </div>

        {loading ? (
          <div className="p-8 flex items-center gap-3 text-slate-500">
            <RefreshCw className="animate-spin" size={18} />
            Carregando ficha técnica...
          </div>
        ) : error ? (
          <div className="p-6 text-red-700 bg-red-50 m-5 rounded-xl">{error}</div>
        ) : detail ? (
          <div className="p-5 space-y-5">
            <section className="rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">Para que serve</h3>
              <p className="mt-3 text-sm text-slate-600">
                {detail.notes_for_customer || detail.business_purpose || detail.technical_purpose || 'Informações técnicas ainda não cadastradas.'}
              </p>
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">Ficha técnica</h3>
              {technicalFields.length > 0 ? (
                <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {technicalFields.map(([key, label]) => (
                    <div key={key}>
                      <dt className="text-xs uppercase tracking-wide text-slate-400">{label}</dt>
                      <dd className="mt-1 text-sm font-medium text-slate-800">{detail[key]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <p className="mt-3 text-sm text-slate-500">Informações técnicas ainda não cadastradas.</p>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 p-5">
              <h3 className="font-semibold text-slate-900">Telemetria atual</h3>
              {isServer ? (
                <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
                  <Metric label="CPU" value={`${telemetry.cpu_usage ?? 0}%`} />
                  <Metric label="Memória" value={`${telemetry.memory_usage ?? 0}%`} />
                  <Metric label="Disco" value={`${telemetry.disk_usage ?? 0}%`} />
                </div>
              ) : (
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <Metric label="Status" value={telemetry.status || '-'} />
                  <Metric label="IP" value={telemetry.ip_address || '-'} />
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 p-5 text-sm text-slate-600">
              <h3 className="font-semibold text-slate-900 mb-3">Última atualização</h3>
              <p>Sincronização automática: {formatDate(detail.last_synced_at)}</p>
              <p>Revisão manual: {formatDate(detail.last_reviewed_at)}</p>
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
    <p className="mt-1 font-semibold text-slate-900">{value}</p>
  </div>
);

const formatDate = (value) => value ? new Date(value).toLocaleString('pt-BR') : 'Ainda não registrado';

export default AssetDetailDrawer;
