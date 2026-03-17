import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import banner from '../../assets/banner.png';

const Login = () => {
    const navigate = useNavigate();
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = (e) => {
        e.preventDefault();

        // Trim para evitar espaços em branco acidentais
        const fixedEmail = email.trim();
        const fixedPassword = password.trim();

        if (fixedEmail === 'suporte@innerworks.com.br' && fixedPassword === 'Inner#@$2026') {
            navigate('/admin/dashAdmin');
        } else {
            navigate('/app/dashboard');

        }
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

                <form className="space-y-5" onSubmit={handleLogin}>
                    <div>
                        <label className="block text-white text-sm font-medium mb-1.5" htmlFor="email">
                            E-mail
                        </label>
                        <input
                            id="email"
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
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/10 border border-white/20 rounded-lg text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent transition-all"
                            placeholder="Digite sua senha"
                        />
                    </div>

                    <div className="flex items-center justify-between pt-1">
                        <label className="flex items-center text-white/90 text-sm cursor-pointer hover:text-white transition-colors">
                            <input type="checkbox" className="mr-2 rounded bg-white/10 border-white/20 text-blue-500 focus:ring-blue-400" />
                            Lembrar-me
                        </label>
                        <a href="#" className="text-sm text-blue-300 hover:text-blue-100 transition-colors">
                            Esqueci a senha
                        </a>
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg shadow-lg hover:shadow-blue-500/30 transition-all duration-300 transform hover:-translate-y-0.5"
                    >
                        Entrar
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
