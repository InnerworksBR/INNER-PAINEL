import { useEffect, useMemo, useRef, useState } from 'react';
import api from '../../../services/api';

export const MARKETING_PATH = '/admin/marketing';
export const SAO_PAULO = 'America/Sao_Paulo';

export const contactStatuses = {
  not_subscribed: 'Não inscrito',
  pending: 'Pendente',
  subscribed: 'Inscrito',
  unsubscribed: 'Descadastrado',
  suppressed: 'Bloqueado',
};

export const campaignStatuses = {
  draft: 'Rascunho',
  scheduled: 'Agendada',
  sending: 'Em envio',
  paused: 'Pausada',
  completed: 'Concluída',
};

const displayDate = new Intl.DateTimeFormat('pt-BR', {
  timeZone: SAO_PAULO, dateStyle: 'short', timeStyle: 'short',
});
const localDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: SAO_PAULO, year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
});

export function formatMarketingDate(timestamp) {
  return timestamp ? displayDate.format(new Date(timestamp)) : '—';
}

function saoPauloWallTime(timestamp) {
  const parts = Object.fromEntries(localDate.formatToParts(timestamp).map(({ type, value }) => [type, value]));
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function toSaoPauloTimestamp(value) {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const wallTimeAsUtc = Date.parse(value + 'Z');
  if (!Number.isFinite(wallTimeAsUtc)) return null;

  const wallTimeAtCandidate = Date.parse(saoPauloWallTime(wallTimeAsUtc) + 'Z');
  const timestamp = wallTimeAsUtc + (wallTimeAsUtc - wallTimeAtCandidate);
  return saoPauloWallTime(timestamp) === value ? new Date(timestamp).toISOString() : null;
}

function errorMessage(error, fallback) {
  const message = error.response?.data?.error;
  return typeof message === 'string' && message.trim() ? message : fallback;
}

export function useMarketingQuery(path, fallback, params) {
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState(null);
  const request = useMemo(() => ({ path, params, attempt }), [path, params, attempt]);
  const current = result?.request === request ? result : null;

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    api.get(MARKETING_PATH + request.path, { signal, params: request.params }).then(({ data }) => {
      if (!signal.aborted) setResult({ request, data });
    }).catch(error => {
      if (!signal.aborted) setResult({ request, error: errorMessage(error, fallback) });
    });
    return () => controller.abort();
  }, [request, fallback]);

  return {
    data: current?.data,
    error: current?.error,
    loading: current === null,
    reload() {
      setAttempt(value => value + 1);
    },
    replace(collection, item) {
      setResult(previous => {
        if (!previous?.data || previous.request !== request) return previous;
        const items = previous.data[collection];
        const existing = items.find(candidate => candidate.id === item.id);
        if (existing && existing.version > item.version) return previous;
        const updated = existing
          ? items.map(candidate => candidate.id === item.id ? item : candidate)
          : [item, ...items];
        return { ...previous, data: { ...previous.data, [collection]: updated } };
      });
    },
  };
}

const emptyAction = { pending: false, error: '', notice: '', conflict: false };

export function useMarketingAction() {
  const active = useRef(false);
  const [state, setState] = useState(emptyAction);

  async function run(operation, fallback) {
    if (active.current || state.conflict) return;
    active.current = true;
    setState({ ...emptyAction, pending: true });
    try {
      const notice = await operation();
      setState({ ...emptyAction, notice });
    } catch (error) {
      const conflict = error.response?.status === 409;
      setState({
        ...emptyAction,
        conflict,
        error: conflict
          ? 'Os dados mudaram. Recarregue e confira os dados atualizados antes de continuar.'
          : errorMessage(error, fallback),
      });
    } finally {
      active.current = false;
    }
  }

  return { ...state, run, clear: () => setState(emptyAction) };
}
