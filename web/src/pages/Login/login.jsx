import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

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
    const location = useLocation();
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

            {/* CONTEÚDO PRINCIPAL ESTÁTICO (h-screen e overflow-hidden) */}
            <div className="relative z-10 flex flex-col lg:flex-row h-screen w-full overflow-hidden">

                {/* 🔵 LADO ESQUERDO: BANNER E LOGOS */}
                <div className="hidden lg:flex flex-col justify-between h-full w-full lg:w-1/2 px-8 lg:px-[5vw] py-8 lg:py-12 flex-1">
                
                {/*LOGO MICROSOFT*/}
                <div className="flex items-center gap-3 lg:gap-4">
                    <img src={logoMicrosoft} className="absolute top-[-70px] left-[-40px] w-[450px]"/>
                </div>

                {/*LOGO INNER*/}
                <div className="flex items-center gap-3 lg:gap-4">
                <img src={logoInner}className="absolute top-[145px] left-[40px] w-[250px]" />
                </div>
                {/* SUBTÍTULO INNER*/}
                    <h2 className="absolute left-[90px] top-[235px] text-white text-[20px] font-medium">
                        Let's <span className='italic font-semibold text-[#55F525]'> work </span> together
                    </h2>


                {/* TITULO BANNER */}
                    <div className="absolute left-[2%] top-1/2 -translate-y-1/2 text-white max-w-[900px] w-full">
                        <h1 className="text-[60px] font-bold leading-tight">
                            Transformando Tecnologia <br /> em resultados<span className="italic font-bold"> reais </span>
                        </h1>
                    </div>


                   
                {/* CONTATOS */}
                    <div className="absolute bottom-[40px] left-[20px] flex flex-col space-y-4 text-gray-300  text-lg lg:text-xl 2xl:text-2xl">
                        <div className="flex items-center gap-3 lg:gap-4">
                            <img src={iconHome} className="w-[20px] lg:w-[30px] 2xl:w-[40px]" alt="Ícone Site" />
                            <span>innerworks.com.br</span>
                        </div>
                        <div className="flex items-center gap-3 lg:gap-4">
                            <img src={iconEmail} className="w-[20px] lg:w-[30px] 2xl:w-[40px]" alt="Ícone Email" />
                            <span>contato@innerworks.com.br</span>
                        </div>
                        <div className="flex items-center gap-3 lg:gap-4">
                            <img src={iconZap} className="w-[20px] lg:w-[30px] 2xl:w-[40px]" alt="Ícone Telefone" />
                            <span>(13) 99119-8852</span>
                        </div>
                    </div>
                </div>

                {/* 🟢 LADO DIREITO: FORMULÁRIO DE LOGIN */}
                <div className="flex items-center justify-center w-full lg:w-1/2 h-full lg:pr-[5vw] px-4 flex-1">

                    {/* Portal de Contratos */}
                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-6 lg:p-10 2xl:p-16 rounded-3xl shadow-2xl w-full max-w-[380px] lg:max-w-[450px] 2xl:max-w-2xl">

                        <div className="text-center mb-6 2xl:mb-12">
                            <h2 className="text-3xl lg:text-4xl 2xl:text-5xl font-bold text-white mb-2 2xl:mb-3">Bem-vindo</h2>
                            <p className="text-white/80 text-xs lg:text-sm 2xl:text-lg">
                                Faça login para acessar o Portal de Contratos
                            </p>
                        </div>

                        {error && (
                            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs 2xl:text-sm text-center">
                                {error}
                            </div>
                        )}

                        {location.state?.passwordChanged && (
                            <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-400/50 rounded-lg text-emerald-100 text-xs 2xl:text-sm text-center">
                                Senha alterada. Entre novamente para continuar.
                            </div>
                        )}

                        <form className="space-y-4 2xl:space-y-6" onSubmit={handleLogin}>
                            <div>
                                <label className="block text-white text-xs lg:text-sm 2xl:text-lg font-medium mb-1 2xl:mb-2">
                                    E-mail
                                </label>
                                <input
                                    required
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="w-full px-3 py-2 2xl:px-5 2xl:py-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm 2xl:text-lg"
                                    placeholder="Digite seu e-mail"
                                />
                            </div>

                            <div>
                                <label className="block text-white text-xs lg:text-sm 2xl:text-lg font-medium mb-1 2xl:mb-2">
                                    Senha
                                </label>
                                <input
                                    required
                                    type="password"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="w-full px-3 py-2 2xl:px-5 2xl:py-4 bg-white/10 border border-white/20 rounded-xl text-white text-sm 2xl:text-lg"
                                    placeholder="Digite sua senha"
                                />
                            </div>

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full mt-4 2xl:mt-8 py-3 2xl:py-4 bg-blue-600 hover:bg-blue-500 text-white text-sm lg:text-base 2xl:text-xl font-semibold rounded-xl transition ${loading ? 'opacity-50 cursor-not-allowed' : ''
                                    }`}
                            >
                                {loading ? 'Carregando...' : 'Entrar'}
                            </button>
                        </form>

                    </div>

                </div>
            </div>
        </div>
    );
};

export default Login;
