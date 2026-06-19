import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';

const RecuperarSenha = () => {
    const [email, setEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [enviado, setEnviado] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            await supabase.auth.resetPasswordForEmail(email.trim(), {
                redirectTo: window.location.origin + '/redefinir-senha',
            });
        } catch {
            // Mesmo em caso de erro exibimos a mesma mensagem para não revelar
            // se o e-mail está ou não cadastrado.
        } finally {
            setLoading(false);
            setEnviado(true);
        }
    };

    return (
        <div className="relative min-h-screen overflow-hidden bg-black flex items-center justify-center px-4">
            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-8 lg:p-12 rounded-3xl shadow-2xl w-full max-w-[420px]">

                <div className="text-center mb-6">
                    <h2 className="text-3xl font-bold text-white mb-2">Recuperar senha</h2>
                    <p className="text-white/70 text-sm">
                        Informe seu e-mail para receber o link de redefinição.
                    </p>
                </div>

                {enviado ? (
                    <div className="space-y-6">
                        <div className="p-4 bg-emerald-500/20 border border-emerald-400/50 rounded-xl text-emerald-100 text-sm text-center leading-relaxed">
                            Se este e-mail estiver cadastrado, você receberá um link em breve.
                            Verifique também a pasta de spam.
                        </div>
                        <Link
                            to="/"
                            className="block text-center w-full py-3 bg-white/10 hover:bg-white/20 text-white text-sm font-semibold rounded-xl transition border border-white/20"
                        >
                            Voltar ao login
                        </Link>
                    </div>
                ) : (
                    <form className="space-y-4" onSubmit={handleSubmit}>
                        <div>
                            <label className="block text-white text-sm font-medium mb-1">
                                E-mail
                            </label>
                            <input
                                required
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-white text-sm placeholder:text-white/40"
                                placeholder="Digite seu e-mail"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className={`w-full mt-2 py-3 bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold rounded-xl transition ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {loading ? 'Enviando...' : 'Enviar link de recuperação'}
                        </button>

                        <Link
                            to="/"
                            className="block text-center text-xs text-white/60 hover:text-white/90 underline mt-2"
                        >
                            Voltar ao login
                        </Link>
                    </form>
                )}
            </div>
        </div>
    );
};

export default RecuperarSenha;
