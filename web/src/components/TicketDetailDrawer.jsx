import React, { useState, useEffect } from 'react';
import { X, Clock, User, Calendar as CalendarIcon, Tag, Loader2, MessageSquare, AlertCircle } from 'lucide-react';
import api from '../services/api';
import { useClientRequestConfig } from '../context/ClientPreviewContext';

const TicketDetailDrawer = ({ isOpen, onClose, ticketId }) => {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const requestConfig = useClientRequestConfig();

  useEffect(() => {
    if (isOpen && ticketId) {
      fetchDetails();
    } else {
      setData(null);
      setError(null);
    }
  }, [isOpen, ticketId]);

  const fetchDetails = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get(`/client/glpi/tickets/${ticketId}`, requestConfig);
      setData(res.data);
    } catch (err) {
      console.error(err);
      setError('Não foi possível carregar os detalhes do chamado.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 transition-opacity" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 w-full max-w-2xl bg-white shadow-2xl z-50 transform transition-transform flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-100">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chamado #{ticketId}</h2>
            {data?.ticket?.name && <p className="text-sm text-slate-500 mt-1">{data.ticket.name}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-500">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Carregando histórico do chamado...</p>
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center h-full text-red-500">
              <AlertCircle className="w-8 h-8 mb-4" />
              <p>{error}</p>
            </div>
          ) : data ? (
            <div className="space-y-6">
              {/* Infos básicas */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 grid grid-cols-2 gap-4 text-sm shadow-sm">
                <div className="flex items-center gap-2 text-slate-600">
                  <User size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-800">Requerente:</span> {data.ticket.users_id_recipient_name || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Tag size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-800">Categoria:</span> {data.ticket.itilcategories_id_name || 'N/A'}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <CalendarIcon size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-800">Abertura:</span> {new Date(data.ticket.date || data.ticket.date_creation).toLocaleString('pt-BR')}
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <Clock size={16} className="text-slate-400" />
                  <span className="font-medium text-slate-800">SLA Estado:</span> {data.ticket.sla_ttr_state === 1 ? 'Fora do SLA' : 'Dentro do SLA'}
                </div>
              </div>

              {/* Descrição Original */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                <h3 className="text-sm font-bold text-slate-800 mb-3 flex items-center gap-2">
                  <MessageSquare size={16} className="text-blue-500" />
                  Descrição Inicial
                </h3>
                <div 
                  className="prose prose-sm max-w-none text-slate-600 bg-slate-50 p-4 rounded-lg border border-slate-100"
                  dangerouslySetInnerHTML={{ __html: data.ticket.content }}
                />
              </div>

              {/* Timeline */}
              {data.timeline && data.timeline.length > 0 && (
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
                  <h3 className="text-sm font-bold text-slate-800 mb-6">Histórico de Acompanhamentos</h3>
                  <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                    {data.timeline.map((item, idx) => (
                      <div key={idx} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group is-active">
                        <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-white bg-slate-100 text-slate-500 shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">
                          <MessageSquare size={16} />
                        </div>
                        <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-4 rounded-xl border border-slate-100 shadow-sm">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-bold text-slate-800 text-sm">{item.author}</span>
                            <span className="text-xs text-slate-400 font-medium">{new Date(item.date).toLocaleString('pt-BR')}</span>
                          </div>
                          <div 
                            className="text-slate-600 text-sm prose prose-sm max-w-none"
                            dangerouslySetInnerHTML={{ __html: item.content }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
};

export default TicketDetailDrawer;
