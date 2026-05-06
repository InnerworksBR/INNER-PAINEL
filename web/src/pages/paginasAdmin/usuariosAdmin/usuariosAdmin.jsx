import React, { useEffect, useState } from 'react';
import { Ban, Check, Edit2, KeyRound, LockOpen, Search, Trash2, UserPlus, X } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';

const emptyUser = { full_name: '', email: '', password: '', role: 'client', company_id: '' };

const UsuariosAdmin = () => {
    const { companies } = useCompanies();
    const [users, setUsers] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState('Todos Perfis');
    const [loading, setLoading] = useState(true);
    const [feedback, setFeedback] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null);
    const [formUser, setFormUser] = useState(emptyUser);
    const [resetUser, setResetUser] = useState(null);
    const [newPassword, setNewPassword] = useState('');

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data || []);
        } catch (error) {
            setFeedback({ type: 'error', text: error.response?.data?.error || 'Erro ao buscar usuários.' });
        } finally {
            setLoading(false);
        }
    };

    const filteredUsers = users.filter((user) => {
        const matchesSearch = (user.full_name || '').toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProfile = selectedProfile === 'Todos Perfis' ||
            (selectedProfile === 'Administrador' && user.role === 'admin') ||
            (selectedProfile === 'Cliente' && user.role === 'client');
        return matchesSearch && matchesProfile;
    });

    const handleSubmitUser = async (event) => {
        event.preventDefault();
        setFeedback(null);
        try {
            if (editingUser) {
                await api.put(`/admin/users/${editingUser.id}`, {
                    full_name: formUser.full_name,
                    role: formUser.role,
                    company_id: formUser.company_id,
                });
                setFeedback({ type: 'success', text: 'Usuário atualizado com sucesso.' });
            } else {
                await api.post('/admin/users', formUser);
                setFeedback({ type: 'success', text: 'Usuário criado com sucesso.' });
            }
            closeModal();
            await fetchUsers();
        } catch (error) {
            setFeedback({ type: 'error', text: error.response?.data?.error || error.message });
        }
    };

    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Excluir este usuário? Esta ação não pode ser desfeita.')) return;
        setFeedback(null);
        try {
            await api.delete(`/admin/users/${userId}`);
            setFeedback({ type: 'success', text: 'Usuário excluído com sucesso.' });
            await fetchUsers();
        } catch (error) {
            setFeedback({ type: 'error', text: error.response?.data?.error || error.message });
        }
    };

    const handleStatus = async (user, action) => {
        setFeedback(null);
        try {
            await api.post(`/admin/users/${user.id}/${action}`);
            setFeedback({ type: 'success', text: action === 'block' ? 'Usuário bloqueado.' : 'Usuário desbloqueado.' });
            await fetchUsers();
        } catch (error) {
            setFeedback({ type: 'error', text: error.response?.data?.error || error.message });
        }
    };

    const handleResetPassword = async (event) => {
        event.preventDefault();
        setFeedback(null);
        try {
            await api.post(`/admin/users/${resetUser.id}/reset-password`, { password: newPassword });
            setFeedback({ type: 'success', text: 'Senha redefinida com sucesso.' });
            setResetUser(null);
            setNewPassword('');
        } catch (error) {
            setFeedback({ type: 'error', text: error.response?.data?.error || error.message });
        }
    };

    const openEditModal = (user) => {
        setEditingUser(user);
        setFormUser({
            full_name: user.full_name || '',
            email: '',
            password: '',
            role: user.role,
            company_id: user.company_id || '',
        });
        setIsModalOpen(true);
    };

    const openCreateModal = () => {
        setEditingUser(null);
        setFormUser(emptyUser);
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setFormUser(emptyUser);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-8 pb-12">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-slate-900">Gestão de Usuários</h1>
                    <p className="text-slate-500 mt-1">Controle de acesso, bloqueio e redefinição de senha.</p>
                </div>
                <button onClick={openCreateModal} className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-lg">
                    <UserPlus size={18} />
                    Novo Usuário
                </button>
            </div>

            {feedback && (
                <div className={`rounded-lg p-3 text-sm ${feedback.type === 'error' ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {feedback.text}
                </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <Summary title="Admins" value={users.filter((u) => u.role === 'admin').length} />
                <Summary title="Clientes" value={users.filter((u) => u.role === 'client').length} />
                <Summary title="Ativos" value={users.filter((u) => (u.status || 'active') === 'active').length} />
                <Summary title="Bloqueados" value={users.filter((u) => u.status === 'blocked').length} tone="danger" />
            </div>

            <section className="bg-white rounded-lg shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-5 border-b border-slate-100 bg-slate-50/40 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Buscar usuário..." className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
                    </div>
                    <select value={selectedProfile} onChange={(e) => setSelectedProfile(e.target.value)} className="bg-white border border-slate-200 rounded-lg px-4 py-2.5 text-sm">
                        <option>Todos Perfis</option>
                        <option>Administrador</option>
                        <option>Cliente</option>
                    </select>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase">Nome</th>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase">Perfil</th>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase">Status</th>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase">Empresa</th>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase">Último login</th>
                                <th className="px-5 py-4 text-xs text-slate-500 uppercase text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {loading ? (
                                <tr><td className="p-6 text-slate-500" colSpan={6}>Carregando...</td></tr>
                            ) : filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-slate-50">
                                    <td className="px-5 py-4">
                                        <p className="font-semibold text-slate-800">{user.full_name || 'Sem nome'}</p>
                                        <p className="text-xs text-slate-400">{user.id}</p>
                                    </td>
                                    <td className="px-5 py-4"><Badge text={user.role} tone={user.role === 'admin' ? 'purple' : 'blue'} /></td>
                                    <td className="px-5 py-4"><Badge text={user.status === 'blocked' ? 'Bloqueado' : 'Ativo'} tone={user.status === 'blocked' ? 'red' : 'green'} /></td>
                                    <td className="px-5 py-4 text-sm text-slate-700">{user.companies?.name || '-- Admin / sem vínculo --'}</td>
                                    <td className="px-5 py-4 text-sm text-slate-500">{formatDate(user.last_login_at)}</td>
                                    <td className="px-5 py-4">
                                        <div className="flex justify-end gap-2">
                                            <IconButton title="Editar" onClick={() => openEditModal(user)} icon={Edit2} />
                                            <IconButton title="Redefinir senha" onClick={() => setResetUser(user)} icon={KeyRound} />
                                            {user.status === 'blocked'
                                                ? <IconButton title="Desbloquear" onClick={() => handleStatus(user, 'unblock')} icon={LockOpen} />
                                                : <IconButton title="Bloquear" onClick={() => handleStatus(user, 'block')} icon={Ban} />}
                                            <IconButton title="Excluir" onClick={() => handleDeleteUser(user.id)} icon={Trash2} danger />
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            {isModalOpen && (
                <Modal title={editingUser ? 'Editar Usuário' : 'Novo Usuário'} onClose={closeModal}>
                    <form onSubmit={handleSubmitUser} className="space-y-4">
                        <Field label="Nome completo" value={formUser.full_name} onChange={(value) => setFormUser({ ...formUser, full_name: value })} required />
                        {!editingUser && <Field label="E-mail" type="email" value={formUser.email} onChange={(value) => setFormUser({ ...formUser, email: value })} required />}
                        {!editingUser && <Field label="Senha inicial" type="password" value={formUser.password} onChange={(value) => setFormUser({ ...formUser, password: value })} required />}
                        <Select label="Perfil" value={formUser.role} onChange={(value) => setFormUser({ ...formUser, role: value, company_id: value === 'admin' ? '' : formUser.company_id })}>
                            <option value="client">Cliente</option>
                            <option value="admin">Administrador</option>
                        </Select>
                        {formUser.role === 'client' && (
                            <Select label="Empresa" value={formUser.company_id} onChange={(value) => setFormUser({ ...formUser, company_id: value })} required>
                                <option value="">Selecione uma empresa</option>
                                {companies.map((company) => <option key={company.id} value={company.id}>{company.name}</option>)}
                            </Select>
                        )}
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg flex items-center justify-center gap-2">
                            <Check size={18} />
                            Salvar
                        </button>
                    </form>
                </Modal>
            )}

            {resetUser && (
                <Modal title={`Redefinir senha: ${resetUser.full_name || resetUser.id}`} onClose={() => setResetUser(null)}>
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <Field label="Nova senha" type="password" value={newPassword} onChange={setNewPassword} required />
                        <button className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg">Redefinir senha</button>
                    </form>
                </Modal>
            )}
        </div>
    );
};

const Summary = ({ title, value, tone }) => (
    <div className="bg-white rounded-lg border border-slate-100 p-5">
        <p className="text-xs uppercase text-slate-500">{title}</p>
        <p className={`text-3xl font-bold mt-1 ${tone === 'danger' ? 'text-red-600' : 'text-slate-900'}`}>{value}</p>
    </div>
);

const Badge = ({ text, tone }) => {
    const styles = {
        purple: 'bg-purple-50 text-purple-700',
        blue: 'bg-blue-50 text-blue-700',
        red: 'bg-red-50 text-red-700',
        green: 'bg-emerald-50 text-emerald-700',
    };
    return <span className={`inline-flex px-3 py-1 rounded-full text-xs font-semibold ${styles[tone]}`}>{text}</span>;
};

const IconButton = ({ title, onClick, icon: Icon, danger }) => (
    <button onClick={onClick} className={`p-2 rounded-lg transition-colors ${danger ? 'hover:bg-red-50 text-slate-400 hover:text-red-600' : 'hover:bg-blue-50 text-slate-400 hover:text-blue-600'}`} title={title}>
        <Icon size={16} />
    </button>
);

const Modal = ({ title, onClose, children }) => (
    <div className="fixed inset-0 bg-slate-900/40 z-[100] flex items-center justify-center p-4">
        <div className="bg-white w-full max-w-lg rounded-lg shadow-2xl overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <h3 className="text-lg font-bold text-slate-800">{title}</h3>
                <button onClick={onClose} className="p-2 hover:bg-white rounded-lg text-slate-400"><X size={20} /></button>
            </div>
            <div className="p-6">{children}</div>
        </div>
    </div>
);

const Field = ({ label, value, onChange, type = 'text', required }) => (
    <label className="block">
        <span className="text-xs uppercase text-slate-500">{label}</span>
        <input type={type} value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20" />
    </label>
);

const Select = ({ label, value, onChange, required, children }) => (
    <label className="block">
        <span className="text-xs uppercase text-slate-500">{label}</span>
        <select value={value} onChange={(e) => onChange(e.target.value)} required={required} className="mt-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg text-sm">
            {children}
        </select>
    </label>
);

function formatDate(value) {
    return value ? new Date(value).toLocaleString('pt-BR') : '-';
}

export default UsuariosAdmin;
