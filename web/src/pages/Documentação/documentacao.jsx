import React, { useState } from 'react';
import { Search, Folder, ChevronLeft, ChevronRight, FileText } from 'lucide-react';

const DocumentacaoTecnica = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [category, setCategory] = useState('Todas');

  const categoriesList = [
    'Contratos', 'Diagramas', 'Inventários', 'SLAs', 'Políticas', 'Manuais', 'Procedimentos'
  ];

  const documents = [
    { id: 1, name: 'Contrato_Prestacao_Servicos_ABRAHY.pdf', category: 'Contratos', company: 'ABRAHY' },
    { id: 2, name: 'Diagrama_Rede_Sustents_V2.pdf', category: 'Diagramas', company: 'SUSTENTS' },
    { id: 3, name: 'Inventario_Ativos_TI_Rocha.xlsx', category: 'Inventários', company: 'ROCHA' },
    { id: 4, name: 'SLA_Servicos_Cloud_Carpolog.pdf', category: 'SLAs', company: 'CARPOLOG' },
    { id: 5, name: 'Politica_Seguranca_Informacao.pdf', category: 'Políticas', company: 'ABRAHY' },
    { id: 6, name: 'Manual_Usuario_Sistema.docx', category: 'Manuais', company: 'SUSTENTS' },
    { id: 7, name: 'Procedimento_Backup_Semanal.pdf', category: 'Procedimentos', company: 'ROCHA' },
    { id: 8, name: 'Contrato_Manutencao_Hardware.pdf', category: 'Contratos', company: 'SUSTENTS' },
  ];

  // Cálculo dinâmico de contagem por categoria
  const categoriesWithCounts = categoriesList.map(catName => ({
    name: catName,
    count: documents.filter(doc => doc.category === catName).length
  }));

  // Lógica de Filtragem
  const filteredDocuments = documents.filter(doc => {
    const matchesSearch = doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         doc.company.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = category === 'Todas' || doc.category === category;
    return matchesSearch && matchesCategory;
  });

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
            placeholder="Buscar documentos por nome ou empresa..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow outline-none shadow-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-64">
          <select
            className="w-full px-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent cursor-pointer text-gray-700 shadow-sm"
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
              >
                <div className="flex items-center space-x-3">
                  <FileText className="w-5 h-5 text-gray-300 group-hover:text-blue-500 transition-colors" />
                  <div className="flex flex-col">
                    <span className="font-medium text-gray-700 group-hover:text-blue-600 transition-colors">{doc.name}</span>
                    <span className="text-xs text-gray-400 uppercase tracking-wider">{doc.company} • {doc.category}</span>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="p-12 text-center">
              <p className="text-gray-400">Nenhum documento encontrado para estes filtros.</p>
            </div>
          )}
        </div>

        {/* Rodapé e Paginação */}
        <div className="p-4 sm:p-5 border-t border-gray-100 bg-gray-50 flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-sm text-gray-600">
            Mostrando {filteredDocuments.length} de {documents.length} resultados
          </span>

          <div className="flex items-center space-x-2">
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm">
              <ChevronLeft className="w-4 h-4" />
              <span>Anterior</span>
            </button>
            <span className="px-3.5 py-1.5 bg-blue-50 border border-blue-100 text-blue-600 rounded-md text-sm font-medium shadow-sm">
              1
            </span>
            <button className="px-3 py-1.5 bg-white border border-gray-200 rounded-md text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors flex items-center gap-1 disabled:opacity-50 shadow-sm">
              <span>Próximo</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentacaoTecnica;