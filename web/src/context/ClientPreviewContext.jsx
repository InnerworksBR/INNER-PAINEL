import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../services/api';

const ClientPreviewContext = createContext(null);

export const ClientPreviewProvider = ({ children }) => {
  const { companyId } = useParams();
  const [company, setCompany] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadCompany = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get(`/admin/companies/${companyId}`);
        if (active) setCompany(response.data);
      } catch (err) {
        if (active) setError(err.response?.status === 404 ? 'Empresa não encontrada' : 'Não foi possível carregar a empresa');
      } finally {
        if (active) setLoading(false);
      }
    };
    loadCompany();
    return () => { active = false; };
  }, [companyId]);

  const value = useMemo(() => ({
    companyId,
    company,
    loading,
    error,
    isPreview: true,
    basePath: `/admin/empresas/${companyId}/preview`,
  }), [companyId, company, loading, error]);

  return <ClientPreviewContext.Provider value={value}>{children}</ClientPreviewContext.Provider>;
};

export const useClientPreview = () => useContext(ClientPreviewContext);

export const useClientPortalPath = () => {
  const preview = useClientPreview();
  const basePath = preview?.basePath || '/app';
  return (segment = '') => `${basePath}${segment ? `/${segment}` : ''}`;
};

export const useClientRequestConfig = () => {
  const preview = useClientPreview();
  return useMemo(
    () => preview?.companyId
      ? { params: { company_id: preview.companyId } }
      : {},
    [preview]
  );
};
