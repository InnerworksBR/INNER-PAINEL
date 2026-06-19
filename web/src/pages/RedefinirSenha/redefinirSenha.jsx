import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, LoaderCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';

const RedefinirSenha = () => {
    const navigate = useNavigate();

    // Estados de fluxo
    const [status, setStatus] = useState('aguardando'); // 'aguardando' | 'formulario' | 'link_invalido' | 'sucesso'
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // Campos de senha
    const [novaSenha, setNovaSenha] = useState('');
    const [confirmarSenha, setConfirmarSenha] = useState('');
    const [showNovaSenha, setShowNovaSenha] = useState(false);
    const [showConfirmarSenha, setShowConfirmarSenha] = useState(false);

    useEffect(() => {
        // Aguarda o evento PASSWORD_RECOVERY do Supabase (enviado quando o
        // usuário clica no link do e-mail e é redirecionado para esta página).
        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'PASSWORD_RECOVERY') {
                setStatus('formulario');
            } else if (event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
                // ignora outros eventos para não interferir
            }
        });

        // Timeout de segurança: se após 10 s o evento não chegar, o link é inválido/expirado
        const timer = setTimeout(() => {
            setStatus((current) => {
                if (current === 'aguardando') return 'link_invalido';
                return current;
            });
        }, 10000);

        return () => {
            subscription.unsubscribe();
            clearTimeout(timer);
        };
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        if (novaSenha.length < 8) {
            setError('A nova senha precisa ter pelo menos 8 caracteres.');
            return;
        }

        if (novaSenha !== confirmarSenha) {
            setError('As senhas não conferem.');
            return;
        }

        setLoading(true);

        try {
            const { error: updateError } = await supabase.auth.updateUser({ password: novaSenha });

            if (updateError) {
                setError(updateError.message || 'Erro ao redefinir a senha. Tente novamente.');
                return;
            }

            await supabase.auth.signOut();
            navigate('/', { state: { passwordChanged: true } });
        } catch {
            setError('Erro inesperado. Tente novamente.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-black flex items-center justify-center px-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 lg:p-12 rounded-3xl shadow-2xl w-full max-w-[420px]">

                {/* AGUARDANDO */}
                {status === 'aguardando' && (
                    <div className="flex flex-col items-center gap-4 py-6 text-white">
                        <LoaderCircle size={36} className="animate-spin text-white/70" />
                        <p className="text-sm text-white/70">Verificando link de redefinição...</p>
                    </div>
                )}

                {/* LINK INVÁLIDO */}
                {status === 'link_invalido' && (
                    <div className="space-y-6 text-center">
                        <div className="p-4 bg-red-500/20 border border-red-400/50 rounded-xl text-red-200 text-sm leading-relaxed">
                            Este link de redefinição é inválido ou expirou.
                        </div>
                        <Link
                            to="/recuperar-senha"
                            className="block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition text-center"
                        >
                            Solicitar novo link
                        </Link>
                        <Link
                            to="/"
                            className="block text-xs text-white/60 hover:text-white/90 underline"
                        >
                            Voltar ao login
                        </Link>
                    </div>
                )}

                {/* FORMULÁRIO */}
                {status === 'formulario' && (
                    <>
                        <div className="text-center mb-6">
                            <h2 className="text-3xl font-bold text-white mb-2">Redefinir senha</h2>
                            <p className="text-white/70 text-sm">
                                Crie uma nova senha com pelo menos 8 caracteres.
                            </p>
                        </div>

                        <form className="space-y-4" onSubmit={handleSubmit}>
                            {/* Nova senha */}
                            <div>
                                <label className="block text-white text-sm font-medium mb-1">
                                    Nova senha
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showNovaSenha ? 'text' : 'password'}
                                        value={novaSenha}
                                        onChange={(e) => setNovaSenha(e.target.value)}
                                        className="w-full px-3 py-2 pr-11 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40"
                                        placeholder="Mínimo 8 caracteres"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowNovaSenha((v) => !v)}
                                        aria-label={showNovaSenha ? 'Ocultar senha' : 'Mostrar senha'}
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/50 hover:text-white/90 transition"
                                    >
                                        {showNovaSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {/* Confirmar senha */}
                            <div>
                                <label className="block text-white text-sm font-medium mb-1">
                                    Confirmar nova senha
                                </label>
                                <div className="relative">
                                    <input
                                        required
                                        type={showConfirmarSenha ? 'text' : 'password'}
                                        value={confirmarSenha}
                                        onChange={(e) => setConfirmarSenha(e.target.value)}
                                        className="w-full px-3 py-2 pr-11 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40"
                                        placeholder="Repita a nova senha"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowConfirmarSenha((v) => !v)}
                                        aria-label={showConfirmarSenha ? 'Ocultar confirmação' : 'Mostrar confirmação'}
                                        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-white/50 hover:text-white/90 transition"
                                    >
                                        {showConfirmarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
                            </div>

                            {error && (
                                <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-200 text-xs text-center">
                                    {error}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={loading}
                                className={`w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition flex items-center justify-center gap-2 ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                {loading && <LoaderCircle size={16} className="animate-spin" />}
                                {loading ? 'Salvando...' : 'Salvar nova senha'}
                            </button>
                        </form>
                    </>
                )}
            </div>
        </div>
    );
};

export default RedefinirSenha;
