import React, { useState, useEffect } from 'react';
import { UserPlus, Search, Edit2, Trash2, X, Check } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';

const UsuariosAdmin = () => {
    const { companies } = useCompanies();

    // Estados para filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState('Todos Perfis');

    // Estado principal de usuários da API
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);

    const fetchUsers = async () => {
        try {
            const res = await api.get('/admin/users');
            setUsers(res.data);
        } catch (error) {
            console.error('Erro ao buscar usuários:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchUsers();
    }, []);

    // Estados para o Modal de Cadastro/Edição
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState(null); // null = criando, objeto = editando
    const [newUser, setNewUser] = useState({
        full_name: '',
        email: '',
        password: '',
        role: 'client',
        company_id: ''
    });

    const getProfileStyles = (role) => {
        switch (role) {
            case 'admin': return 'bg-purple-50 text-purple-700';
            case 'client': return 'bg-blue-50 text-blue-700';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    // Filtros
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.full_name?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesProfile = selectedProfile === 'Todos Perfis' ||
            (selectedProfile === 'Administrador' && user.role === 'admin') ||
            (selectedProfile === 'Cliente' && user.role === 'client');

        return matchesSearch && matchesProfile;
    });

    // Criar ou Editar
    const handleSubmitUser = async (e) => {
        e.preventDefault();
        try {
            if (editingUser) {
                // Editar
                await api.put(`/admin/users/${editingUser.id}`, {
                    full_name: newUser.full_name,
                    role: newUser.role,
                    company_id: newUser.company_id,
                });
                alert('Usuário atualizado com sucesso!');
            } else {
                // Criar
                await api.post('/admin/users', newUser);
                alert('Usuário criado com sucesso!');
            }
            await fetchUsers();
            closeModal();
        } catch (error) {
            console.error('Erro ao salvar usuário', error);
            alert('Falha: ' + (error.response?.data?.error || error.message));
        }
    };

    // Deletar
    const handleDeleteUser = async (userId) => {
        if (!window.confirm('Tem certeza que deseja excluir este usuário? Esta ação não pode ser desfeita.')) return;
        try {
            await api.delete(`/admin/users/${userId}`);
            await fetchUsers();
            alert('Usuário excluído com sucesso!');
        } catch (error) {
            console.error('Erro ao excluir usuário', error);
            alert('Falha ao excluir: ' + (error.response?.data?.error || error.message));
        }
    };

    // Abrir modal para edição
    const openEditModal = (user) => {
        setEditingUser(user);
        setNewUser({
            full_name: user.full_name || '',
            email: '', // não é editável
            password: '', // não é editável
            role: user.role,
            company_id: user.company_id || '',
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setNewUser({ full_name: '', email: '', password: '', role: 'client', company_id: '' });
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 relative font-admin">
            {/* Topo da página */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-normal text-slate-900 tracking-tight text-[32px]">Gestão de Usuários</h1>
                    <p className="text-slate-500 text-lg font-normal">Controle de perfis autorizados (Admins e Clientes)</p>
                </div>
                <button
                    onClick={() => {
                        setNewUser({ full_name: '', email: '', password: '', role: 'client', company_id: '' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-normal transition-all shadow-lg shadow-blue-500/10 active:scale-95 text-sm"
                >
                    <UserPlus size={18} />
                    Novo Usuário
                </button>
            </div>

            {/* Cartões de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                {[
                    { title: 'Administradores do Sistema', count: users.filter(u => u.role === 'admin').length, color: 'bg-purple-500' },
                    { title: 'Clientes do Painel', count: users.filter(u => u.role === 'client').length, color: 'bg-blue-500' }
                ].map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
                        <div>
                            <p className="text-sm font-normal text-slate-500 uppercase tracking-wider mb-1">{card.title}</p>
                            <h3 className="text-3xl font-normal text-slate-900 leading-none">{loading ? '...' : card.count}</h3>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${card.color} opacity-70 group-hover:opacity-100 transition-opacity`}></div>
                    </div>
                ))}
            </div>

            {/* Seção Principal */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 space-y-6">
                    <h2 className="text-2xl font-normal text-slate-800">Usuários Ativos</h2>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar usuário por nome..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all placeholder-slate-400"
                            />
                        </div>

                        <div className="flex flex-wrap gap-3 w-full md:w-auto">
                            <select
                                value={selectedProfile}
                                onChange={(e) => setSelectedProfile(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-normal text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm relative"
                            >
                                <option>Todos Perfis</option>
                                <option>Administrador</option>
                                <option>Cliente</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Nome Completo</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Acesso Global</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Empresa (Vínculo)</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Ultima Atualização</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-normal text-slate-800 text-[15px]">{user.full_name || 'Desconhecido'}</span>
                                            <span className="text-slate-400 text-xs font-normal">{user.id}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-normal tracking-wider uppercase ${getProfileStyles(user.role)}`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-normal text-slate-700">
                                        {user.companies ? user.companies.name : '-- Todos / Admin --'}
                                    </td>
                                    <td className="px-6 py-5 text-sm font-normal text-slate-500 leading-tight">
                                        {new Date(user.updated_at).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button onClick={() => openEditModal(user)} className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors" title="Editar">
                                                <Edit2 size={15} />
                                            </button>
                                            <button onClick={() => handleDeleteUser(user.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors" title="Excluir">
                                                <Trash2 size={15} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal de Cadastro */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-300">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <h3 className="text-xl font-normal text-slate-800">
                                {editingUser ? 'Editar Usuário' : 'Novo Usuário'}
                            </h3>
                            <button onClick={closeModal} className="p-2 hover:bg-white rounded-xl transition-colors text-slate-400">
                                <X size={20} />
                            </button>
                        </div>

                        <form onSubmit={handleSubmitUser} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Ex: João da Silva"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={newUser.full_name}
                                        onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                                    />
                                </div>

                                {!editingUser && (
                                  <>
                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">E-mail de Login</label>
                                        <input
                                            required
                                            type="email"
                                            placeholder="exemplo@empresa.com"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={newUser.email}
                                            onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                        />
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Senha (Temporária)</label>
                                        <input
                                            required
                                            type="password"
                                            placeholder="Min 6 caracteres"
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                            value={newUser.password}
                                            onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                                        />
                                    </div>
                                  </>
                                )}

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Perfil Base</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                            value={newUser.role}
                                            onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                                        >
                                            <option value="admin">Administrador Geral</option>
                                            <option value="client">Cliente Limitado</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Vínculo com Empresa</label>
                                        <select
                                            disabled={newUser.role === 'admin'}
                                            className={`w-full px-4 py-3 border border-slate-200 rounded-2xl text-sm font-normal transition-all cursor-pointer ${newUser.role === 'admin' ? 'bg-slate-200' : 'bg-slate-50 focus:ring-2 focus:ring-blue-500/20'}`}
                                            value={newUser.company_id}
                                            onChange={(e) => setNewUser({ ...newUser, company_id: e.target.value })}
                                            required={newUser.role === 'client'}
                                        >
                                            <option value="">Selecione...</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.id}>{c.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="flex-1 px-6 py-3 border border-slate-200 text-slate-600 rounded-2xl font-normal hover:bg-slate-50 transition-all active:scale-95"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 flex items-center justify-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-2xl font-normal hover:bg-blue-500 transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                                >
                                    <Check size={18} />
                                    {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UsuariosAdmin;
