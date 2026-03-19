import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Activity, Users, FileText, ChevronRight, Settings } from 'lucide-react';

const DashAdmin = () => {
    const navigate = useNavigate();

    const stats = [
        {
            title: "Empresas Cadastradas",
            value: "4",
            icon: <Building2 className="text-blue-600" size={24} />,
            borderColor: "border-blue-100",
            iconBg: "bg-blue-50"
        },
        {
            title: "Usuários",
            value: "86",
            icon: <Users className="text-purple-600" size={24} />,
            borderColor: "border-purple-100",
            iconBg: "bg-purple-50"
        },
        {
            title: "Documentos",
            value: "312",
            icon: <FileText className="text-orange-600" size={24} />,
            borderColor: "border-orange-100",
            iconBg: "bg-orange-50"
        }
    ];

    const quickActions = [
        {
            title: "Gerenciar Empresas",
            description: "Cadastrar e editar empresas",
            icon: <Building2 className="text-blue-600" size={20} />,
            bg: "bg-blue-50",
            path: "/admin/empresasAdmin"
        },
        {
            title: "Documentação",
            description: "Upload e gestão de documentos",
            icon: <FileText className="text-orange-600" size={20} />,
            bg: "bg-orange-50",
            path: "/admin/docAdmin"
        },
        {
            title: "Usuários",
            description: "Controle de usuários e acessos",
            icon: <Users className="text-green-600" size={20} />,
            bg: "bg-green-50",
            path: "/admin/usuariosAdmin"
        },
        {
            title: "Configurações",
            description: "Configurações gerais do sistema",
            icon: <Settings className="text-slate-600" size={20} />,
            bg: "bg-slate-50",
            path: "/admin/configAdmin"
        }
    ];

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 font-admin">
            {/* Topo da página */}
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Dashboard</h1>
                <p className="text-slate-500 text-lg font-normal font-light">Visão geral do sistema administrativo</p>
            </div>

            {/* Cartões de estatísticas */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                {stats.map((stat, index) => (
                    <div key={index} className={`bg-white p-6 rounded-2xl shadow-sm border ${stat.borderColor} hover:shadow-md transition-all duration-300 relative group`}>
                        <div className={`absolute top-6 right-6 p-2.5 ${stat.iconBg} rounded-xl transition-colors`}>
                            {stat.icon}
                        </div>
                        <div className="space-y-1">
                            <p className="text-sm font-normal text-slate-500 uppercase tracking-wider font-light">{stat.title}</p>
                            <h3 className="text-3xl font-normal text-slate-900">{stat.value}</h3>
                        </div>
                    </div>
                ))}
            </div>

            {/* Seção de Acesso Rápido */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100 space-y-8">
                <h2 className="text-2xl font-normal text-slate-800">Acesso Rápido</h2>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {quickActions.map((action, index) => (
                        <button
                            key={index}
                            onClick={() => navigate(action.path)}
                            className="flex flex-col items-start p-6 rounded-2xl border border-slate-100 hover:border-blue-200 hover:bg-blue-50/20 transition-all duration-300 text-left group w-full"
                        >
                            <div className={`p-4 ${action.bg} rounded-2xl mb-4 group-hover:scale-110 transition-transform duration-300`}>
                                {action.icon}
                            </div>
                            <h4 className="text-lg font-normal text-slate-800 mb-1">{action.title}</h4>
                            <p className="text-sm text-slate-500 leading-relaxed mb-4 font-light">{action.description}</p>
                            <div className="flex items-center text-blue-600 font-normal text-sm mt-auto">
                                Acessar área
                                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </button>
                    ))}
                </div>
            </div>

            {/* Rodapé Info */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center rounded-3xl">
                <p className="text-xs font-normal text-slate-400 uppercase tracking-widest font-light">
                    Portal de Administração InnerWorks Tecnologia
                </p>
            </div>
        </div>
    );
};

export default DashAdmin;
