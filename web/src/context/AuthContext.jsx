import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Validar token ao montar
    useEffect(() => {
        const validateSession = async () => {
            const storedUser = localStorage.getItem('user');
            const token = localStorage.getItem('token');

            if (storedUser && token) {
                try {
                    // Testar se o token ainda é válido fazendo um request leve
                    await api.get('/auth/validate');
                    setUser(JSON.parse(storedUser));
                } catch (error) {
                    // Token expirado ou inválido
                    console.warn('Sessão expirada, fazendo logout');
                    localStorage.removeItem('token');
                    localStorage.removeItem('user');
                    setUser(null);
                }
            }
            setLoading(false);
        };

        validateSession();
    }, []);

    const login = async (email, password) => {
        try {
            const response = await api.post('/auth/login', { email, password });
            const { token, profile } = response.data;

            localStorage.setItem('token', token);
            localStorage.setItem('user', JSON.stringify(profile));
            setUser(profile);
            return { success: true };
        } catch (error) {
            console.error('Login error:', error.response?.data || error.message);
            return {
                success: false,
                error: error.response?.data?.error || 'Erro ao realizar login',
            };
        }
    };

    const logout = useCallback(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        // Navigate to login is handled by ProtectedRoute
    }, []);

    const value = {
        user,
        loading,
        login,
        logout,
        isAdmin: user?.role === 'admin',
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth deve ser usado dentro de um AuthProvider');
    }
    return context;
};
