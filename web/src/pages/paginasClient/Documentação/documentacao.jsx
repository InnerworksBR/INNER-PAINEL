import React, { useState, useEffect } from 'react';
import { Search, Folder, ChevronLeft, ChevronRight, FileText, RefreshCw, Download } from 'lucide-react';
import api from '../../../services/api';
import { useClientRequestConfig } from '../../../context/ClientPreviewContext';

const DocumentacaoTecnica = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('Todas');
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const requestConfig = useClientRequestConfig();

  const categoriesList = [
    'Contratos', 'Diagramas', 'Inventários', 'SLAs', 'Políticas', 'Manuais', 'Procedimentos'
  ];

  useEffect(() => {
    const fetchDocs = async () => {
      try {
        const response = await api.get('/client/docs', requestConfig);
        setDocuments(response.data);
      } catch (error) {
        console.error('Error fetching documents:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchDocs();
  }, [requestConfig]);

  // Cálculo dinâmico de contagem por categoria
  const categoriesWithCounts = categoriesList.map(catName => ({
    name: catName,
    count: documents.filter(doc => doc.category === catName).length
  }));

  // Lógica de Filtragem
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.title.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === 'Todas' || doc.category === category;
    return matchesSearch && matchesCategory;
  });

  const handleDownload = async (doc) => {
    if (!doc.file_url || doc.file_url === 'storage_pendente') {
      alert('Arquivo não disponível para download.');
      return;
    }
    try {
      const res = await api.get(`/client/docs/${doc.id}/download`, requestConfig);
      window.open(res.data.url, '_blank');
    } catch (error) {
      console.error('Erro ao gerar link de download:', error);
      alert('Falha ao baixar o arquivo: ' + (error.response?.data?.error || error.message));
    }
  };

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        <span className="ml-3 text-gray-500 font-medium">Carregando central de documentos...</span>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 space-y-6">
      {/* Cabeçalho da página */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Documentação Técnica</h1>
        <p className="text-gray-500 mt-1">Contratos e documentos do ambiente de TI</p>
      </div>

      {/* Barra de busca e filtro */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Buscar documentos por título..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer text-gray-700 shadow-sm"
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          >
            <option value="Todas">Todas as Categorias</option>
            {categoriesList.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Seção de categorias de documentos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {categoriesWithCounts.map((cat) => (
          <div
            key={cat.name}
            onClick={() => setCategory(category === cat.name ? 'Todas' : cat.name)}
            className={`p-4 rounded-xl border transition-all cursor-pointer flex items-center space-x-4 ${
              category === cat.name 
              ? 'bg-blue-50 border-blue-200 shadow-md ring-1 ring-blue-500/20' 
              : 'bg-white border-gray-100 shadow-sm hover:shadow-md hover:border-blue-100'
            }`}
          >
            <div className={`p-3 rounded-lg flex-shrink-0 ${
              category === cat.name ? 'bg-blue-600 text-white' : 'bg-blue-50 text-blue-600'
            }`}>
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h3 className={`font-semibold ${category === cat.name ? 'text-blue-900' : 'text-gray-800'}`}>{cat.name}</h3>
              <p className={`text-sm ${category === cat.name ? 'text-blue-600' : 'text-gray-500'}`}>
                {cat.count} {cat.count === 1 ? 'arquivo' : 'arquivos'}
              </p>
            </div>
          </div>
        ))}
      </div>

      {/* Seção de listagem de documentos */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col">
        <div className="p-5 sm:p-6 border-b border-gray-100 flex justify-between items-center">
          <div>
            <h2 className="text-lg font-bold text-gray-800">Documentos Disponíveis</h2>
            <p className="text-sm text-gray-500 mt-1">{filteredDocuments.length} arquivos encontrados</p>
          </div>
        </div>

        <div className="divide-y divide-gray-100">
          {filteredDocuments.length > 0 ? (
            filteredDocuments.map((doc) => (
              <div
                key={doc.id}
                className="p-4 px-5 sm:px-6 hover:bg-gray-50 transition-colors flex items-center justify-between cursor-pointer group"
                onClick={() => handleDownload(doc)}
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{doc.title}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider">{doc.category} • Adicionado em {new Date(doc.created_at).toLocaleDateString()}</span>
                  </div>
                </div>
                {doc.file_url && (
                  <Download className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                )}
              </div>

            ))
          ) : (
            <div className="p-12 text-center text-gray-400">
              Nenhum documento encontrado para estes filtros.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DocumentacaoTecnica;
