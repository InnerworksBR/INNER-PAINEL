import { createContext, useContext, useEffect, useState } from 'react';
import api from '../services/api';

const MarketingAccessContext = createContext({ access: 'checking' });

export function MarketingAccessProvider({ children }) {
  const [availability, setAvailability] = useState({ access: 'checking' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;

    api.get('/admin/marketing/access', { signal }).then(({ data }) => {
      if (signal.aborted) return;
      if (data?.allowed === true) {
        setAvailability({
          access: 'allowed',
          deliveryReady: data.deliveryReady === true,
          campaignReady: data.campaignReady === true,
        });
      } else {
        setAvailability({ access: data?.allowed === false ? 'denied' : 'error' });
      }
    }).catch(error => {
      if (!signal.aborted) {
        setAvailability({ access: [403, 404].includes(error.response?.status) ? 'denied' : 'error' });
      }
    });

    return () => controller.abort();
  }, [attempt]);

  function checkAgain() {
    setAvailability({ access: 'checking' });
    setAttempt(current => current + 1);
  }

  return (
    <MarketingAccessContext.Provider value={{ ...availability, checkAgain }}>
      {children}
    </MarketingAccessContext.Provider>
  );
}

export function useMarketingAccess() {
  return useContext(MarketingAccessContext);
}
