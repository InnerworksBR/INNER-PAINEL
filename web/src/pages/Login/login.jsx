import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Lock, Mail, ArrowRight } from 'lucide-react';

import bg1 from '../../assets/bg1.png';
import bg2 from '../../assets/bg2.png';
import bg3 from '../../assets/bg3.png';
import bg4 from '../../assets/bg4.png';

import logoInnerworks from '../../assets/logo_innerworks.png';
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
    const [showPassword, setShowPassword] = useState(false);

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

            {/* FUNDO ANIMADO */}
            <div className="absolute inset-0">
                {backgrounds.map((bg, i) => (
                    <img
                        key={i}
                        src={bg}
                        className={`absolute w-full h-full object-cover transition-opacity duration-[4000ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${i === index ? "opacity-100" : "opacity-0"
                            }`}
                    />
                ))}
                {/* Overlay escuro suave para melhor contraste */}
                <div className="absolute inset-0 bg-black/20" />
            </div>

            {/* CONTEÚDO PRINCIPAL */}
            <div className="relative z-10 flex flex-col lg:flex-row h-screen w-full overflow-hidden">

                {/* LADO ESQUERDO: BANNER */}
                <div className="hidden lg:flex flex-col justify-between h-full w-full lg:w-1/2 px-8 lg:px-12 py-8 lg:py-12">

                    {/* LOGO INNERWORKS */}
                    <div className="flex items-center gap-3 lg:gap-4 animate-fade-in">
                        <img
                            src={logoInnerworks}
                            className="h-16 lg:h-20 w-auto drop-shadow-2xl"
                            alt="Innerworks"
                        />
                    </div>

                    {/* TÍTULO BANNER */}
                    <div className="flex-1 flex flex-col justify-center max-w-xl animate-slide-up">
                        <h1 className="text-5xl xl:text-6xl font-bold text-white leading-[1.1] mb-6">
                            Gestão de TI
                            <span
                                style={{
                                    background: 'linear-gradient(135deg, #34d399 0%, #10b981 100%)',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                }}
                            > simplificada</span>
                        </h1>
                        <p className="text-xl text-white/80 mb-10 leading-relaxed">
                            Centralize o monitoramento, licenciamento e infraestrutura
                            da sua empresa em um único painel poderoso.
                        </p>
                    </div>

                    {/* CONTATOS */}
                    <div className="flex flex-col space-y-3 text-white/90 animate-fade-in">
                        <div className="flex items-center gap-3 text-base">
                            <img src={iconHome} className="w-5 h-5" alt="Site" />
                            <span>innerworks.com.br</span>
                        </div>
                        <div className="flex items-center gap-3 text-base">
                            <img src={iconEmail} className="w-5 h-5" alt="Email" />
                            <span>contato@innerworks.com.br</span>
                        </div>
                        <div className="flex items-center gap-3 text-base">
                            <img src={iconZap} className="w-5 h-5" alt="Telefone" />
                            <span>(13) 99119-8852</span>
                        </div>
                    </div>
                </div>

                {/* LADO DIREITO: FORMULÁRIO */}
                <div className="flex items-center justify-center w-full lg:w-1/2 h-full lg:pr-12 px-4 flex-1">

                    <div
                        className="p-6 lg:p-10 rounded-3xl shadow-2xl w-full max-w-[420px] lg:max-w-[450px] relative overflow-hidden"
                        style={{
                            background: 'rgba(255,255,255,0.10)',
                            backdropFilter: 'blur(20px)',
                            border: '1px solid rgba(255,255,255,0.18)'
                        }}
                    >
                        {/* Top glow accent */}
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-px"
                            style={{ background: 'linear-gradient(90deg, transparent, #10b981, transparent)' }}
                        />

                        {/* Mobile Logo */}
                        <div className="lg:hidden flex items-center justify-center gap-3 mb-6">
                            <img src={logoInnerworks} className="h-10 w-auto" alt="Innerworks" />
                        </div>

                        <div className="relative">
                            <div className="text-center mb-6">
                                <h2 className="text-2xl lg:text-3xl font-bold text-white mb-2">
                                    Bem-vindo de volta
                                </h2>
                                <p className="text-white/60 text-sm">
                                    Entre para acessar seu painel de gestão
                                </p>
                            </div>

                            {/* Error Message */}
                            {error && (
                                <div
                                    className="mb-4 p-3 rounded-xl text-sm text-red-200"
                                    style={{
                                        background: 'rgba(239,68,68,0.15)',
                                        border: '1px solid rgba(239,68,68,0.3)'
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                                        {error}
                                    </div>
                                </div>
                            )}

                            {/* Success Message */}
                            {location.state?.passwordChanged && (
                                <div
                                    className="mb-4 p-3 rounded-xl text-sm text-emerald-200"
                                    style={{
                                        background: 'rgba(16,185,129,0.15)',
                                        border: '1px solid rgba(16,185,129,0.3)'
                                    }}
                                >
                                    <div className="flex items-center gap-2">
                                        <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                                        Senha alterada. Entre novamente para continuar.
                                    </div>
                                </div>
                            )}

                            <form onSubmit={handleLogin} className="space-y-4">
                                {/* Email */}
                                <div>
                                    <label className="block text-white/70 text-sm font-medium mb-1.5">
                                        E-mail
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            required
                                            type="email"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            className="w-full pl-12 pr-4 py-3 rounded-xl text-white text-sm
                                                bg-white/[0.05] border border-white/[0.1]
                                                placeholder:text-white/25
                                                focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.08]
                                                transition-all duration-200"
                                            placeholder="seu@email.com"
                                        />
                                    </div>
                                </div>

                                {/* Password */}
                                <div>
                                    <label className="block text-white/70 text-sm font-medium mb-1.5">
                                        Senha
                                    </label>
                                    <div className="relative">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            required
                                            type={showPassword ? 'text' : 'password'}
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            className="w-full pl-12 pr-12 py-3 rounded-xl text-white text-sm
                                                bg-white/[0.05] border border-white/[0.1]
                                                placeholder:text-white/25
                                                focus:outline-none focus:border-emerald-500/50 focus:bg-white/[0.08]
                                                transition-all duration-200"
                                            placeholder="••••••••"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((v) => !v)}
                                            aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                                            className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                                        >
                                            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                </div>

                                {/* Forgot Password */}
                                <div className="flex justify-end">
                                    <Link
                                        to="/recuperar-senha"
                                        className="text-sm text-emerald-400/70 hover:text-emerald-400 transition-colors"
                                    >
                                        Esqueceu sua senha?
                                    </Link>
                                </div>

                                {/* Submit */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full relative group overflow-hidden rounded-xl
                                        py-3.5 px-6 font-semibold text-sm
                                        transition-all duration-300
                                        disabled:opacity-50 disabled:cursor-not-allowed"
                                    style={{
                                        background: loading
                                            ? 'rgba(16,185,129,0.5)'
                                            : 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        boxShadow: '0 4px 20px rgba(16,185,129,0.3)'
                                    }}
                                >
                                    <span className="relative z-10 flex items-center justify-center gap-2">
                                        {loading ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                <span>Entrando...</span>
                                            </>
                                        ) : (
                                            <>
                                                <span>Entrar no Painel</span>
                                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </span>
                                </button>
                            </form>
                        </div>
                    </div>
                </div>
            </div>

            {/* Footer mobile */}
            <div className="absolute bottom-4 left-0 right-0 text-center lg:hidden z-10">
                <p className="text-white/40 text-xs">© 2024 Innerworks. Todos os direitos reservados.</p>
            </div>
        </div>
    );
};

export default Login;