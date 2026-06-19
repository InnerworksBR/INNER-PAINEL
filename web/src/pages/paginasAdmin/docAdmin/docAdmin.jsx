import React, { useState, useRef, useEffect } from 'react';
import { FileText, CloudUpload, ChevronDown, Download, Trash2, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';

const DocAdmin = () => {
    const { companies } = useCompanies();
    const fileInputRef = useRef(null);

    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('Todas as Categorias');
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');
    const [actionMessage, setActionMessage] = useState(null);

    const fetchDocs = async () => {
        try {
            const res = await api.get('/admin/docs');
            setDocs(res.data);
        } catch (err) {
            console.error('Erro ao buscar documentos', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDocs();
    }, []);

    const categories = ['Contratos', 'Diagramas', 'Inventários', 'SLAs', 'Políticas', 'Manuais', 'Procedimentos', 'Relatórios', 'Técnico', 'Segurança'];

    // Upload REAL com Supabase Storage via multipart
    const handleFileUpload = async (files) => {
        if (!files || files.length === 0) return;

        if (selectedCompanyId === 'all') {
            setActionMessage({ type: 'warning', text: 'Selecione uma empresa específica para enviar documentos.' });
            setTimeout(() => setActionMessage(null), 4000);
            return;
        }

        setUploading(true);
        setUploadProgress(`Enviando ${files.length} arquivo(s)...`);

        const category = selectedCategory === 'Todas as Categorias' ? 'Outros' : selectedCategory;

        try {
            const formData = new FormData();
            formData.append('company_id', selectedCompanyId);
            formData.append('category', category);

            for (let i = 0; i < files.length; i++) {
                formData.append('files', files[i]);
            }

            const response = await api.post('/admin/docs/upload', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });

            setUploadProgress(`✅ ${response.data.count} arquivo(s) enviado(s) com sucesso!`);
            await fetchDocs();

            // Limpar progresso após 3 segundos
            setTimeout(() => {
                setUploadProgress('');
            }, 3000);
        } catch (err) {
            console.error('Erro no upload:', err);
            setUploadProgress('❌ Falha no upload: ' + (err.response?.data?.error || err.message));
            setTimeout(() => setUploadProgress(''), 5000);
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        handleFileUpload(e.dataTransfer.files);
    };

    // Download real com URL assinada
    const handleDownload = async (doc) => {
        if (!doc.file_url || doc.file_url === 'storage_pendente') {
            setActionMessage({ type: 'error', text: 'Documento possui apenas registro lógico — arquivo não disponível.' });
            setTimeout(() => setActionMessage(null), 4000);
            return;
        }

        try {
            const res = await api.get(`/admin/docs/${doc.id}/download`);
            window.open(res.data.url, '_blank');
        } catch (err) {
            console.error('Erro ao gerar download:', err);
            setActionMessage({ type: 'error', text: 'Falha ao gerar link de download.' });
            setTimeout(() => setActionMessage(null), 4000);
        }
    };

    const handleDelete = async (docId) => {
        if (window.confirm('Tem certeza que deseja excluir este documento? O arquivo será removido permanentemente.')) {
            try {
                await api.delete(`/admin/docs/${docId}`);
                await fetchDocs();
            } catch (err) {
                console.error('Falha ao excluir', err);
                alert('Erro: ' + (err.response?.data?.error || err.message));
            }
        }
    };

    const displayedCompanies = selectedCompanyId === 'all'
        ? companies
        : companies.filter(c => c.id === selectedCompanyId);

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 font-admin">
            {/* Topo da página */}
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Documentação Técnica</h1>
                <p className="text-slate-500 text-lg font-normal font-light">Gestão e armazenamento de documentos técnicos</p>
            </div>

            {/* Área de Upload (Drag and Drop) */}
            <div
                onDragOver={onDragOver}
                onDrop={onDrop}
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`bg-white p-2 rounded-3xl border-2 border-dashed transition-all duration-300 group cursor-pointer ${uploading
                    ? 'border-blue-400 bg-blue-50/30'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                />
                <div className="flex flex-col items-center justify-center py-12 px-6 space-y-4">
                    {uploading ? (
                        <RefreshCw size={40} className="text-blue-600 animate-spin" />
                    ) : (
                        <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                            <CloudUpload size={40} strokeWidth={1.5} />
                        </div>
                    )}
                    <div className="text-center">
                        {actionMessage && (
                            <div className={actionMessage.type === 'error'
                                ? 'p-3 rounded-xl bg-red-50 text-red-700 text-sm mb-2'
                                : 'p-3 rounded-xl bg-amber-50 text-amber-700 text-sm mb-2'}>
                                {actionMessage.text}
                            </div>
                        )}
                        {uploadProgress ? (
                            <p className="text-lg font-medium text-blue-700">{uploadProgress}</p>
                        ) : (
                            <>
                                <p className="text-xl font-normal text-slate-800">
                                    Arraste arquivos aqui ou clique para fazer upload
                                </p>
                                <p className="text-sm text-slate-500 mt-2 font-light">
                                    {selectedCompanyId !== 'all'
                                        ? `Os arquivos serão enviados para o Supabase Storage e associados à empresa selecionada`
                                        : 'Selecione uma empresa abaixo para organizar seus arquivos'}
                                </p>
                                <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-light">
                                    Upload real via Supabase Storage • Max 50MB por arquivo
                                </p>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Seção de Documentos */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
                    <h2 className="text-2xl font-normal text-slate-800">Repositório Digital</h2>
                    <div className="flex flex-wrap gap-3">
                        <div className="relative">
                            <select value={selectedCompanyId} onChange={(e) => setSelectedCompanyId(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm">
                                <option value="all">Todas as Empresas</option>
                                {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                        <div className="relative">
                            <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm">
                                <option>Todas as Categorias</option>
                                {categories.map(cat => <option key={cat}>{cat}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-slate-50/80 border-b border-slate-100">
                            <tr>
                                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">Arquivo</th>
                                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">Categoria</th>
                                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">Status</th>
                                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest font-light">Data</th>
                                <th className="px-6 py-4 text-xs text-slate-500 uppercase tracking-widest text-right font-light">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-light">
                            {displayedCompanies.map((company) => {
                                const companyDocs = docs.filter(doc =>
                                    doc.company_id === company.id &&
                                    (selectedCategory === 'Todas as Categorias' || doc.category === selectedCategory)
                                );
                                if (companyDocs.length === 0) return null;

                                return (
                                    <React.Fragment key={company.id}>
                                        <tr className="bg-slate-50/30">
                                            <td colSpan="5" className="px-6 py-2.5 text-[10px] font-normal text-blue-600 uppercase tracking-[0.2em] border-y border-slate-100">
                                                {company.name}
                                            </td>
                                        </tr>
                                        {companyDocs.map((doc) => (
                                            <tr key={doc.id} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-white group-hover:text-blue-600 transition-colors">
                                                            <FileText size={18} />
                                                        </div>
                                                        <span className="font-normal text-slate-800 text-sm">{doc.title}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-normal uppercase tracking-wider">
                                                        {doc.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${doc.file_url && doc.file_url !== 'storage_pendente'
                                                        ? 'bg-emerald-50 text-emerald-700'
                                                        : 'bg-amber-50 text-amber-700'
                                                        }`}>
                                                        {doc.file_url && doc.file_url !== 'storage_pendente' ? (
                                                            <><Check size={10} /> Armazenado</>
                                                        ) : (
                                                            'Apenas registro'
                                                        )}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-normal text-slate-500">
                                                    {new Date(doc.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <button
                                                            onClick={() => handleDownload(doc)}
                                                            className={`p-2 rounded-lg transition-all ${doc.file_url && doc.file_url !== 'storage_pendente'
                                                                ? 'text-slate-400 hover:text-blue-600 hover:bg-white'
                                                                : 'text-slate-300 cursor-not-allowed'
                                                                }`}
                                                            title={doc.file_url && doc.file_url !== 'storage_pendente' ? 'Baixar' : 'Arquivo não disponível'}
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        <button onClick={() => handleDelete(doc.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all" title="Excluir">
                                                            <Trash2 size={18} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>

                    {!loading && displayedCompanies.every(c => docs.filter(d => d.company_id === c.id && (selectedCategory === 'Todas as Categorias' || d.category === selectedCategory)).length === 0) && (
                        <div className="p-20 text-center space-y-3">
                            <div className="flex justify-center text-slate-200">
                                <AlertCircle size={48} strokeWidth={1} />
                            </div>
                            <p className="text-slate-400 font-normal">Nenhum documento encontrado.</p>
                        </div>
                    )}
                </div>
            </div>

        </div>
    );
};

export default DocAdmin;
