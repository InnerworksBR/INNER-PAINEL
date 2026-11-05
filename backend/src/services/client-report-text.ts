const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
const actionHeading = /^(?:(?:recomendac(?:ao|oes)|sugest(?:ao|oes)|proximos passos|proximas etapas|plano de acao|o que fazer|melhorias recomendadas)\b|ac(?:ao|oes)(?:\s+(?:recomendad[ao]s?|necessari[ao]s?|sugerid[ao]s?|futur[ao]s?|a realizar)\b|\s*:?\s*$))/;
const actionSentence = /\b(?:recomendamos|recomendo|recomenda-se|recomendavel|sugerimos|sugiro|sugere-se|orientamos|orienta-se|aconselhamos|aconselho|considere|e aconselhavel|deve(?:m|ria|riam)? ser|e (?:necessario|importante) (?:realizar|revisar|implementar|verificar|avaliar)|proximos passos|plano de acao)\b/;
const safeHeading = /^(?:resumo|panorama|visao geral|situacao (?:dos chamados|do atendimento)|atendimento no periodo|chamados pendentes|acoes realizadas|categorias|prioridades|detalhes por categoria|indicadores)\s*:?$/;

/** Preserva o original no banco e oculta instruções de relatórios antigos na apresentação ao cliente. */
export function clientReportText(text: string): string {
  let skipping = false;
  const output: string[] = [];
  for (const line of String(text || '').replace(/\r\n/g, '\n').split('\n')) {
    const cleaned = line.trim().replace(/^#{1,6}\s*/, '').replace(/^(?:\d+[.)]|[-*])\s+/, '').replace(/^\*\*/, '').replace(/\*\*:?$/, '').trim();
    const normalized = normalize(cleaned);
    if (actionHeading.test(normalized)) { skipping = true; continue; }
    if (skipping && (/^#{1,6}\s+/.test(line.trim()) || safeHeading.test(normalized))) skipping = false;
    if (skipping) continue;
    const sentences = line.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ú])/u).flatMap(sentence => {
      if (!actionSentence.test(normalize(sentence))) return [sentence];
      const parts = sentence.split(/,\s+(?:e\s+)?(?=[a-zà-ú])/iu);
      const firstAction = parts.findIndex(part => actionSentence.test(normalize(part)));
      const factualPrefix = firstAction > 0 ? parts.slice(0, firstAction).join(', ').trim() : '';
      return factualPrefix ? [`${factualPrefix.replace(/[.,;:]$/, '')}.`] : [];
    });
    if (sentences.length) output.push(sentences.join(' '));
  }
  return output.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
