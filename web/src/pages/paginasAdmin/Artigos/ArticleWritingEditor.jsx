import { Extension, Node } from '@tiptap/core';
import { ListItem } from '@tiptap/extension-list';
import { closeHistory } from '@tiptap/pm/history';
import { NodeSelection, Plugin, TextSelection } from '@tiptap/pm/state';
import { EditorContent, NodeViewWrapper, ReactNodeViewRenderer, useEditor, useEditorState } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { GripVertical, Heading, List, ListOrdered, Pilcrow, Quote, Redo2, Trash2, Undo2 } from 'lucide-react';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ImageUpload, ProtectedArticleImage } from './ArticleImages';
import { fieldClass, secondaryButton } from './ArticleUi';
import { ARTICLE_LIMITS } from './articleEditorial';
import { articleBlocks, articleDocument } from './articleWritingDocument';
import './articleWriting.css';

const ImageContext = createContext(null);
const MEDIA_ID = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const toolButton = 'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-sm font-medium text-slate-700 enabled:hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 disabled:opacity-40 aria-pressed:bg-blue-100 aria-pressed:text-blue-900';

function InlineImage({ node, updateAttributes, deleteNode }) {
  const { articleId, disabled, onUpload } = useContext(ImageContext);

  return (
    <NodeViewWrapper as="figure" contentEditable={false} className="rounded-xl border border-slate-200 bg-slate-50 p-3 sm:p-4">
      <ProtectedArticleImage articleId={articleId} media={node.attrs}
        className="mx-auto max-h-80 w-auto max-w-full rounded-lg object-contain" />
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span data-drag-handle={disabled ? undefined : ''} title="Arraste para mover a imagem"
          className={disabled ? 'text-slate-400' : 'cursor-grab rounded-md p-1.5 text-slate-600 active:cursor-grabbing'}
          aria-hidden="true"><GripVertical size={18} /></span>
        <ImageUpload label="Trocar imagem" disabled={disabled}
          onSelect={file => onUpload(file, mediaId => updateAttributes({ mediaId, alt: '' }))} />
        <button type="button" className={secondaryButton} disabled={disabled} onClick={deleteNode}>
          <Trash2 size={15} aria-hidden="true" /> Remover imagem
        </button>
      </div>
      <label className="mt-3 block text-sm font-medium text-slate-800">
        Texto alternativo da imagem
        <input className={fieldClass} maxLength={ARTICLE_LIMITS.alt} value={node.attrs.alt} disabled={disabled}
          onChange={event => updateAttributes({ alt: event.target.value })} />
      </label>
    </NodeViewWrapper>
  );
}

const ArticleImage = Node.create({
  name: 'articleImage',
  group: 'block',
  atom: true,
  draggable: true,
  addAttributes() {
    return {
      mediaId: {
        parseHTML: element => element.getAttribute('data-media-id').toLowerCase(),
        renderHTML: ({ mediaId }) => ({ 'data-media-id': mediaId }),
      },
      alt: {
        default: '',
        parseHTML: element => element.getAttribute('data-alt') ?? '',
        renderHTML: ({ alt }) => ({ 'data-alt': alt }),
      },
    };
  },
  parseHTML() {
    return [{
      tag: 'figure[data-article-id][data-media-id]',
      getAttrs: element => (
        element.getAttribute('data-article-id') === this.options.articleId
        && MEDIA_ID.test(element.getAttribute('data-media-id'))
      ) ? null : false,
    }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['figure', { ...HTMLAttributes, 'data-article-id': this.options.articleId }];
  },
  addNodeView() {
    return ReactNodeViewRenderer(InlineImage);
  },
});

const ArticleHeading = Node.create({
  name: 'articleHeading',
  group: 'block',
  content: 'inline*',
  defining: true,
  parseHTML: () => ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(tag => ({ tag })),
  renderHTML: () => ['h3', 0],
});

const ArticleQuote = Node.create({
  name: 'articleQuote',
  group: 'block',
  content: 'paragraph+',
  defining: true,
  parseHTML: () => [{ tag: 'blockquote' }],
  renderHTML: () => ['blockquote', 0],
});

const ImageContinuation = Extension.create({
  name: 'imageContinuation',
  addGlobalAttributes() {
    return [{ types: ['paragraph'], attributes: { continuation: { default: false, rendered: false } } }];
  },
  addProseMirrorPlugins() {
    return [new Plugin({
      appendTransaction(transactions, _oldState, state) {
        if (state.doc.lastChild?.type.name !== 'articleImage' || !transactions.some(tr => tr.docChanged)) return null;
        const end = state.doc.content.size;
        const tr = state.tr.insert(end, state.schema.nodes.paragraph.create({ continuation: true }));
        if (state.selection instanceof NodeSelection && state.selection.to === end) {
          tr.setSelection(TextSelection.create(tr.doc, end + 1));
        }
        return tr;
      },
    })];
  },
});

const articleExtensions = [
  StarterKit.configure({
    blockquote: false,
    bold: false,
    code: false,
    codeBlock: false,
    heading: false,
    horizontalRule: false,
    italic: false,
    link: false,
    listItem: false,
    strike: false,
    trailingNode: false,
    underline: false,
  }),
  ListItem.extend({ content: 'paragraph' }),
  ArticleHeading,
  ArticleQuote,
  ImageContinuation,
];

function paragraph(chain, editor) {
  if (editor.isActive('listItem')) return chain.liftListItem('listItem');
  if (editor.isActive('articleQuote')) return chain.lift('articleQuote');
  return chain.setParagraph();
}

const formats = [
  { name: 'paragraph', label: 'Parágrafo', icon: Pilcrow, apply: paragraph },
  { name: 'articleHeading', label: 'Subtítulo', icon: Heading, apply: chain => chain.toggleNode('articleHeading', 'paragraph') },
  { name: 'articleQuote', label: 'Citação', icon: Quote, apply: chain => chain.toggleWrap('articleQuote') },
  { name: 'bulletList', label: 'Lista com marcadores', icon: List, apply: chain => chain.toggleBulletList() },
  { name: 'orderedList', label: 'Lista numerada', icon: ListOrdered, apply: chain => chain.toggleOrderedList() },
];

function separateHistory(chain) {
  return chain.command(({ tr }) => {
    closeHistory(tr);
    return true;
  });
}

function FormatButton({ label, icon: Icon, pressed, disabled, showLabel = false, onClick }) {
  return (
    <button type="button" className={toolButton} title={label} aria-label={label} aria-pressed={pressed}
      disabled={disabled} onMouseDown={event => event.preventDefault()} onClick={onClick}>
      <Icon size={18} aria-hidden="true" />
      {showLabel && label}
    </button>
  );
}

function WritingToolbar({ editor, disabled, onUpload, blockCount }) {
  const controls = useEditorState({
    editor,
    selector: ({ editor: current }) => ({
      formats: formats.map(({ name, apply }) => ({
        active: current.isActive(name) && (name !== 'paragraph'
          || (!current.isActive('listItem') && !current.isActive('articleQuote'))),
        available: apply(current.can().chain(), current).run(),
      })),
      undo: current.can().undo(),
      redo: current.can().redo(),
    }),
  });

  function applyFormat(apply) {
    const chain = separateHistory(editor.chain().focus());
    if (apply(chain, editor).run()) editor.view.dispatch(closeHistory(editor.state.tr));
  }

  function insertImage(file) {
    const { $to } = editor.state.selection;
    const position = $to.depth > 1 ? $to.after(1) : $to.pos;
    onUpload(file, mediaId => {
      separateHistory(editor.chain())
        .insertContentAt(position, { type: 'articleImage', attrs: { mediaId, alt: '' } })
        .run();
      editor.view.dispatch(closeHistory(editor.state.tr));
    });
  }

  return (
    <div role="group" aria-label="Formatação do artigo"
      className="flex flex-wrap items-center gap-x-2 gap-y-1 rounded-t-lg border-b border-slate-200 bg-slate-50 p-1.5">
      <div className="flex flex-wrap items-center gap-0.5">
        {formats.map(({ name, label, icon, apply }, index) => (
          <FormatButton key={name} label={label} icon={icon} pressed={controls.formats[index].active}
            disabled={disabled || !controls.formats[index].available} showLabel={name === 'articleHeading'}
            onClick={() => applyFormat(apply)} />
        ))}
      </div>
      <ImageUpload label="Adicionar imagem" className={toolButton} disabled={disabled || blockCount >= ARTICLE_LIMITS.blockCount}
        onSelect={insertImage} />
      <div className="flex items-center gap-0.5">
        <FormatButton label="Desfazer" icon={Undo2} disabled={disabled || !controls.undo}
          onClick={() => editor.chain().focus().undo().run()} />
        <FormatButton label="Refazer" icon={Redo2} disabled={disabled || !controls.redo}
          onClick={() => editor.chain().focus().redo().run()} />
      </div>
    </div>
  );
}

export function ArticleWritingEditor({ articleId, blocks, disabled, onUpload, onChange }) {
  const [content] = useState(() => articleDocument(blocks));
  const extensions = useMemo(() => [...articleExtensions, ArticleImage.configure({ articleId })], [articleId]);
  const editorProps = useMemo(() => ({
    attributes: {
      role: 'textbox',
      'aria-label': 'Conteúdo do artigo',
      'aria-multiline': 'true',
      'aria-readonly': String(disabled),
    },
  }), [disabled]);
  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content,
    editable: !disabled,
    editorProps,
    onUpdate: ({ editor: current }) => onChange(articleBlocks(current.state.doc)),
  });

  useEffect(() => {
    editor?.setEditable(!disabled, false);
  }, [editor, disabled]);

  if (!editor) return null;

  const empty = !blocks.length || (blocks.length === 1 && blocks[0].type === 'paragraph' && !blocks[0].text);
  return (
    <ImageContext.Provider value={{ articleId, disabled, onUpload }}>
      <div className="rounded-lg border border-slate-300">
        <WritingToolbar editor={editor} disabled={disabled} onUpload={onUpload} blockCount={blocks.length} />
        <EditorContent editor={editor} className="article-writing" data-empty={empty} />
      </div>
    </ImageContext.Provider>
  );
}
