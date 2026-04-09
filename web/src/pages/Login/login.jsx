import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import banner from '../../assets/banner.png';
import { useAuth } from '../../context/AuthContext';

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email.trim(), password.trim());

        if (result.success) {
            // Recuperar o usuário recém-logado para decidir o redirecionamento
            const storedUser = JSON.parse(localStorage.getItem('user'));
            if (storedUser?.role === 'admin') {
                navigate('/admin/dashAdmin');
            } else {
                navigate('/app/dashboard');
            }
        } else {
            setError(result.error);
        }
        setLoading(false);
    };

    return (
        <div
            className="flex items-center justify-center min-h-screen bg-cover bg-center bg-no-repeat"
            style={{ backgroundImage: `url(${banner})` }}
        >
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 rounded-2xl shadow-2xl w-full max-w-md">
                <div className="text-center mb-8">
                    <h2 className="text-3xl font-bold text-white mb-2">Bem-vindo</h2>
                    <p className="text-white/80">Faça login para acessar o Portal de Contratos</p>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                        {error}
                    </div>
                )}

                <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-white text-sm font-medium mb-1.5" htmlFor="email">
                            E-mail
                        </label>
                        <input
                            id="email"
                            required
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            placeholder="Digite seu e-mail"
                        />
                    </div>

                    <div>
                        <label className="block text-white text-sm font-medium mb-1.5" htmlFor="password">
                            Senha
                        </label>
                        <input
                            id="password"
                            required
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            placeholder="Digite sua senha"
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                        {loading ? 'Carregando...' : 'Entrar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
