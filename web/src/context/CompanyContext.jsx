<<<<<<< HEAD
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';
=======
import React, { createContext, useContext, useState, useEffect } from 'react';
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
<<<<<<< HEAD
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
=======
    // Inicializa com dados fictícios ou do localStorage
    const [companies, setCompanies] = useState(() => {
        const saved = localStorage.getItem('admin_companies');
        return saved ? JSON.parse(saved) : [
            { id: 1, name: 'ABRAHY', cnpj: '12.345.678/0001-90', sector: 'TI', status: 'Ativo' },
            { id: 2, name: 'SUSTENTS', cnpj: '98.765.432/0001-10', sector: 'TI', status: 'Ativo' },
            { id: 3, name: 'ROCHA', cnpj: '45.678.901/0001-22', sector: 'TI', status: 'Inativo' },
            { id: 4, name: 'CARPOLOG', cnpj: '45.678.901/0001-22', sector: 'TI', status: 'Inativo' }
        ];
    });

    // Persiste no localStorage sempre que mudar
    useEffect(() => {
        localStorage.setItem('admin_companies', JSON.stringify(companies));
    }, [companies]);

    const addCompany = (company) => {
        const newId = companies.length > 0 ? Math.max(...companies.map(c => c.id)) + 1 : 1;
        setCompanies([...companies, { ...company, id: newId }]);
    };

    const updateCompany = (updatedCompany) => {
        setCompanies(companies.map(c => c.id === updatedCompany.id ? updatedCompany : c));
    };

    const deleteCompany = (id) => {
        setCompanies(companies.filter(c => c.id !== id));
    };

    return (
        <CompanyContext.Provider value={{ companies, addCompany, updateCompany, deleteCompany }}>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
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
