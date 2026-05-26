import assert from 'node:assert/strict';
import test from 'node:test';
import Fastify from 'fastify';
import type { FastifyInstance } from 'fastify';

import { verifyAdmin } from '../src/hooks/auth-hook';
import jwtPlugin from '../src/plugins/jwt';
import authRoutes from '../src/routes/auth';
import type { UserProfile } from '../src/types';

process.env.JWT_SECRET = process.env.JWT_SECRET || 'phase-1-auth-test-secret';

type ProfileRow = {
  role: 'admin' | 'client';
  company_id: string | null;
  status?: string;
  companies?: { name: string } | null;
};

type ProfileState = {
  row: ProfileRow | null;
  error?: Error | null;
};

const staleAdmin: UserProfile = {
  id: 'user-1',
  email: 'admin@example.com',
  role: 'admin',
  company_id: 'company-old',
  company_name: 'Empresa Antiga',
  status: 'active',
};

test('admin access uses the current admin profile', async (t) => {
  const app = await buildAuthApp({
    row: { role: 'admin', company_id: 'company-live', status: 'active' },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/test/admin',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true, role: 'admin', company_id: 'company-live' });
});

test('stale admin token is rejected after the profile is downgraded', async (t) => {
  const app = await buildAuthApp({
    row: { role: 'client', company_id: 'company-live', status: 'active' },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/test/admin',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 403);
});

test('blocked user is rejected even with a valid token', async (t) => {
  const app = await buildAuthApp({
    row: { role: 'admin', company_id: 'company-live', status: 'blocked' },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/validate',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 403);
});

test('missing live profile fails closed', async (t) => {
  const app = await buildAuthApp({ row: null });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/validate',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 401);
});

test('profile lookup error fails closed', async (t) => {
  const app = await buildAuthApp({ row: null, error: new Error('database unavailable') });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/validate',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 401);
});

test('validate returns the current company scope instead of stale token scope', async (t) => {
  const app = await buildAuthApp({
    row: {
      role: 'client',
      company_id: 'company-new',
      status: 'active',
      companies: { name: 'Empresa Nova' },
    },
  });
  t.after(() => app.close());

  const response = await app.inject({
    method: 'GET',
    url: '/api/auth/validate',
    headers: authHeader(app, staleAdmin),
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json().user, {
    id: staleAdmin.id,
    email: staleAdmin.email,
    role: 'client',
    company_id: 'company-new',
    company_name: 'Empresa Nova',
    status: 'active',
  });
});

async function buildAuthApp(profile: ProfileState): Promise<FastifyInstance> {
  const app = Fastify({ logger: false });
  app.decorate('supabaseAdmin', createFakeSupabase(profile) as any);

  await app.register(jwtPlugin);
  await app.register(authRoutes, { prefix: '/api/auth' });
  await app.register(async (routes) => {
    routes.get('/test/admin', {
      preHandler: [routes.authenticate, verifyAdmin],
    }, async (request) => {
      const { user } = request.user as { user: UserProfile };
      return { ok: true, role: user.role, company_id: user.company_id };
    });
  });
  await app.ready();

  return app;
}

function authHeader(app: FastifyInstance, user: UserProfile) {
  return { authorization: `Bearer ${app.jwt.sign({ user })}` };
}

function createFakeSupabase(profile: ProfileState) {
  return {
    from(table: string) {
      assert.equal(table, 'profiles');
      return {
        select() {
          return {
            eq(_column: string, id: string) {
              assert.equal(id, staleAdmin.id);
              return {
                async maybeSingle() {
                  return { data: profile.row, error: profile.error || null };
                },
              };
            },
          };
        },
      };
    },
  };
}
