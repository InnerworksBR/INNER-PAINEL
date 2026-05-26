import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import jwtPlugin from '../src/plugins/jwt';
import authRoutes from '../src/routes/auth';
import type { UserProfile } from '../src/types';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-2-account-test-secret';

type ProfileRow = {
  full_name?: string;
  role: 'admin' | 'client';
  company_id: string | null;
  status?: string;
  companies?: { name: string } | null;
};

type AuthState = {
  currentPassword?: string;
  profile: ProfileRow;
  signIns: Array<{ email: string; password: string }>;
  updates: Array<{ id: string; password?: string }>;
  updateError?: Error | null;
};

const staleClient: UserProfile = {
  id: 'user-1',
  email: 'cliente@example.com',
  full_name: 'Nome antigo',
  role: 'client',
  company_id: 'company-old',
  company_name: 'Empresa Antiga',
  status: 'active',
};

test('me returns the current authenticated profile data', async (t) => {
  const state = createAuthState();
  const app = await buildAccountApp(state);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/me',
    headers: authHeader(app),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    user: {
      id: staleClient.id,
      email: staleClient.email,
      full_name: 'Cliente Atual',
      role: 'client',
      company_id: 'company-live',
      company_name: 'Empresa Atual',
      status: 'active',
    },
  });
});

test('account endpoints require authentication', async (t) => {
  const app = await buildAccountApp(createAuthState());
  t.after(() => app.close());

  const meResponse = await app.inject({ method: 'GET', url: '/api/auth/me' });
  const passwordResponse = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    payload: validChangePayload(),
  });

  assert.equal(meResponse.statusCode, 401);
  assert.equal(passwordResponse.statusCode, 401);
});

test('blocked users cannot change their password', async (t) => {
  const state = createAuthState({ profile: { status: 'blocked' } });
  const app = await buildAccountApp(state);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: validChangePayload(),
  });

  assert.equal(response.statusCode, 403);
  assert.equal(state.signIns.length, 0);
  assert.equal(state.updates.length, 0);
});

test('change-password validates the new password request body', async (t) => {
  const app = await buildAccountApp(createAuthState());
  t.after(() => app.close());

  const missing = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: { currentPassword: 'senha-atual' },
  });
  const shortPassword = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: { ...validChangePayload(), newPassword: 'curta12', confirmPassword: 'curta12' },
  });
  const mismatch = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: { ...validChangePayload(), confirmPassword: 'outra-senha' },
  });
  const foreignUser = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: { ...validChangePayload(), userId: 'outro-usuario' },
  });

  assert.equal(missing.statusCode, 400);
  assert.equal(shortPassword.statusCode, 400);
  assert.equal(mismatch.statusCode, 400);
  assert.equal(foreignUser.statusCode, 400);
});

test('change-password reauthenticates before updating the authenticated user', async (t) => {
  const state = createAuthState();
  const app = await buildAccountApp(state);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: validChangePayload(),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), {
    success: true,
    message: 'Senha alterada com sucesso.',
  });
  assert.deepEqual(state.signIns, [{ email: staleClient.email, password: 'senha-atual' }]);
  assert.deepEqual(state.updates, [{ id: staleClient.id, password: 'nova-senha-segura' }]);
});

test('change-password fails safely when the current password is invalid', async (t) => {
  const state = createAuthState({ currentPassword: 'outra-senha' });
  const app = await buildAccountApp(state);
  t.after(() => app.close());

  const response = await app.inject({
    method: 'POST',
    url: '/api/auth/change-password',
    headers: authHeader(app),
    payload: validChangePayload(),
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), { error: 'Senha atual invalida.' });
  assert.equal(state.updates.length, 0);
  assert.doesNotMatch(JSON.stringify(response.json()), /senha-atual/);
});

async function buildAccountApp(state: AuthState): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  const fakeSupabase = createFakeSupabase(state);

  app.decorate('supabase', fakeSupabase.publicClient as any);
  app.decorate('supabaseAdmin', fakeSupabase.adminClient as any);

  await app.register(jwtPlugin);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.ready();

  return app;
}

function createAuthState(overrides: Partial<AuthState> & { profile?: Partial<ProfileRow> } = {}): AuthState {
  return {
    currentPassword: overrides.currentPassword || 'senha-atual',
    profile: {
      full_name: 'Cliente Atual',
      role: 'client',
      company_id: 'company-live',
      status: 'active',
      companies: { name: 'Empresa Atual' },
      ...overrides.profile,
    },
    signIns: [],
    updates: [],
    updateError: overrides.updateError || null,
  };
}

function createFakeSupabase(state: AuthState) {
  return {
    publicClient: {
      auth: {
        async signInWithPassword(input: { email: string; password: string }) {
          state.signIns.push(input);
          if (input.email !== staleClient.email || input.password !== state.currentPassword) {
            return { data: { user: null }, error: Object.assign(new Error('invalid login'), { status: 400 }) };
          }

          return { data: { user: { id: staleClient.id, email: input.email } }, error: null };
        },
      },
    },
    adminClient: {
      auth: {
        admin: {
          async updateUserById(id: string, input: { password?: string }) {
            state.updates.push({ id, password: input.password });
            return { data: { user: { id } }, error: state.updateError || null };
          },
        },
      },
      from(table: string) {
        assert.equal(table, 'profiles');
        return {
          select() {
            return {
              eq(column: string, id: string) {
                assert.equal(column, 'id');
                assert.equal(id, staleClient.id);
                return {
                  async maybeSingle() {
                    return { data: state.profile, error: null };
                  },
                };
              },
            };
          },
        };
      },
    },
  };
}

function authHeader(app: FastifyInstance) {
  return { authorization: `Bearer ${app.jwt.sign({ user: staleClient })}` };
}

function validChangePayload() {
  return {
    currentPassword: 'senha-atual',
    newPassword: 'nova-senha-segura',
    confirmPassword: 'nova-senha-segura',
  };
}
