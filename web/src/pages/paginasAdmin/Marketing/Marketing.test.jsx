import { act, configure, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { afterEach, expect, it, vi } from 'vitest';
import { AuthProvider } from '../../../context/AuthContext';
import { router } from '../../../rotas/rotas';
import api from '../../../services/api';

vi.mock('../../../services/api', () => ({ default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() } }));
vi.mock('../../../lib/supabase', () => ({ supabase: {} }));

configure({ asyncUtilTimeout: 5000 });
vi.setConfig({ testTimeout: 20000 });

const URL = '/admin/marketing';
const ADMIN = { id: 'admin', role: 'admin', email: 'editor@example.test' };
const EBOOK = {
  id: 'ebook-1', title: 'Guia de TI', description: 'Checklist para a equipe',
  status: 'draft', version: 1, coverReady: false, pdfReady: false,
  updatedAt: '2026-11-17T12:00:00.000Z', publicUrl: null, hasDraftChanges: true,
};
const CAMPAIGN = {
  id: 'campaign-1', name: 'Novembro', subject: 'Novo guia de TI', body: 'Conheça o guia.',
  ebookId: EBOOK.id, state: 'draft', version: 2,
};

async function openPage({ path = URL, allowed = true, campaignReady = true, ebooks = [], campaigns = [], getContacts, getEmail } = {}) {
  localStorage.setItem('token', 'signed-admin-session');
  localStorage.setItem('user', JSON.stringify(ADMIN));
  api.get.mockImplementation(async (path, options) => {
    if (path === '/auth/validate') return { data: { user: ADMIN } };
    if (path === '/admin/companies') return { data: [] };
    if (path === '/admin/artigos/access') return { data: { allowed: false } };
    if (path === URL + '/access') return { data: { allowed, deliveryReady: true, campaignReady } };
    if (path === URL + '/ebooks') return { data: { ebooks } };
    if (path === URL + '/contacts') return { data: getContacts(options.params) };
    if (path === URL + '/campaigns') return { data: { campaigns } };
    if (path === URL + '/email') return { data: getEmail() };
    if (path === URL + '/campaigns/' + CAMPAIGN.id + '/audience') return { data: { eligible: 17 } };
    if (path === URL + '/ebooks/' + EBOOK.id + '/cover') return { data: new Blob(['image'], { type: 'image/webp' }) };
    throw new Error('Requisição inesperada ' + path);
  });
  const memoryRouter = createMemoryRouter(router.routes, { initialEntries: [path] });
  await act(async () => {
    render(<AuthProvider><RouterProvider router={memoryRouter} /></AuthProvider>);
  });
  return memoryRouter;
}

afterEach(() => {
  localStorage.clear();
  vi.resetAllMocks();
});

it('exibe o menu Marketing e abre E-books para a conta autorizada', async () => {
  await openPage();
  expect(screen.getByRole('heading', { name: 'Marketing' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Marketing' })).toHaveAttribute('href', URL);
  expect(await screen.findByText('Nenhum e-book cadastrado.')).toBeInTheDocument();
});

it('protege também o acesso direto a Contatos quando o módulo está desabilitado', async () => {
  await openPage({ allowed: false, path: URL + '/contatos' });
  expect(await screen.findByRole('heading', { name: 'Marketing indisponível' })).toBeInTheDocument();
  expect(screen.queryByRole('link', { name: 'Marketing' })).not.toBeInTheDocument();
  expect(api.get).not.toHaveBeenCalledWith(URL + '/contacts', expect.anything());
});

it('conclui a autorização da Microsoft pela tela de e-mail sem manter o código na URL', async () => {
  let email = { configured: true, connected: false, mailbox: null };
  api.post.mockImplementationOnce(async () => {
    email = { configured: true, connected: true, mailbox: 'marketing@example.test' };
    return { data: email };
  });
  const page = await openPage({
    path: URL + '/email?code=authorize-once&state=state-one-time',
    getEmail: () => email,
  });
  expect(await screen.findByText('marketing@example.test')).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledExactlyOnceWith(URL + '/email/microsoft/finish', {
    code: 'authorize-once', state: 'state-one-time',
  });
  expect(page.state.location.search).toBe('');
  expect(screen.getByRole('button', { name: 'Desconectar Microsoft' })).toBeEnabled();
});

it('publica somente após confirmação e usa a versão devolvida pelo upload de PDF', async () => {
  const coverReady = { ...EBOOK, coverReady: true, version: 2 };
  const pdfReady = { ...coverReady, pdfReady: true, pdfName: 'guia.pdf', version: 3 };
  api.post.mockResolvedValueOnce({ data: { ebook: pdfReady } }).mockResolvedValueOnce({
    data: { ebook: { ...pdfReady, status: 'published', version: 4, hasDraftChanges: false, publicUrl: 'https://innerworks.example/ebooks/guia' } },
  });
  await openPage({ ebooks: [coverReady] });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(EBOOK.title) }));
  expect(screen.getByRole('button', { name: 'Publicar' })).toBeDisabled();
  const file = new File(['pdf'], 'guia.pdf', { type: 'application/pdf' });
  fireEvent.change(screen.getByLabelText('Arquivo PDF'), { target: { files: [file] } });
  fireEvent.click(screen.getByRole('button', { name: 'Enviar PDF' }));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Publicar' })).toBeEnabled());
  expect(api.post.mock.calls[0][0]).toBe(URL + '/ebooks/' + EBOOK.id + '/pdf');
  expect(api.post.mock.calls[0][1].get('file')).toBe(file);
  expect(api.post.mock.calls[0][2]).toEqual(expect.objectContaining({ params: { version: 2 } }));
  fireEvent.click(screen.getByRole('button', { name: 'Publicar' }));
  const dialog = screen.getByRole('dialog');
  expect(api.post).toHaveBeenCalledTimes(1);
  fireEvent.click(within(dialog).getByRole('button', { name: 'Publicar e-book' }));
  expect(await screen.findByRole('link', { name: 'Abrir página pública' })).toHaveAttribute('href', 'https://innerworks.example/ebooks/guia');
  expect(api.post).toHaveBeenLastCalledWith(URL + '/ebooks/' + EBOOK.id + '/publish', { version: 3 });
});

it('pagina contatos e volta à primeira página ao aplicar busca e filtros', async () => {
  await openPage({
    path: URL + '/contatos',
    ebooks: [EBOOK],
    getContacts: ({ page }) => ({ page, hasMore: page === 1, contacts: [] }),
  });
  fireEvent.click(await screen.findByRole('button', { name: 'Próxima' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(URL + '/contacts', expect.objectContaining({ params: { page: 2 } })));
  fireEvent.change(screen.getByLabelText('Buscar por nome ou e-mail'), { target: { value: ' Ana  ' } });
  fireEvent.change(screen.getByLabelText('E-book'), { target: { value: EBOOK.id } });
  fireEvent.change(screen.getByLabelText('Status de marketing'), { target: { value: 'subscribed' } });
  fireEvent.change(screen.getByLabelText('Pedido a partir de'), { target: { value: '2026-10-01' } });
  fireEvent.change(screen.getByLabelText('Pedido até'), { target: { value: '2026-11-17' } });
  fireEvent.click(screen.getByRole('button', { name: 'Filtrar' }));
  await waitFor(() => expect(api.get).toHaveBeenLastCalledWith(URL + '/contacts', expect.objectContaining({
    params: { page: 1, q: 'Ana', ebookId: EBOOK.id, status: 'subscribed', from: '2026-10-01', to: '2026-11-17' },
  })));
});

it('apresenta a audiência e a data em São Paulo antes de agendar a campanha', async () => {
  const now = new Date('2027-01-01T12:00:00.000Z').getTime();
  vi.spyOn(Date, 'now').mockReturnValue(now);
  api.post.mockResolvedValue({ data: { campaign: {
    ...CAMPAIGN, state: 'scheduled', version: 3, scheduledAt: '2027-01-30T17:00:00.000Z', accepted: 8, delivered: 5,
  } } });
  try {
    await openPage({ path: URL + '/campanhas', ebooks: [EBOOK], campaigns: [CAMPAIGN] });
    fireEvent.click(await screen.findByRole('button', { name: new RegExp(CAMPAIGN.name) }));
    fireEvent.click(screen.getByRole('radio', { name: 'Agendar' }));
    fireEvent.change(screen.getByLabelText('Data e hora em São Paulo'), { target: { value: '2027-01-30T14:00' } });
    fireEvent.click(screen.getByRole('button', { name: 'Revisar disparo' }));
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toHaveTextContent('17');
    expect(dialog).toHaveTextContent('14:00');
    expect(api.post).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Agendar campanha' }));
    await waitFor(() => expect(api.post).toHaveBeenCalledWith(URL + '/campaigns/' + CAMPAIGN.id + '/activate', {
      version: 2, scheduledAt: '2027-01-30T17:00:00.000Z', expectedAudience: 17,
    }));
    expect(await screen.findByRole('button', { name: 'Pausar campanha' })).toBeInTheDocument();
    expect(screen.getByText('Aceitos pelo servidor de e-mail').nextElementSibling).toHaveTextContent('8');
    expect(screen.getByText('Entregues').nextElementSibling).toHaveTextContent('5');
  } finally {
    vi.restoreAllMocks();
  }
});

it('exige novo cálculo e confirmação quando a audiência mudou', async () => {
  const campaigns = [CAMPAIGN];
  api.post.mockRejectedValueOnce({ response: { status: 409, data: { error: 'Audiência alterada' } } });
  await openPage({ path: URL + '/campanhas', ebooks: [EBOOK], campaigns });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(CAMPAIGN.name) }));
  fireEvent.click(screen.getByRole('button', { name: 'Revisar disparo' }));
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disparar campanha' }));

  const reload = await screen.findByRole('button', { name: 'Recarregar dados' });
  expect(screen.getByRole('button', { name: 'Revisar disparo' })).toBeDisabled();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.post).toHaveBeenCalledTimes(1);

  campaigns[0] = { ...CAMPAIGN, version: 3 };
  fireEvent.click(reload);
  fireEvent.click(await screen.findByRole('button', { name: 'Revisar disparo' }));
  expect(api.post).toHaveBeenCalledTimes(1);
  api.post.mockResolvedValueOnce({ data: { campaign: { ...CAMPAIGN, state: 'sending', version: 4 } } });
  fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Disparar campanha' }));
  await waitFor(() => expect(api.post).toHaveBeenLastCalledWith(URL + '/campaigns/' + CAMPAIGN.id + '/activate', {
    version: 3, scheduledAt: null, expectedAudience: 17,
  }));
});

it('permite preparar e revisar campanhas mesmo quando o serviço de envio está indisponível', async () => {
  await openPage({ path: URL + '/campanhas', ebooks: [EBOOK], campaigns: [CAMPAIGN], campaignReady: false });
  fireEvent.click(await screen.findByRole('button', { name: new RegExp(CAMPAIGN.name) }));
  fireEvent.click(screen.getByRole('button', { name: 'Prévia da mensagem' }));
  expect(within(screen.getByRole('region', { name: 'Prévia da mensagem' })).getByText(CAMPAIGN.body)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Revisar disparo' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('E-mail para teste'), { target: { value: 'sender@example.test' } });
  expect(screen.getByRole('button', { name: 'Enviar teste' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Assunto'), { target: { value: 'Assunto revisado' } });
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeEnabled();
});
