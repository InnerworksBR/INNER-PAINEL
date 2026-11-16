const textNodes = {
  paragraph: 'paragraph',
  heading: 'articleHeading',
};

function textNode(type, text) {
  return { type, content: text ? [{ type: 'text', text }] : [] };
}

export function articleDocument(blocks) {
  const content = blocks.map(block => {
    if (block.type === 'image') {
      return { type: 'articleImage', attrs: { mediaId: block.mediaId, alt: block.alt } };
    }
    if (block.type === 'list') {
      const items = block.items.length ? block.items : [''];
      return {
        type: block.ordered ? 'orderedList' : 'bulletList',
        content: items.map(item => ({ type: 'listItem', content: [textNode('paragraph', item)] })),
      };
    }
    if (block.type === 'quote') return { type: 'articleQuote', content: [textNode('paragraph', block.text)] };
    return textNode(textNodes[block.type], block.text);
  });
  if (!content.length) content.push(textNode('paragraph', ''));
  if (content.at(-1).type === 'articleImage') {
    content.push({ type: 'paragraph', attrs: { continuation: true } });
  }
  return { type: 'doc', content };
}

function readText(node) {
  return node.textBetween(0, node.content.size, '\n', '\n');
}

export function articleBlocks(document) {
  if (document.childCount === 1 && document.firstChild.type.name === 'paragraph' && !document.firstChild.content.size) {
    return [];
  }

  const blocks = [];
  document.forEach((node, _offset, index) => {
    switch (node.type.name) {
      case 'articleImage':
        blocks.push({ type: 'image', mediaId: node.attrs.mediaId, alt: node.attrs.alt });
        break;
      case 'orderedList':
      case 'bulletList': {
        const items = [];
        node.forEach(item => items.push(readText(item)));
        blocks.push({ type: 'list', ordered: node.type.name === 'orderedList', items });
        break;
      }
      case 'articleHeading':
        blocks.push({ type: 'heading', text: readText(node) });
        break;
      case 'articleQuote':
        blocks.push({ type: 'quote', text: readText(node) });
        break;
      default:
        if (node.attrs.continuation && !node.content.size && index === document.childCount - 1) break;
        blocks.push({ type: 'paragraph', text: readText(node) });
    }
  });
  return blocks;
}
