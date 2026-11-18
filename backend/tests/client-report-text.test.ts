import test from 'node:test';
import assert from 'node:assert/strict';
import { clientReportText } from '../src/services/client-report-text';

test('removes action sections from previously saved reports without changing their source', () => {
  const input = 'Panorama do atendimento\nForam registrados 12 chamados.\n\nRecomendações:\nRecomendamos revisar os acessos.\n- Implementar treinamento.\n\n### Situação dos chamados\nHá 3 chamados pendentes.';
  const output = clientReportText(input);
  assert.match(output, /Foram registrados 12 chamados/);
  assert.match(output, /Há 3 chamados pendentes/);
  assert.doesNotMatch(output, /recomenda|treinamento/i);
  assert.match(input, /Recomendações/);
});

test('removes action sentences from mixed factual paragraphs', () => {
  const output = clientReportText('Foram solucionados 8 chamados. Recomendamos revisar os acessos. Permanecem 2 chamados pendentes.');
  assert.match(output, /Foram solucionados 8 chamados/);
  assert.match(output, /Permanecem 2 chamados pendentes/);
  assert.doesNotMatch(output, /Recomendamos/);
});

test('removes numbered action headings while preserving subsequent factual sections', () => {
  const output = clientReportText('Os chamados foram acompanhados.\n\n3. Sugestão de melhoria\nRevisar as permissões.\n\n### Visão geral\nHá 2 chamados pendentes.');
  assert.match(output, /Os chamados foram acompanhados/);
  assert.match(output, /Há 2 chamados pendentes/);
  assert.doesNotMatch(output, /Sugestão|Revisar/);
});

test('keeps completed work and later factual details', () => {
  const input = 'Resumo\nForam abertos 10 chamados.\n\nAções realizadas\nA equipe solucionou 8 chamados.\n\nDetalhes por categoria\nHá 2 chamados pendentes.';
  const output = clientReportText(input);
  assert.match(output, /solucionou 8 chamados/);
  assert.match(output, /Há 2 chamados pendentes/);
});

test('removes first-person suggestions and proposals from factual paragraphs', () => {
  const output = clientReportText('Foram registrados 4 chamados. Sugiro revisar os acessos. É importante realizar treinamento.');
  assert.match(output, /Foram registrados 4 chamados/);
  assert.doesNotMatch(output, /Sugiro|treinamento/);
});

test('keeps factual categories after a recommendation section', () => {
  const output = clientReportText('Resumo\nForam registrados 10 chamados.\n\nRecomendações\nRevisar acessos.\n\nCategorias\n5 chamados eram de rede.');
  assert.match(output, /5 chamados eram de rede/);
  assert.doesNotMatch(output, /Revisar acessos/);
});

test('removes additional suggestions without losing preceding facts', () => {
  const output = clientReportText('Foram registrados 4 chamados, e é importante realizar treinamento. Considere revisar os acessos. É aconselhável monitorar os incidentes.');
  assert.match(output, /Foram registrados 4 chamados/);
  assert.doesNotMatch(output, /treinamento|Considere|aconselhável/);
});
