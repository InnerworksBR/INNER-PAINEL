<<<<<<< HEAD
import React, { useState, useRef, useEffect } from 'react';
import { FileText, CloudUpload, ChevronDown, Download, Trash2, AlertCircle, RefreshCw, Check } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
import api from '../../../services/api';
=======
import React, { useState, useRef } from 'react';
import { FileText, CloudUpload, Search, ChevronDown, Download, Trash2, MoreHorizontal, Check, AlertCircle } from 'lucide-react';
import { useCompanies } from '../../../context/CompanyContext';
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77

const DocAdmin = () => {
    const { companies } = useCompanies();
    const fileInputRef = useRef(null);

<<<<<<< HEAD
    const [selectedCompanyId, setSelectedCompanyId] = useState('all');
    const [selectedCategory, setSelectedCategory] = useState('Todas as Categorias');
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState('');

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
            alert('Por favor, selecione uma empresa específica para fazer upload de documentos.');
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
=======
    // Estado para os filtros
    const [selectedCompany, setSelectedCompany] = useState('Todas as Empresas');
    const [selectedCategory, setSelectedCategory] = useState('Todas as Categorias');

    // Estado para os documentos (convertido de mock para state)
    const [documentsData, setDocumentsData] = useState({
        'ABRAHY': [
            { id: 1, name: 'Contrato_Prestacao_Servicos.pdf', category: 'Contratos', date: '11/03/2026', responsible: 'Ricardo Souza', size: '2.4 MB' },
            { id: 2, name: 'Manual_Operacional_V1.docx', category: 'Técnico', date: '10/03/2026', responsible: 'Ana Paula', size: '1.8 MB' }
        ],
        'SUSTENTS': [
            { id: 3, name: 'Relatorio_Sustentabilidade_2025.pdf', category: 'Relatórios', date: '09/03/2026', responsible: 'Marcos Lima', size: '4.2 MB' },
            { id: 4, name: 'Inventario_Ativos_TI.xlsx', category: 'Ativos', date: '08/03/2026', responsible: 'Carla Dias', size: '850 KB' }
        ],
        'ROCHA': [
            { id: 5, name: 'Politica_Seguranca_Informacao.pdf', category: 'Segurança', date: '07/03/2026', responsible: 'Julio Cesar', size: '1.2 MB' }
        ],
        'CARPOLOG': [
            { id: 6, name: 'Fluxograma_Logistica_Interna.png', category: 'Processos', date: '06/03/2026', responsible: 'Fernanda Lima', size: '3.1 MB' }
        ]
    });

    const [activeMenuDocId, setActiveMenuDocId] = useState(null);

    const categories = ['Contratos', 'Técnico', 'Relatórios', 'Processos', 'Segurança', 'Ativos'];

    // Lógica de filtragem
    const companyNames = companies.map(c => c.name);
    const filteredCompanyNames = selectedCompany === 'Todas as Empresas'
        ? companyNames
        : [selectedCompany];

    // Formatar tamanho do arquivo
    const formatFileSize = (bytes) => {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    };

    // Lógica de Upload
    const handleFileUpload = (files) => {
        if (!files || files.length === 0) return;

        const targetCompany = selectedCompany === 'Todas as Empresas' ? (companyNames[0] || 'Geral') : selectedCompany;
        const today = new Date().toLocaleDateString('pt-BR');

        const newDocs = Array.from(files).map((file, index) => ({
            id: Date.now() + index,
            name: file.name,
            category: selectedCategory === 'Todas as Categorias' ? 'Outros' : selectedCategory,
            date: today,
            responsible: 'Administrador', // usuário logado
            size: formatFileSize(file.size),
            file: file // Guarda a referência do arquivo para download real
        }));

        setDocumentsData(prev => ({
            ...prev,
            [targetCompany]: [...(prev[targetCompany] || []), ...newDocs]
        }));

        // Notificação visual simples (opcional, pode ser melhorada com um toast)
        console.log(`${files.length} arquivo(s) adicionado(s) à empresa ${targetCompany}`);
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
    };

    const onDragOver = (e) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const onDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
<<<<<<< HEAD
        handleFileUpload(e.dataTransfer.files);
    };

    // Download real com URL assinada
    const handleDownload = async (doc) => {
        if (!doc.file_url || doc.file_url === 'storage_pendente') {
            alert('Este documento possui apenas registro lógico — arquivo não disponível para download.');
            return;
        }

        try {
            const res = await api.get(`/admin/docs/${doc.id}/download`);
            window.open(res.data.url, '_blank');
        } catch (err) {
            console.error('Erro ao gerar download:', err);
            alert('Falha ao gerar link de download: ' + (err.response?.data?.error || err.message));
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
=======
        const files = e.dataTransfer.files;
        handleFileUpload(files);
    };

    const handleDelete = (company, docId) => {
        if (window.confirm('Tem certeza que deseja excluir este documento?')) {
            setDocumentsData(prev => ({
                ...prev,
                [company]: prev[company].filter(d => d.id !== docId)
            }));
            setActiveMenuDocId(null);
        }
    };

    const handleDownload = (doc) => {
        let url;
        let filename = doc.name;

        if (doc.file) {
            // Se for um arquivo real enviado no upload
            url = URL.createObjectURL(doc.file);
        } else {
            // Se for mock, cria um arquivo dummy
            const dummyContent = `Conteúdo simulado para o arquivo: ${doc.name}`;
            const blob = new Blob([dummyContent], { type: 'text/plain' });
            url = URL.createObjectURL(blob);
            if (!filename.endsWith('.txt')) filename += '.txt';
        }

        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    const handleRename = (company, docId, currentName) => {
        const newName = window.prompt('Digite o novo nome para o arquivo:', currentName);
        if (newName && newName !== currentName) {
            setDocumentsData(prev => ({
                ...prev,
                [company]: prev[company].map(d => d.id === docId ? { ...d, name: newName } : d)
            }));
        }
        setActiveMenuDocId(null);
    };

    const handleChangeCategory = (company, docId) => {
        const newCategory = window.prompt(`Escolha a nova categoria:\n${categories.join(', ')}`);
        if (newCategory && categories.includes(newCategory)) {
            setDocumentsData(prev => ({
                ...prev,
                [company]: prev[company].map(d => d.id === docId ? { ...d, category: newCategory } : d)
            }));
        }
        setActiveMenuDocId(null);
    };

    return (
        <div className="max-w-7xl mx-auto space-y-10 animate-in fade-in duration-500 pb-12 font-admin">
            {/* Topo da página */}
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
            <div className="flex flex-col gap-1">
                <h1 className="text-4xl font-normal text-slate-900 tracking-tight">Documentação Técnica</h1>
                <p className="text-slate-500 text-lg font-normal font-light">Gestão e armazenamento de documentos técnicos</p>
            </div>

            {/* Área de Upload (Drag and Drop) */}
            <div
                onDragOver={onDragOver}
                onDrop={onDrop}
<<<<<<< HEAD
                onClick={() => !uploading && fileInputRef.current?.click()}
                className={`bg-white p-2 rounded-3xl border-2 border-dashed transition-all duration-300 group cursor-pointer ${uploading
                    ? 'border-blue-400 bg-blue-50/30'
                    : 'border-slate-200 hover:border-blue-400 hover:bg-blue-50/30'
                    }`}
=======
                onClick={() => fileInputRef.current?.click()}
                className="bg-white p-2 rounded-3xl border-2 border-dashed border-slate-200 hover:border-blue-400 hover:bg-blue-50/30 transition-all duration-300 group cursor-pointer"
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    multiple
                    className="hidden"
                    onChange={(e) => handleFileUpload(e.target.files)}
                />
                <div className="flex flex-col items-center justify-center py-12 px-6 space-y-4">
<<<<<<< HEAD
                    {uploading ? (
                        <RefreshCw size={40} className="text-blue-600 animate-spin" />
                    ) : (
                        <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                            <CloudUpload size={40} strokeWidth={1.5} />
                        </div>
                    )}
                    <div className="text-center">
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
=======
                    <div className="p-5 bg-blue-50 text-blue-600 rounded-2xl group-hover:scale-110 transition-transform duration-300">
                        <CloudUpload size={40} strokeWidth={1.5} />
                    </div>
                    <div className="text-center">
                        <p className="text-xl font-normal text-slate-800">Arraste arquivos aqui ou clique para fazer upload</p>
                        <p className="text-sm text-slate-500 mt-2 font-light">
                            {selectedCompany !== 'Todas as Empresas'
                                ? `Os arquivos serão associados à empresa ${selectedCompany}`
                                : 'Selecione uma empresa abaixo para organizar seus arquivos'}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-4 uppercase tracking-widest font-light">Formatos: PDF, DOCX, XLSX, PNG (Máx. 10MB)</p>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                    </div>
                </div>
            </div>

            {/* Seção de Documentos */}
            <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-hidden">
                <div className="p-6 border-b border-slate-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-slate-50/30">
                    <h2 className="text-2xl font-normal text-slate-800">Repositório Digital</h2>
<<<<<<< HEAD
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
=======

                    <div className="flex flex-wrap gap-3">
                        <div className="relative">
                            <select
                                value={selectedCompany}
                                onChange={(e) => setSelectedCompany(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-normal text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm font-light"
                            >
                                <option>Todas as Empresas</option>
                                {companyNames.map(c => <option key={c}>{c}</option>)}
                            </select>
                            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" size={16} />
                        </div>

                        <div className="relative">
                            <select
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                                className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2.5 pr-10 text-sm font-normal text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/20 cursor-pointer shadow-sm font-light"
                            >
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
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
<<<<<<< HEAD
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
=======
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Arquivo</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Categoria</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Empresa</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Data</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Autor</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest font-light">Tamanho</th>
                                <th className="px-6 py-4 text-xs font-normal text-slate-500 uppercase tracking-widest text-right font-light">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-light">
                            {filteredCompanyNames.map((company) => {
                                const companyDocs = (documentsData[company] || []).filter(doc =>
                                    selectedCategory === 'Todas as Categorias' || doc.category === selectedCategory
                                );

                                if (companyDocs.length === 0) return null;

                                return (
                                    <React.Fragment key={company}>
                                        <tr className="bg-slate-50/30">
                                            <td colSpan="7" className="px-6 py-2.5 text-[10px] font-normal text-blue-600 uppercase tracking-[0.2em] border-y border-slate-100">
                                                {company}
                                            </td>
                                        </tr>

>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                                        {companyDocs.map((doc) => (
                                            <tr key={doc.id} className="hover:bg-blue-50/20 transition-colors group">
                                                <td className="px-6 py-5">
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-slate-100 text-slate-500 rounded-lg group-hover:bg-white group-hover:text-blue-600 transition-colors">
                                                            <FileText size={18} />
                                                        </div>
<<<<<<< HEAD
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
=======
                                                        <span className="font-normal text-slate-800 text-sm">{doc.name}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-5">
                                                    <span className="inline-flex px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[10px] font-normal uppercase tracking-wider group-hover:bg-white transition-colors">
                                                        {doc.category}
                                                    </span>
                                                </td>
                                                <td className="px-6 py-5 text-sm font-normal text-slate-600">{company}</td>
                                                <td className="px-6 py-5 text-sm font-normal text-slate-500">{doc.date}</td>
                                                <td className="px-6 py-5 text-sm font-normal text-slate-600">{doc.responsible}</td>
                                                <td className="px-6 py-5 text-sm font-normal text-slate-400 italic font-light">{doc.size}</td>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                                                <td className="px-6 py-5 text-right">
                                                    <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                                        <button
                                                            onClick={() => handleDownload(doc)}
<<<<<<< HEAD
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
=======
                                                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-white rounded-lg transition-all"
                                                            title="Baixar"
                                                        >
                                                            <Download size={18} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(company, doc.id)}
                                                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-white rounded-lg transition-all"
                                                            title="Excluir"
                                                        >
                                                            <Trash2 size={18} />
                                                        </button>

                                                        <div className="relative">
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    setActiveMenuDocId(activeMenuDocId === doc.id ? null : doc.id);
                                                                }}
                                                                className={`p-2 rounded-lg transition-all ${activeMenuDocId === doc.id ? 'text-blue-600 bg-white' : 'text-slate-400 hover:text-slate-600 hover:bg-white'}`}
                                                            >
                                                                <MoreHorizontal size={18} />
                                                            </button>

                                                            {activeMenuDocId === doc.id && (
                                                                <>
                                                                    <div
                                                                        className="fixed inset-0 z-10"
                                                                        onClick={() => setActiveMenuDocId(null)}
                                                                    ></div>
                                                                    <div className="absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-lg border border-slate-100 py-1 z-20 animate-in fade-in zoom-in duration-150">
                                                                        <button
                                                                            onClick={() => handleRename(company, doc.id, doc.name)}
                                                                            className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                                        >
                                                                            <FileText size={14} className="text-slate-400" />
                                                                            Renomear
                                                                        </button>
                                                                        <button
                                                                            onClick={() => handleChangeCategory(company, doc.id)}
                                                                            className="w-full text-left px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 flex items-center gap-2"
                                                                        >
                                                                            <ChevronDown size={14} className="text-slate-400" />
                                                                            Mudar Categoria
                                                                        </button>
                                                                        <div className="h-px bg-slate-100 my-1"></div>
                                                                        <button
                                                                            onClick={() => handleDelete(company, doc.id)}
                                                                            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"
                                                                        >
                                                                            <Trash2 size={14} className="text-red-400" />
                                                                            Excluir Documento
                                                                        </button>
                                                                    </div>
                                                                </>
                                                            )}
                                                        </div>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
<<<<<<< HEAD

                    {!loading && displayedCompanies.every(c => docs.filter(d => d.company_id === c.id && (selectedCategory === 'Todas as Categorias' || d.category === selectedCategory)).length === 0) && (
=======
                    {filteredCompanyNames.every(c => (documentsData[c] || []).length === 0) && (
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                        <div className="p-20 text-center space-y-3">
                            <div className="flex justify-center text-slate-200">
                                <AlertCircle size={48} strokeWidth={1} />
                            </div>
<<<<<<< HEAD
                            <p className="text-slate-400 font-normal">Nenhum documento encontrado.</p>
=======
                            <p className="text-slate-400 font-normal">Nenhum documento encontrado para os filtros aplicados.</p>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
                        </div>
                    )}
                </div>
            </div>
<<<<<<< HEAD
=======

            {/* Info de Rodapé */}
            <div className="p-6 bg-slate-50/50 border-t border-slate-100 text-center rounded-3xl">
                <p className="text-[10px] font-normal text-slate-400 uppercase tracking-widest leading-loose font-light">
                    InnerWorks Cloud Storage - Gestão de Ativos Digitais
                </p>
            </div>
>>>>>>> 4eaab92d87a14e7a6d44c5fe62cb9ae2a3ea8c77
        </div>
    );
};

export default DocAdmin;
