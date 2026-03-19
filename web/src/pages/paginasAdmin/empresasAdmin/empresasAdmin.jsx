import React, { useState } from 'react';
import { Building2, Plus, Search, Edit2, Trash2, X, Check } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';

const EmpresasAdmin = () => {
    const { companies, addCompany, updateCompany, deleteCompany } = useCompanies();

    // Estados para o modal e formulário
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [editingCompany, setEditingCompany] = useState(null);
    const [formValues, setFormValues] = useState({
        name: '',
        cnpj: '',
        sector: '',
        status: 'Ativo'
    });

    const handleOpenModal = (company = null) => {
        if (company) {
            setEditingCompany(company);
            setFormValues(company);
        } else {
            setEditingCompany(null);
            setFormValues({ name: '', cnpj: '', sector: '', status: 'Ativo' });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (formValues.name && formValues.cnpj) {
            if (editingCompany) {
                updateCompany({ ...formValues, id: editingCompany.id });
            } else {
                addCompany(formValues);
            }
            setIsModalOpen(false);
        }
    };

    const handleDeleteClick = (id) => {
        if (window.confirm('Tem certeza que deseja excluir esta empresa?')) {
            deleteCompany(id);
        }
    };

    const filteredCompanies = companies.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.cnpj.includes(searchTerm)
    );

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-in fade-in duration-500 font-admin">
            <div className="flex justify-between items-end">
                <div className="flex flex-col gap-1">
                    <h1 className="text-3xl font-normal text-slate-900 tracking-tight">Gestão de Empresas</h1>
                    <p className="text-slate-500 text-lg font-normal">Cadastre e gerencie as empresas do portal</p>
                </div>
                <button
                    onClick={() => handleOpenModal()}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl font-normal transition-all shadow-lg shadow-blue-500/20 active:scale-95"
                >
                    <Plus size={20} />
                    Nova Empresa
                </button>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row gap-4 items-center justify-between">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar empresa por nome ou CNPJ..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all font-normal"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Empresa</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">CNPJ</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Setor</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-wider text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                            {filteredCompanies.map((empresa) => (
                                <tr key={empresa.id} className="hover:bg-slate-50/50 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
                                                <Building2 size={20} />
                                            </div>
                                            <span className="font-normal text-slate-800">{empresa.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-600 text-sm font-normal">{empresa.cnpj}</td>
                                    <td className="px-6 py-4 text-slate-600 text-sm font-normal">{empresa.sector}</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-normal uppercase tracking-wider ${empresa.status === 'Ativo' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {empresa.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button
                                                onClick={() => handleOpenModal(empresa)}
                                                className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                                                title="Editar"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteClick(empresa.id)}
                                                className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                                title="Excluir"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredCompanies.length === 0 && (
                        <div className="p-12 text-center text-slate-400 font-normal">
                            Nenhuma empresa encontrada com este critério.
                        </div>
                    )}
                </div>
            </div>

            {/* Modal de Cadastro/Edição */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                            <div>
                                <h2 className="text-xl font-normal text-slate-900">
                                    {editingCompany ? 'Editar Empresa' : 'Cadastrar Empresa'}
                                </h2>
                                <p className="text-xs text-slate-500 font-normal uppercase tracking-wider mt-0.5">
                                    {editingCompany ? 'Atualizar dados no portal' : 'Nova Entidade no Portal'}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                                <X size={20} className="text-slate-500" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Nome da Empresa</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="Ex: InnerWorks Tecnologia"
                                    value={formValues.name}
                                    onChange={(e) => setFormValues({ ...formValues, name: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">CNPJ</label>
                                <input
                                    required
                                    type="text"
                                    placeholder="00.000.000/0001-00"
                                    value={formValues.cnpj}
                                    onChange={(e) => setFormValues({ ...formValues, cnpj: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Setor</label>
                                <input
                                    type="text"
                                    placeholder="Ex: Tecnologia, Logística"
                                    value={formValues.sector}
                                    onChange={(e) => setFormValues({ ...formValues, sector: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-sm font-normal text-slate-700 ml-1">Status</label>
                                <select
                                    value={formValues.status}
                                    onChange={(e) => setFormValues({ ...formValues, status: e.target.value })}
                                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all font-normal text-sm appearance-none"
                                >
                                    <option value="Ativo">Ativo</option>
                                    <option value="Inativo">Inativo</option>
                                </select>
                            </div>

                            <div className="flex justify-end gap-3 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-5 py-2.5 text-sm font-normal text-slate-600 hover:bg-slate-100 rounded-xl transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit"
                                    className="px-5 py-2.5 text-sm font-normal text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                                >
                                    <Check size={18} />
                                    {editingCompany ? 'Salvar Alterações' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EmpresasAdmin;
