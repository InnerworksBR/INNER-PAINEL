import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const ArtigosAccessContext = createContext({ access: 'checking' });

export function ArtigosAccessProvider({ children }) {
  const [access, setAccess] = useState('checking');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    api.get('/admin/artigos/access', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      if (data?.allowed === true) setAccess('allowed');
      else if (data?.allowed === false) setAccess('denied');
      else setAccess('error');
    }).catch(error => {
      if (!signal.aborted) setAccess(error.response?.status === 403 ? 'denied' : 'error');
    });

    return () => controller.abort();
  }, [attempt]);

  function checkAgain() {
    setAccess('checking');
    setAttempt(current => current + 1);
  }

  return (
    <ArtigosAccessContext.Provider value={{ access, checkAgain }}>
      {children}
    </ArtigosAccessContext.Provider>
  );
}

export function useArtigosAccess() {
  return useContext(ArtigosAccessContext);
}
