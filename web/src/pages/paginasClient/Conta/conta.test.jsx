import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import Sidebar from '../../../components/Sidebar';
import { ClientPreviewProvider } from '../../../context/ClientPreviewContext';
import api from '../../../services/api';
import Conta from './conta';

const logout = vi.fn();

vi.mock('../../../services/api', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../context/AuthContext', () => ({
  useAuth: () => ({
    user: { email: 'cliente@example.com' },
    logout,
  }),
}));

const accountResponse = {
  data: {
    user: {
      id: 'user-1',
      email: 'cliente@example.com',
      full_name: 'Cliente Atual',
      company_name: 'Empresa Atual',
      role: 'client',
      company_id: 'company-1',
      status: 'active',
    },
  },
};

describe('Conta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue(accountResponse);
    api.post.mockResolvedValue({ data: { success: true } });
  });

  it('renders the current account summary', async () => {
    renderConta();

    expect(await screen.findByText('Cliente Atual')).toBeInTheDocument();
    expect(screen.getByText('cliente@example.com')).toBeInTheDocument();
    expect(screen.getByText('Empresa Atual')).toBeInTheDocument();
    expect(screen.getByText('Cliente')).toBeInTheDocument();
    expect(api.get).toHaveBeenCalledWith('/auth/me');
  });

  it('validates password rules before submit', async () => {
    renderConta();
    await screen.findByText('Cliente Atual');

    fillPassword('currentPassword', 'senha-atual');
    fillPassword('newPassword', 'curta12');
    fillPassword('confirmPassword', 'curta12');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('A nova senha precisa ter pelo menos 8 caracteres.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();

    fillPassword('newPassword', 'nova-senha-segura');
    fillPassword('confirmPassword', 'senha-diferente');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    expect(await screen.findByText('A confirmacao da nova senha nao confere.')).toBeInTheDocument();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('logs out and redirects to login after password change', async () => {
    render(
      <MemoryRouter initialEntries={['/app/conta']}>
        <Routes>
          <Route path="/app/conta" element={<Conta />} />
          <Route path="/" element={<LoginReturn />} />
        </Routes>
      </MemoryRouter>
    );

    await screen.findByText('Cliente Atual');
    fillPassword('currentPassword', 'senha-atual');
    fillPassword('newPassword', 'nova-senha-segura');
    fillPassword('confirmPassword', 'nova-senha-segura');
    fireEvent.click(screen.getByRole('button', { name: 'Alterar senha' }));

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        currentPassword: 'senha-atual',
        newPassword: 'nova-senha-segura',
        confirmPassword: 'nova-senha-segura',
      });
      expect(logout).toHaveBeenCalled();
    });
    expect(await screen.findByText('Senha alterada')).toBeInTheDocument();
  });
});

describe('Sidebar account link', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.get.mockResolvedValue({ data: { name: 'Empresa Atual' } });
  });

  it('shows account access in the portal sidebar', () => {
    render(
      <MemoryRouter>
        <Sidebar />
      </MemoryRouter>
    );

    expect(screen.getByRole('link', { name: 'Minha conta' })).toBeInTheDocument();
  });

  it('hides account access in admin client preview', () => {
    render(
      <MemoryRouter initialEntries={['/admin/empresas/company-1/preview']}>
        <Routes>
          <Route
            path="/admin/empresas/:companyId/preview"
            element={(
              <ClientPreviewProvider>
                <Sidebar />
              </ClientPreviewProvider>
            )}
          />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.queryByRole('link', { name: 'Minha conta' })).not.toBeInTheDocument();
  });
});

function renderConta() {
  return render(
    <MemoryRouter>
      <Conta />
    </MemoryRouter>
  );
}

function fillPassword(id, value) {
  fireEvent.change(document.getElementById(id), { target: { value } });
}

function LoginReturn() {
  const location = useLocation();
  return location.state?.passwordChanged ? 'Senha alterada' : 'Login';
}
