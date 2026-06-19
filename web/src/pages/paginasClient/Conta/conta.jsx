import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
  ShieldCheck,
  UserRound,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import api from '../../../services/api';

const initialNameForm = { full_name: '' };

const initialPasswordForm = {
  currentPassword: '',
  newPassword: '',
  confirmPassword: '',
};

const Conta = () => {
  const navigate = useNavigate();
  const { logout, updateUser } = useAuth();
  const [account, setAccount] = useState(null);
  const [loadingAccount, setLoadingAccount] = useState(true);
  const [accountError, setAccountError] = useState('');
  const [passwordForm, setPasswordForm] = useState(initialPasswordForm);
  const [visibleFields, setVisibleFields] = useState({});
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [nameForm, setNameForm] = useState(initialNameForm);
  const [savingName, setSavingName] = useState(false);
  const [nameError, setNameError] = useState('');
  const [nameSuccess, setNameSuccess] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    let active = true;

    const loadAccount = async () => {
      setLoadingAccount(true);
      setAccountError('');
      try {
        const response = await api.get('/auth/me');
        if (active) setAccount(response.data?.user || null);
      } catch (error) {
        if (active) {
          setAccountError(error.response?.data?.error || 'Nao foi possivel carregar sua conta.');
        }
      } finally {
        if (active) setLoadingAccount(false);
      }
    };

    loadAccount();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setNameForm({ full_name: account?.full_name || '' });
  }, [account]);

  const roleLabel = useMemo(
    () => account?.role === 'admin' ? 'Administrador' : 'Cliente',
    [account?.role]
  );

  const updatePasswordField = (field, value) => {
    setPasswordForm((current) => ({ ...current, [field]: value }));
    setFormError('');
  };

  const togglePasswordField = (field) => {
    setVisibleFields((current) => ({ ...current, [field]: !current[field] }));
  };

  const validatePasswordForm = () => {
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      return 'Preencha todos os campos de senha.';
    }

    if (passwordForm.newPassword.length < 8) {
      return 'A nova senha precisa ter pelo menos 8 caracteres.';
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      return 'A confirmacao da nova senha nao confere.';
    }

    return '';
  };

  const saveName = async (event) => {
    event.preventDefault();
    const trimmed = nameForm.full_name.trim();
    if (!trimmed) {
      setNameError('O nome nao pode ser vazio.');
      return;
    }
    if (trimmed.length > 100) {
      setNameError('O nome pode ter no maximo 100 caracteres.');
      return;
    }

    setSavingName(true);
    setNameError('');
    setNameSuccess('');

    try {
      await api.put('/auth/me', { full_name: trimmed });
      updateUser({ full_name: trimmed });
      setAccount((current) => ({ ...current, full_name: trimmed }));
      setNameSuccess('Nome atualizado com sucesso!');
      setTimeout(() => setNameSuccess(''), 3000);
    } catch (error) {
      setNameError(error.response?.data?.error || 'Nao foi possivel atualizar o nome agora.');
    } finally {
      setSavingName(false);
    }
  };

  const changePassword = async (event) => {
    event.preventDefault();
    const validationError = validatePasswordForm();

    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSaving(true);
    setFormError('');

    try {
      await api.post('/auth/change-password', passwordForm);
      setPasswordForm(initialPasswordForm);
      setSuccessMessage('Senha alterada com sucesso!');
      await new Promise((r) => setTimeout(r, 2000));
      logout();
      navigate('/', {
        replace: true,
        state: { passwordChanged: true },
      });
    } catch (error) {
      setFormError(error.response?.data?.error || 'Nao foi possivel alterar a senha agora.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in duration-500">
      <header className="flex flex-col gap-1">
        <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Minha conta</h1>
        <p className="text-slate-500 text-lg">Dados do acesso e seguranca da sua sessao.</p>
      </header>

      {accountError && (
        <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">
          <AlertCircle size={18} />
          {accountError}
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_minmax(360px,440px)] gap-6">
        <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-50 text-blue-700">
              <UserRound size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Perfil</h2>
              <p className="text-sm text-slate-500">Informacoes vinculadas ao seu acesso.</p>
            </div>
          </div>

          {loadingAccount ? (
            <div className="flex min-h-48 items-center justify-center gap-3 text-slate-500">
              <LoaderCircle size={20} className="animate-spin" />
              Carregando conta...
            </div>
          ) : (
            <div className="space-y-4">
              {nameSuccess && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                  <CheckCircle2 size={16} className="shrink-0" />
                  {nameSuccess}
                </div>
              )}
              <form onSubmit={saveName} className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-500">
                  <UserRound size={16} />
                  Nome
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={nameForm.full_name}
                    onChange={(e) => { setNameForm({ full_name: e.target.value }); setNameError(''); }}
                    maxLength={100}
                    className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    placeholder="Seu nome completo"
                  />
                  <button
                    type="submit"
                    disabled={savingName}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {savingName ? <LoaderCircle size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                    Salvar
                  </button>
                </div>
                {nameError && (
                  <div className="flex items-center gap-2 text-sm text-red-700">
                    <AlertCircle size={14} className="shrink-0" />
                    {nameError}
                  </div>
                )}
              </form>
              <dl className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <AccountField icon={Mail} label="E-mail" value={account?.email || 'Nao informado'} />
                <AccountField icon={Building2} label="Empresa" value={account?.company_name || 'Nao vinculada'} />
                <AccountField icon={ShieldCheck} label="Perfil" value={roleLabel} />
              </dl>
            </div>
          )}
        </section>

        <section className="bg-white border border-slate-200 rounded-lg p-6 shadow-sm">
          <div className="flex items-center gap-3 mb-6">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-700">
              <KeyRound size={20} />
            </span>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Alterar senha</h2>
              <p className="text-sm text-slate-500">A nova senha precisa ter 8 caracteres ou mais.</p>
            </div>
          </div>

          {successMessage && (
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700 mb-4">
              <CheckCircle2 size={16} className="shrink-0" />
              {successMessage}
            </div>
          )}

          <form className="space-y-4" onSubmit={changePassword}>
            <PasswordField
              id="currentPassword"
              label="Senha atual"
              value={passwordForm.currentPassword}
              visible={visibleFields.currentPassword}
              onChange={(value) => updatePasswordField('currentPassword', value)}
              onToggle={() => togglePasswordField('currentPassword')}
            />
            <PasswordField
              id="newPassword"
              label="Nova senha"
              value={passwordForm.newPassword}
              visible={visibleFields.newPassword}
              onChange={(value) => updatePasswordField('newPassword', value)}
              onToggle={() => togglePasswordField('newPassword')}
            />
            <PasswordField
              id="confirmPassword"
              label="Confirmar nova senha"
              value={passwordForm.confirmPassword}
              visible={visibleFields.confirmPassword}
              onChange={(value) => updatePasswordField('confirmPassword', value)}
              onToggle={() => togglePasswordField('confirmPassword')}
            />

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                <AlertCircle size={16} className="mt-0.5 shrink-0" />
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={saving}
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {saving ? <LoaderCircle size={18} className="animate-spin" /> : <CheckCircle2 size={18} />}
              {saving ? 'Alterando...' : 'Alterar senha'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
};

const AccountField = ({ icon: Icon, label, value }) => (
  <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 min-w-0">
    <dt className="flex items-center gap-2 text-sm font-semibold text-slate-500">
      <Icon size={16} />
      {label}
    </dt>
    <dd className="mt-2 break-words text-base font-medium text-slate-900">{value}</dd>
  </div>
);

const PasswordField = ({ id, label, value, visible, onChange, onToggle }) => (
  <div>
    <label htmlFor={id} className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</label>
    <div className="relative">
      <input
        id={id}
        required
        autoComplete={id === 'currentPassword' ? 'current-password' : 'new-password'}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 pr-11 text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
      />
      <button
        type="button"
        onClick={onToggle}
        aria-label={visible ? `Ocultar ${label.toLowerCase()}` : `Mostrar ${label.toLowerCase()}`}
        title={visible ? 'Ocultar senha' : 'Mostrar senha'}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-slate-500 transition hover:text-blue-600"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  </div>
);

export default Conta;
