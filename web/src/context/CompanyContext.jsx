import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
    const [companies, setCompanies] = useState([]);
    const [loading, setLoading] = useState(false);

    const fetchCompanies = useCallback(async () => {
        setLoading(true);
        try {
            const response = await api.get('/admin/companies');
            // API agora retorna { data, total } para paginação
            const companiesData = response.data?.data || response.data;
            setCompanies(Array.isArray(companiesData) ? companiesData : []);
        } catch (error) {
            console.error('Error fetching companies:', error);
            setCompanies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Apenas buscar quando o provider é montado (dentro do AdminLayout)
    useEffect(() => {
        const token = localStorage.getItem('token');
        if (token) {
            fetchCompanies();
        }
    }, [fetchCompanies]);

    const addCompany = async (company) => {
        try {
            const response = await api.post('/admin/companies', company);
            setCompanies(prev => [...prev, response.data]);
            return { success: true };
        } catch (error) {
            console.error('Error adding company:', error);
            return { success: false, error: error.response?.data?.error || error.message };
        }
    };

    const updateCompany = async (updatedCompany) => {
        try {
            const { id, ...data } = updatedCompany;
            const response = await api.put(`/admin/companies/${id}`, data);
            setCompanies(prev => prev.map(c => c.id === id ? response.data : c));
            return { success: true };
        } catch (error) {
            console.error('Error updating company:', error);
            return { success: false, error: error.response?.data?.error || error.message };
        }
    };

    const deleteCompany = async (id) => {
        try {
            await api.delete(`/admin/companies/${id}`);
            setCompanies(prev => prev.filter(c => c.id !== id));
            return { success: true };
        } catch (error) {
            console.error('Error deleting company:', error);
            return { success: false, error: error.response?.data?.error || error.message };
        }
    };

    const updateIntegrations = async (companyId, integrationsData) => {
        try {
            const response = await api.post(`/admin/companies/${companyId}/integrations`, integrationsData);
            setCompanies(prev => prev.map(c => {
                if (c.id === companyId) {
                    return { ...c, company_integrations: response.data };
                }
                return c;
            }));
            return { success: true };
        } catch (error) {
            console.error('Error updating company integrations:', error);
            return { success: false, error: error.response?.data?.error || error.message };
        }
    };

    return (
        <CompanyContext.Provider value={{
            companies,
            loading,
            addCompany,
            updateCompany,
            deleteCompany,
            updateIntegrations,
            refreshCompanies: fetchCompanies
        }}>
            {children}
        </CompanyContext.Provider>
    );
};

export const useCompanies = () => {
    const context = useContext(CompanyContext);
    if (!context) {
        throw new Error('useCompanies deve ser usado dentro de um CompanyProvider');
    }
    return context;
};
