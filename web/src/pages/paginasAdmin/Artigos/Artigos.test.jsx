import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterAll, afterEach, beforeAll, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../context/AuthContext';
import { router } from '../../../rotas/rotas';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

const ADMIN = { id: '3560ec24-29c3-460d-8ddf-0f7dea82ce27', role: 'admin', email: 'editor@example.test' };
const API = '/admin/artigos';
const ID = '5bb18746-e8a4-4dc1-8a3c-7a3c65dd2ddb';
const MEDIA_ID = '6ea07dba-e440-4ac8-9bd1-d42dd3aa58a5';
const OLDER_ID = 'd91bfec7-3d16-4c3d-b250-5a3177fca227';
const CURRENT_ID = '0fd103ef-92ca-4b79-815b-e12117b1ba30';
const TIMESTAMP = '2026-11-16T12:00:00.000Z';
const UUID = /^[0-9a-f-]{36}$/i;
const DRAFT = {
  id: ID, slug: null, title: '', status: 'draft', version: 1, publishedAt: null,
  updatedAt: TIMESTAMP, publicUrl: null, summary: '', cover: null, blocks: [],
  publishedRevisionId: null, hasDraftChanges: true, revisions: [],
};
const READY = {
  ...DRAFT, title: 'Boas práticas de TI', summary: 'Cuidados para a equipe.',
  cover: { mediaId: MEDIA_ID, alt: 'Equipe em reunião' },
  blocks: [{ type: 'paragraph', text: 'Registre o atendimento.' }],
};
const PUBLIC = {
  ...READY, slug: 'boas-praticas-de-ti', status: 'published', publishedAt: TIMESTAMP,
  publicUrl: 'https://innerworks.example/artigos/boas-praticas-de-ti', publishedRevisionId: CURRENT_ID,
  hasDraftChanges: false, revisions: [
    { id: CURRENT_ID, title: READY.title, publishedAt: TIMESTAMP },
    { id: OLDER_ID, title: 'Guia anterior', publishedAt: TIMESTAMP },
  ],
};

function response(data) {
  return { data };
}

function openPage(path = API, { article = DRAFT, allowed = true, access } = {}) {
  localStorage.setItem('token', 'signed-admin-session');
  localStorage.setItem('user', JSON.stringify(ADMIN));
  api.get.mockImplementation(async (url) => {
    if (url === '/auth/validate') return response({ user: ADMIN });
    if (url === '/admin/companies') return response([]);
    if (url === `${API}/access`) return access ? access() : response({ allowed });
    if (url === API) return response({ articles: [], hasMore: false });
    if (url.startsWith(`${API}/`) && url.includes('/media/')) return response(new Blob(['image'], { type: 'image/webp' }));
    if (url.startsWith(`${API}/`)) return response({ article });
    throw new Error(`Requisição inesperada: ${url}`);
  });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  render(<AuthProvider><RouterProvider router={memoryRouter} /></AuthProvider>);
  return memoryRouter;
}

// ProseMirror measures the caret when editing and scrolling, which JSDOM does not lay out.
const rangeGeometry = {
  getClientRects: () => [],
  getBoundingClientRect: () => new DOMRect(),
};
const rangeStubs = Object.entries(rangeGeometry).filter(([name]) => !Range.prototype[name]);

beforeAll(() => {
  for (const [name, value] of rangeStubs) Object.defineProperty(Range.prototype, name, { value, configurable: true });
});

afterAll(() => {
  for (const [name] of rangeStubs) delete Range.prototype[name];
});

afterEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
  vi.unstubAllGlobals();
});

it('shows the editorial link and opens the list directly for allowed admins', async () => {
  openPage();

  expect(await screen.findByRole('heading', { name: 'Artigos do site' }, { timeout: 3000 })).toBeInTheDocument();
  expect(await screen.findByText('Nenhum artigo criado.')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Artigos do site' })).toHaveAttribute('href', API);
  expect(api.get).toHaveBeenCalledWith(`${API}/access`, expect.anything());
  expect(api.get).toHaveBeenCalledWith(API, expect.objectContaining({ params: { page: 1 } }));
});

it('keeps the editorial route and menu unavailable for admins without access', async () => {
  openPage(`${API}/${ID}`, { allowed: false });

  expect(await screen.findByRole('heading', { name: 'Acesso restrito' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Artigos do site' })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith(`${API}/${ID}`, expect.anything());
});

it('rechecks access after a network error on a direct visit', async () => {
  const access = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response({ allowed: true }));
  openPage(API, { access });

  fireEvent.click(await screen.findByRole('button', { name: 'Tentar novamente' }));

  expect(await screen.findByRole('heading', { name: 'Artigos do site' })).toBeInTheDocument();
});

it('reuses the same article ID after an uncertain create response', async () => {
  api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ article: DRAFT }));
  openPage();

  fireEvent.click(await screen.findByRole('button', { name: 'Novo artigo' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/criar o artigo/i);
  fireEvent.click(screen.getByRole('button', { name: 'Novo artigo' }));

  expect(await screen.findByLabelText('Título', { exact: true }, { timeout: 5000 })).toBeInTheDocument();
  const [[firstPath, firstBody], [retryPath, retryBody]] = api.post.mock.calls;
  expect(firstPath).toBe(API);
  expect(retryPath).toBe(API);
  expect(firstBody).toEqual({ id: expect.stringMatching(UUID) });
  expect(retryBody).toEqual(firstBody);
}, 12000);

it('keeps the destination when a create response arrives after leaving the article list', async () => {
  let finish;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const memoryRouter = openPage();
  fireEvent.click(await screen.findByRole('button', { name: 'Novo artigo' }));
  fireEvent.click(screen.getByRole('link', { name: 'Minha Conta' }));

  await act(async () => finish(response({ article: DRAFT })));

  expect(memoryRouter.state.location.pathname).toBe('/admin/conta');
});

it('retains local text after a failed save and saves an incomplete draft when retried', async () => {
  api.patch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({
    article: { ...DRAFT, title: 'Meu rascunho', version: 2 },
  }));
  openPage(`${API}/${ID}`);

  const title = await screen.findByLabelText('Título', { exact: true });
  fireEvent.change(title, { target: { value: 'Meu rascunho' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(/salvar o rascunho/i);
  expect(title).toHaveValue('Meu rascunho');
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

  expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument();
  expect(api.patch).toHaveBeenLastCalledWith(`${API}/${ID}`, {
    title: 'Meu rascunho', summary: '', cover: null, blocks: [], version: 1,
  });
});

it('keeps local content visible and calls out a concurrent save conflict', async () => {
  api.patch.mockRejectedValueOnce({ response: { status: 409, data: { error: 'conflict' } } });
  openPage(`${API}/${ID}`);

  const title = await screen.findByLabelText('Título', { exact: true });
  fireEvent.change(title, { target: { value: 'Minha edição' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));

  expect(await screen.findByRole('alert')).toHaveTextContent(/outro editor/i);
  expect(title).toHaveValue('Minha edição');
  expect(screen.getByRole('button', { name: 'Recarregar artigo' })).toBeInTheDocument();
});

function pasteInto(body, content, type = 'text/plain') {
  body.focus();
  const event = new Event('paste', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'clipboardData', { value: { getData: format => format === type ? content : '' } });
  fireEvent(body, event);
}

it('lets a new article take pasted paragraphs in one field and previews them without saving', async () => {
  openPage(`${API}/${ID}`);

  const body = await screen.findByRole('textbox', { name: 'Conteúdo do artigo' });
  pasteInto(body, 'Primeiro parágrafo.\n\nSegundo parágrafo.');
  fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

  const preview = within(screen.getByRole('article'));
  expect(preview.getByText('Primeiro parágrafo.').tagName).toBe('P');
  expect(preview.getByText('Segundo parágrafo.').tagName).toBe('P');
  expect(api.patch).not.toHaveBeenCalled();
});

it('formats the current paragraph as a subtitle and lets the editor undo the formatting after preview', async () => {
  openPage(`${API}/${ID}`);

  const body = await screen.findByRole('textbox', { name: 'Conteúdo do artigo' });
  pasteInto(body, 'Registre o atendimento.');
  fireEvent.click(screen.getByRole('button', { name: 'Subtítulo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));

  const preview = within(screen.getByRole('article'));
  expect(preview.getByRole('heading', { name: 'Registre o atendimento.', level: 3 })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Voltar à edição' }));
  fireEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
  expect(within(body).getByText('Registre o atendimento.').tagName).toBe('P');
  expect(api.patch).not.toHaveBeenCalled();
});

it('edits legacy article blocks without changing their saved order or contents', async () => {
  const blocks = [
    { type: 'paragraph', text: 'Primeira linha.\nSegunda linha.' },
    { type: 'heading', text: 'Primeiros passos' },
    { type: 'quote', text: 'Uma citação.' },
    { type: 'list', ordered: true, items: ['Um', 'Dois'] },
    { type: 'image', mediaId: MEDIA_ID, alt: 'Uma reunião' },
    { type: 'paragraph', text: '' },
  ];
  const article = { ...READY, blocks };
  api.patch.mockResolvedValueOnce(response({ article: { ...article, title: 'Título alterado', version: 2 } }));
  openPage(`${API}/${ID}`, { article });

  const body = await screen.findByRole('textbox', { name: 'Conteúdo do artigo' });
  expect(within(body).getByRole('heading', { name: 'Primeiros passos', level: 3 })).toBeInTheDocument();
  expect(within(body).getAllByRole('listitem')).toHaveLength(2);
  body.focus();
  fireEvent.click(screen.getByRole('button', { name: 'Subtítulo' }));
  fireEvent.click(screen.getByRole('button', { name: 'Parágrafo' }));
  fireEvent.change(screen.getByLabelText('Título', { exact: true }), { target: { value: 'Título alterado' } });
  fireEvent.click(screen.getByRole('button', { name: 'Salvar rascunho' }));
  expect(await screen.findByText('Rascunho salvo.')).toBeInTheDocument();
  expect(api.patch).toHaveBeenCalledWith(`${API}/${ID}`, expect.objectContaining({ blocks }));
});

it('loads preview images as authenticated blobs and releases their temporary URLs', async () => {
  const releaseUrl = vi.fn();
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL() { return 'blob:https://painel.example/private-image'; }
    static revokeObjectURL = releaseUrl;
  });
  openPage(`${API}/${ID}`, { article: READY });

  await screen.findByLabelText('Título', { exact: true });
  fireEvent.click(screen.getByRole('button', { name: 'Pré-visualizar' }));
  expect(await within(screen.getByRole('article')).findByRole('img', { name: READY.cover.alt }))
    .toHaveAttribute('src', 'blob:https://painel.example/private-image');
  expect(api.get).toHaveBeenCalledWith(`${API}/${ID}/media/${MEDIA_ID}`, expect.objectContaining({ responseType: 'blob' }));

  fireEvent.click(screen.getByRole('button', { name: 'Voltar à edição' }));
  expect(releaseUrl).toHaveBeenCalledWith('blob:https://painel.example/private-image');
});

it('blocks publication while an inline image upload is pending', async () => {
  let finishUpload;
  api.post.mockImplementationOnce(() => new Promise(resolve => { finishUpload = resolve; }));
  openPage(`${API}/${ID}`, { article: READY });

  const upload = await screen.findByLabelText('Adicionar imagem', { exact: true });
  const image = new File(['image'], 'registro.webp', { type: 'image/webp' });
  fireEvent.change(upload, { target: { files: [image] } });

  expect(screen.getByRole('button', { name: 'Publicar', exact: true })).toBeDisabled();
  const [path, form] = api.post.mock.calls[0];
  expect(path).toBe(`${API}/${ID}/media`);
  expect(form.get('file')).toEqual(image);
  finishUpload(response({ mediaId: MEDIA_ID, width: 480, height: 320 }));
  expect(await screen.findByLabelText('Texto alternativo da imagem')).toBeInTheDocument();
});

it('confirms publication and retries the same operation after an uncertain response', async () => {
  api.post.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce(response({ article: { ...PUBLIC, version: 2 } }));
  openPage(`${API}/${ID}`, { article: READY });

  fireEvent.click(await screen.findByRole('button', { name: 'Publicar', exact: true }));
  expect(api.post).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));
  expect(await screen.findByText(/confirmar a publicação/i)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar publicação' }));

  expect(await screen.findByRole('button', { name: 'Copiar link público' })).toBeInTheDocument();
  const [first, retry] = api.post.mock.calls;
  expect(first).toEqual([`${API}/${ID}/publish`, { version: 1, requestId: expect.stringMatching(UUID) }]);
  expect(retry).toEqual(first);
});

it('restores a prior public revision and withdraws using the new version while retaining unsaved edits', async () => {
  api.post.mockResolvedValueOnce(response({
    article: { ...PUBLIC, version: 2, publishedRevisionId: OLDER_ID, hasDraftChanges: true },
  })).mockResolvedValueOnce(response({
    article: { ...PUBLIC, version: 3, status: 'unpublished', publicUrl: null, publishedRevisionId: OLDER_ID },
  }));
  openPage(`${API}/${ID}`, { article: PUBLIC });

  const title = await screen.findByLabelText('Título', { exact: true });
  fireEvent.change(title, { target: { value: 'A próxima revisão' } });
  fireEvent.click(screen.getByRole('button', { name: 'Restaurar versão Guia anterior' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar restauração' }));

  expect(await screen.findByText('Versão restaurada.')).toBeInTheDocument();
  expect(title).toHaveValue('A próxima revisão');
  fireEvent.click(screen.getByRole('button', { name: 'Retirar do ar' }));
  fireEvent.click(screen.getByRole('button', { name: 'Confirmar retirada' }));

  await waitFor(() => expect(screen.queryByRole('button', { name: 'Copiar link público' })).not.toBeInTheDocument());
  expect(title).toHaveValue('A próxima revisão');
  expect(api.post).toHaveBeenNthCalledWith(1, `${API}/${ID}/restore`, {
    version: 1, requestId: expect.stringMatching(UUID), revisionId: OLDER_ID,
  });
  expect(api.post).toHaveBeenNthCalledWith(2, `${API}/${ID}/unpublish`, {
    version: 2, requestId: expect.stringMatching(UUID),
  });
});
