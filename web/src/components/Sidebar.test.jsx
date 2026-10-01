import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';
vi.mock('../context/AuthContext', () => ({ useAuth: () => ({ user: { role: 'admin' }, logout: vi.fn() }) }));
it('links settings to the registered admin route', () => {
  render(<MemoryRouter><Sidebar /></MemoryRouter>);
  expect(screen.getByRole('link', { name: 'Configurações' })).toHaveAttribute('href', '/admin/configAdmin');
});
