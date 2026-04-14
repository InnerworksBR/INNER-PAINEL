import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import bg1 from '../../assets/bg1.png';
import bg2 from '../../assets/bg2.png';
import bg3 from '../../assets/bg3.png';
import bg4 from '../../assets/bg4.png';

import logoMicrosoft from '../../assets/logo_microsoft.png';
import logoInner from '../../assets/logo_inner.png';
import iconHome from '../../assets/icon_home.png';
import iconEmail from '../../assets/icon_contato.png';
import iconZap from '../../assets/icon_zap.png';

import { useAuth } from '../../context/AuthContext';

const backgrounds = [bg1, bg2, bg3, bg4];

const Login = () => {
    const navigate = useNavigate();
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [index, setIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setIndex((prev) => (prev + 1) % backgrounds.length);
        }, 4000);

        return () => clearInterval(interval);
    }, []);

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        const result = await login(email.trim(), password.trim());

        if (result.success) {
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
        <div className="relative min-h-screen overflow-hidden bg-black">

            {/* FUNDO CORES ANIMADOS */}
            <div className="absolute inset-0">
                {backgrounds.map((bg, i) => (
                    <img
                        key={i}
                        src={bg}
                        className={`absolute w-full h-full object-cover transition-opacity duration-[4000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${i === index ? "opacity-100" : "opacity-0"
                            }`}
                    />
                ))}
            </div>

            {/*CONTEÚDO */}
            <div className="relative flex items-center justify-end pr-[10vw] min-h-screen overflow-auto">

                {/* BANNER ESQUERDA IGUAL FIGMA REAL */}
                <div className="absolute inset-0 pointer-events-none z-0">

                    {/* LOGO MICROSOFT NO TOPO */}
                    <img src={logoMicrosoft} className="absolute left-[10px] top-[0px] w-[480px]" />


                    {/* LOGO INNER */}
                    <img src={logoInner} className="absolute left-[90px] top-[210px] w-[350px]" />
                    {/* SUBTÍTULO INNER*/}
                    <h2 className="absolute left-[170px] top-[350px] text-white text-[24px] font-medium">
                        Let's <span className='italic font-semibold text-[#55F525]'> work </span> together
                    </h2>

                    {/* TITULO BANNER */}
                    <div className="absolute left-[30px] top-[460px] text-white w-[900px]">
                        <h1 className="text-[70px] font-bold leading-tight">
                            Transformando Tecnologia <br /> em resultados<span className="italic font-bold"> reais </span>
                        </h1>
                    </div>

                    {/* CONTATOS FIXOS NO RODAPÉ */}
                    <div className="absolute left-[30px] bottom-[40px] space-y-4 text-[30px] text-gray-300 pointer-events-auto">

                        <div className="flex items-center gap-4">
                            <img src={iconHome} className="w-[40px]" />
                            <span>innerworks.com.br</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <img src={iconEmail} className="w-[40px]" />
                            <span>contato@innerworks.com.br</span>
                        </div>

                        <div className="flex items-center gap-4">
                            <img src={iconZap} className="w-[40px]" />
                            <span>(13) 99119-8852</span>
                        </div>
                    </div>
                </div>

                {/* Portal de Contratos */}
                <div className="bg-white/10 backdrop-blur-md border border-white/20 p-16 rounded-3xl shadow-2xl w-full max-w-2xl">

                    <div className="text-center mb-12">
                        <h2 className="text-5xl font-bold text-white mb-3">Bem-vindo</h2>
                        <p className="text-white/80 text-lg">
                            Faça login para acessar o Portal de Contratos
                        </p>
                    </div>

                    {error && (
                        <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-sm text-center">
                            {error}
                        </div>
                    )}

                    <form className="space-y-6" onSubmit={handleLogin}>
                        <div>
                            <label className="block text-white text-lg font-medium mb-2">
                                E-mail
                            </label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg"
                                placeholder="Digite seu e-mail"
                            />
                        </div>

                        <div>
                            <label className="block text-white text-lg font-medium mb-2">
                                Senha
                            </label>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-5 py-4 bg-white/10 border border-white/20 rounded-xl text-white text-lg"
                                placeholder="Digite sua senha"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full mt-8 py-4 bg-blue-600 hover:bg-blue-500 text-white text-xl font-semibold rounded-xl transition ${loading ? 'opacity-50 cursor-not-allowed' : ''
                                }`}
                        >
                            {loading ? 'Carregando...' : 'Entrar'}
                        </button>
                    </form>

                </div>

            </div>
        </div>
    );
};

export default Login;