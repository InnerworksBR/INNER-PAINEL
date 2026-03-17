import React, { createContext, useContext, useState, useEffect } from 'react';

const CompanyContext = createContext();

export const CompanyProvider = ({ children }) => {
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
