import React, { useState } from 'react';
import { UserPlus, Search, ChevronDown, Edit2, Eye, Trash2, Moon, X, Check } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';

const UsuariosAdmin = () => {
    const { companies } = useCompanies();

    // Estados para filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedProfile, setSelectedProfile] = useState('Todos Perfis');
    const [selectedStatus, setSelectedStatus] = useState('Status: Todos');

    // Estado principal de usuários
    const [users, setUsers] = useState([
        { id: 1, name: 'Carlos Silva', email: 'carlos.silva@techsolutions.com', profile: 'ADMIN', company: 'ABRAHY', status: 'ATIVO', lastAccess: '12/03/2026 às 14:32' },
        { id: 2, name: 'Ana Santos', email: 'ana.santos@techsolutions.com', profile: 'GESTOR', company: 'SUSTENTS', status: 'ATIVO', lastAccess: '12/03/2026 às 10:15' },
        { id: 3, name: 'Pedro Costa', email: 'pedro.costa@industrial.com', profile: 'ADMIN', company: 'ROCHA', status: 'ATIVO', lastAccess: '11/03/2026 às 16:45' },
        { id: 4, name: 'Maria Oliveira', email: 'maria.oliveira@industrial.com', profile: 'TÉCNICO', company: 'CARPOLOG', status: 'ATIVO', lastAccess: '12/03/2026 às 09:22' },
        { id: 5, name: 'João Pereira', email: 'joao.pereira@logistica.com', profile: 'GESTOR', company: 'ABRAHY', status: 'ATIVO', lastAccess: '10/03/2026 às 13:08' },
        { id: 6, name: 'Fernanda Lima', email: 'fernanda.lima@servicos.com', profile: 'TÉCNICO', company: 'SUSTENTS', status: 'INATIVO', lastAccess: '05/03/2026 às 11:30' },
    ]);

    // Estados para o Modal de Cadastro
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        profile: 'TÉCNICO',
        company: '',
        status: 'ATIVO'
    });

    const [editingUser, setEditingUser] = useState(null);

    const getProfileStyles = (profile) => {
        switch (profile) {
            case 'ADMIN': return 'bg-purple-50 text-purple-700';
            case 'GESTOR': return 'bg-blue-50 text-blue-700';
            case 'TÉCNICO': return 'bg-slate-100 text-slate-600';
            default: return 'bg-slate-100 text-slate-600';
        }
    };

    // Filtros
    const filteredUsers = users.filter(user => {
        const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            user.email.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesProfile = selectedProfile === 'Todos Perfis' ||
            (selectedProfile === 'Administrador' && user.profile === 'ADMIN') ||
            (selectedProfile === 'Gestor' && user.profile === 'GESTOR') ||
            (selectedProfile === 'Técnico' && user.profile === 'TÉCNICO');

        const matchesStatus = selectedStatus === 'Status: Todos' ||
            (selectedStatus === 'Ativo' && user.status === 'ATIVO') ||
            (selectedStatus === 'Inativo' && user.status === 'INATIVO');

        return matchesSearch && matchesProfile && matchesStatus;
    });

    // Ações
    const handleAddUser = (e) => {
        e.preventDefault();
        
        if (editingUser) {
            // Edição
            setUsers(prev => prev.map(u => 
                u.id === editingUser.id ? { ...u, ...newUser } : u
            ));
        } else {
            // Criação
            const userToAdd = {
                ...newUser,
                id: users.length + 1,
                lastAccess: 'Nunca acessou'
            };
            setUsers([userToAdd, ...users]);
        }
        
        closeModal();
    };

    const handleEditUser = (user) => {
        setEditingUser(user);
        setNewUser({
            name: user.name,
            email: user.email,
            profile: user.profile,
            company: user.company,
            status: user.status
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingUser(null);
        setNewUser({ name: '', email: '', profile: 'TÉCNICO', company: '', status: 'ATIVO' });
    };

    const handleDeleteUser = (id) => {
        if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
            setUsers(users.filter(u => u.id !== id));
        }
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 relative font-admin">
            {/* Topo da página */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
                <div className="flex flex-col gap-1">
                    <h1 className="text-4xl font-normal text-slate-900 tracking-tight text-[32px]">Gestão de Usuários</h1>
                    <p className="text-slate-500 text-lg font-normal">Controle de usuários e permissões do sistema</p>
                </div>
                <button
                    onClick={() => {
                        setEditingUser(null);
                        setNewUser({ name: '', email: '', profile: 'TÉCNICO', company: '', status: 'ATIVO' });
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2.5 rounded-xl font-normal transition-all shadow-lg shadow-blue-500/10 active:scale-95 text-sm"
                >
                    <UserPlus size={18} />
                    Novo Usuário
                </button>
            </div>

            {/* Cartões de Resumo */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                {[
                    { title: 'Administradores', count: users.filter(u => u.profile === 'ADMIN').length, color: 'bg-purple-500' },
                    { title: 'Gestores', count: users.filter(u => u.profile === 'GESTOR').length, color: 'bg-blue-500' },
                    { title: 'Técnicos', count: users.filter(u => u.profile === 'TÉCNICO').length, color: 'bg-slate-400' }
                ].map((card, i) => (
                    <div key={i} className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 flex items-center justify-between group hover:shadow-md transition-all duration-300">
                        <div>
                            <p className="text-sm font-normal text-slate-500 uppercase tracking-wider mb-1">{card.title}</p>
                            <h3 className="text-3xl font-normal text-slate-900 leading-none">{card.count}</h3>
                        </div>
                        <div className={`w-3 h-3 rounded-full ${card.color} opacity-70 group-hover:opacity-100 transition-opacity`}></div>
                    </div>
                ))}
            </div>

            {/* Seção Principal: Usuários do Sistema */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 bg-slate-50/30 space-y-6">
                    <h2 className="text-2xl font-normal text-slate-800">Usuários do Sistema</h2>

                    <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
                        <div className="relative w-full md:w-96">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                            <input
                                type="text"
                                placeholder="Buscar usuário por nome ou email..."
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
                                <option>Gestor</option>
                                <option>Técnico</option>
                            </select>
                            <select
                                value={selectedStatus}
                                onChange={(e) => setSelectedStatus(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-normal text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm relative"
                            >
                                <option>Status: Todos</option>
                                <option>Ativo</option>
                                <option>Inativo</option>
                            </select>
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Nome / E-mail</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Perfil</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Empresa</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Status</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest">Último Acesso</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredUsers.map((user) => (
                                <tr key={user.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col">
                                            <span className="font-normal text-slate-800 text-[15px]">{user.name}</span>
                                            <span className="text-slate-400 text-xs font-normal">{user.email}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className={`inline-flex px-3 py-1 rounded-full text-[10px] font-normal tracking-wider ${getProfileStyles(user.profile)}`}>
                                            {user.profile}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-normal text-slate-700">
                                        {user.company || '--'}
                                    </td>
                                    <td className="px-6 py-5 text-sm">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-normal tracking-wider ${user.status === 'ATIVO' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                                            {user.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-5 text-sm font-normal text-slate-500 leading-tight">
                                        {user.lastAccess}
                                    </td>
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                            <button 
                                                onClick={() => handleEditUser(user)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                                            >
                                                <Edit2 size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteUser(user.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                            >
                                                <Trash2 size={18} />
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

                        <form onSubmit={handleAddUser} className="p-8 space-y-6">
                            <div className="grid grid-cols-1 gap-6">
                                <div className="space-y-2">
                                    <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                    <input
                                        required
                                        type="text"
                                        placeholder="Digite o nome"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={newUser.name}
                                        onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">E-mail Corporativo</label>
                                    <input
                                        required
                                        type="email"
                                        placeholder="exemplo@empresa.com"
                                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                        value={newUser.email}
                                        onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Perfil</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                            value={newUser.profile}
                                            onChange={(e) => setNewUser({ ...newUser, profile: e.target.value })}
                                        >
                                            <option value="ADMIN">ADMIN</option>
                                            <option value="GESTOR">GESTOR</option>
                                            <option value="TÉCNICO">TÉCNICO</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs font-normal text-slate-500 uppercase tracking-widest ml-1">Empresa</label>
                                        <select
                                            className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-normal focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all cursor-pointer"
                                            value={newUser.company}
                                            onChange={(e) => setNewUser({ ...newUser, company: e.target.value })}
                                        >
                                            <option value="">Selecione...</option>
                                            {companies.map(c => (
                                                <option key={c.id} value={c.name}>{c.name}</option>
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
                                    {editingUser ? <Check size={18} /> : <Check size={18} />}
                                    {editingUser ? 'Salvar Alterações' : 'Cadastrar Usuário'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Rodapé Info */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center rounded-3xl">
                <p className="text-xs font-normal text-slate-400 uppercase tracking-widest">
                    Sistema de Permissões InnerWorks Tecnologia
                </p>
            </div>
        </div>
    );
};

export default UsuariosAdmin;
