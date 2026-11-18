import { DatabaseSync } from 'node:sqlite';
import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { AuthService } from '../src/auth/auth-service.js';
import { HouseholdService } from '../src/households/household-service.js';
import { MIGRATIONS, migrate } from '../src/shared/db.js';
import { createTestApp, PASSWORD, register, signedIn, signedInAdmin } from './helpers.js';

let app: FastifyInstance;
afterEach(() => app?.close());

const rice = { name: 'Arroz', location: 'pantry', quantity: 0, unit: 'kg' };

describe('households', () => {
  it('keeps each household’s inventory, meals and shopping list apart', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const bob = await signedIn(app, 'bob');

    const item = (await ana({ method: 'POST', url: '/api/items', payload: rice })).json();
    await ana({ method: 'POST', url: '/api/shopping', payload: { name: 'Pan' } });

    expect((await bob({ method: 'GET', url: '/api/items' })).json()).toEqual([]);
    expect((await bob({ method: 'GET', url: '/api/alerts' })).json()).toEqual([]);
    expect((await bob({ method: 'GET', url: '/api/shopping' })).json()).toEqual([]);
    expect((await bob({ method: 'PATCH', url: `/api/items/${item.id}`, payload: { quantity: 5 } })).statusCode).toBe(404);
    expect((await bob({ method: 'POST', url: `/api/items/${item.id}/adjust`, payload: { delta: 5 } })).statusCode).toBe(404);
    expect((await bob({ method: 'DELETE', url: `/api/items/${item.id}` })).statusCode).toBe(404);
    const steal = await bob({
      method: 'PUT',
      url: '/api/meals/2026-11-18/lunch',
      payload: { title: 'Paella', allocations: [{ foodItemId: item.id, quantity: 1 }] },
    });
    expect(steal.statusCode).toBe(404);

    // Both households can plan the same slot.
    const anaMeal = await ana({ method: 'PUT', url: '/api/meals/2026-11-18/lunch', payload: { title: 'Lentejas' } });
    const bobMeal = await bob({ method: 'PUT', url: '/api/meals/2026-11-18/lunch', payload: { title: 'Pasta' } });
    expect(anaMeal.statusCode).toBe(200);
    expect(bobMeal.statusCode).toBe(200);
    const week = (await bob({ method: 'GET', url: '/api/meals?from=2026-11-16&to=2026-11-22' })).json();
    expect(week.map((meal: { title: string }) => meal.title)).toEqual(['Pasta']);
    expect((await bob({ method: 'POST', url: `/api/meals/${anaMeal.json().id}/consume` })).statusCode).toBe(404);
    expect((await bob({ method: 'DELETE', url: `/api/meals/${anaMeal.json().id}` })).statusCode).toBe(404);

    const anaShopping = (await ana({ method: 'GET', url: '/api/shopping' })).json();
    expect(anaShopping.map((entry: { name: string }) => entry.name).sort()).toEqual(['Arroz', 'Pan']);
    const pan = anaShopping.find((entry: { name: string }) => entry.name === 'Pan');
    expect((await bob({ method: 'PATCH', url: `/api/shopping/${pan.id}`, payload: { checked: true } })).statusCode).toBe(404);
    expect((await bob({ method: 'DELETE', url: `/api/shopping/${pan.id}` })).statusCode).toBe(404);
    await ana({ method: 'PATCH', url: `/api/shopping/${pan.id}`, payload: { checked: true } });
    await bob({ method: 'POST', url: '/api/shopping/clear-checked' });
    expect((await ana({ method: 'GET', url: '/api/shopping' })).json()).toHaveLength(2);
  });

  it('only notifies devices of the household that changed', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const bob = await signedIn(app, 'bob');
    const bobHousehold = (await bob({ method: 'GET', url: '/api/auth/me' })).json().householdId;
    const received: string[][] = [];
    app.changeEvents.subscribe(bobHousehold, (topics) => received.push(topics));

    await ana({ method: 'POST', url: '/api/items', payload: rice });
    expect(received).toEqual([]);
    await bob({ method: 'POST', url: '/api/items', payload: rice });
    expect(received.flat()).toContain('inventory');
  });

  it('lets a new member join with the household code and see the same kitchen', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    await ana({ method: 'POST', url: '/api/items', payload: rice });
    const household = (await ana({ method: 'GET', url: '/api/household' })).json();
    expect(household).toMatchObject({ name: 'Casa de ana', members: [{ username: 'ana' }] });
    expect(household.inviteCode).toMatch(/^[A-Z2-9]{8}$/);

    // Codes are accepted in any case and with separators, as people type them.
    const typed = `${household.inviteCode.slice(0, 4).toLowerCase()}-${household.inviteCode.slice(4)}`;
    const carmen = await signedIn(app, 'carmen', typed);
    expect((await carmen({ method: 'GET', url: '/api/items' })).json().map((i: { name: string }) => i.name)).toEqual(['Arroz']);
    const members = (await carmen({ method: 'GET', url: '/api/household' })).json().members;
    expect(members.map((m: { username: string }) => m.username)).toEqual(['ana', 'carmen']);
  });

  it('regenerating the household code invalidates the old one', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    const old = (await ana({ method: 'GET', url: '/api/household' })).json().inviteCode;
    const regenerated = await ana({ method: 'POST', url: '/api/household/invite-code' });
    expect(regenerated.statusCode).toBe(200);
    const fresh = regenerated.json().inviteCode;
    expect(fresh).not.toBe(old);
    expect((await register(app, 'dani', old)).statusCode).toBe(403);
    expect((await register(app, 'dani', fresh)).statusCode).toBe(201);
  });

  it('reports who is signed in, their household and whether they are admin', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    expect((await ana({ method: 'GET', url: '/api/auth/me' })).json()).toMatchObject({
      username: 'ana',
      isAdmin: false,
      householdName: 'Casa de ana',
    });
    const admin = await signedInAdmin(app, 'Alex');
    expect((await admin({ method: 'GET', url: '/api/auth/me' })).json()).toMatchObject({ username: 'Alex', isAdmin: true });
  });
});

describe('admin invites', () => {
  it('rejects admin routes for members and anonymous visitors', async () => {
    app = await createTestApp();
    const ana = await signedIn(app, 'ana');
    for (const [method, url] of [
      ['GET', '/api/admin/invites'],
      ['POST', '/api/admin/invites'],
      ['DELETE', '/api/admin/invites/ABCDEFGH'],
      ['GET', '/api/admin/households'],
    ] as const) {
      expect((await ana({ method, url })).statusCode, `${method} ${url}`).toBe(403);
      expect((await app.inject({ method, url })).statusCode, `${method} ${url}`).toBe(401);
    }
  });

  it('generates single-use codes that create a new household', async () => {
    app = await createTestApp();
    const admin = await signedInAdmin(app, 'Alex');
    const created = await admin({ method: 'POST', url: '/api/admin/invites' });
    expect(created.statusCode).toBe(201);
    const { code } = created.json();
    expect(code).toMatch(/^[A-Z2-9]{8}$/);
    expect((await admin({ method: 'GET', url: '/api/admin/invites' })).json()).toMatchObject([{ code, usedBy: null }]);

    expect((await register(app, 'eva', code)).statusCode).toBe(201);
    const second = await register(app, 'fran', code);
    expect(second.statusCode).toBe(403);
    expect(second.json().message).toBe('El código de invitación no es correcto');

    expect((await admin({ method: 'GET', url: '/api/admin/invites' })).json()).toMatchObject([{ code, usedBy: 'eva' }]);
    const households = (await admin({ method: 'GET', url: '/api/admin/households' })).json();
    expect(households.map((h: { name: string; members: string[] }) => [h.name, h.members])).toEqual([
      ['Casa de Alex', ['Alex']],
      ['Casa de eva', ['eva']],
    ]);
  });

  it('revokes unused codes but not used ones', async () => {
    app = await createTestApp();
    const admin = await signedInAdmin(app, 'Alex');
    const unused = (await admin({ method: 'POST', url: '/api/admin/invites' })).json().code;
    const used = (await admin({ method: 'POST', url: '/api/admin/invites' })).json().code;
    await register(app, 'eva', used);

    expect((await admin({ method: 'DELETE', url: `/api/admin/invites/${unused}` })).statusCode).toBe(204);
    expect((await register(app, 'fran', unused)).statusCode).toBe(403);
    expect((await admin({ method: 'DELETE', url: `/api/admin/invites/${used}` })).statusCode).toBe(409);
    expect((await admin({ method: 'DELETE', url: '/api/admin/invites/ZZZZZZZZ' })).statusCode).toBe(404);
    expect((await admin({ method: 'GET', url: '/api/admin/invites' })).json().map((i: { code: string }) => i.code)).toEqual([used]);
  });
});

describe('admin account and migration', () => {
  it('moves existing single-kitchen data into one household that the first admin takes over', async () => {
    const db = new DatabaseSync(':memory:');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec(MIGRATIONS[0] as string);
    db.exec('PRAGMA user_version = 1');
    db.exec(`
      INSERT INTO users VALUES ('u1', 'old', 'scrypt:x:y', '2026-01-01');
      INSERT INTO food_items VALUES ('f1', 'Leche', 'leche', 'fridge', 2, 'l', 1, '2026-01-01', '2026-01-01');
      INSERT INTO meals VALUES ('m1', '2026-01-02', 'lunch', 'Café', 0);
      INSERT INTO meal_allocations VALUES ('a1', 'm1', 'f1', 1, 0);
      INSERT INTO shopping_items VALUES ('s1', 'Pan', NULL, NULL, NULL, 'manual', 0, '2026-01-01');
    `);

    migrate(db);

    const households = db.prepare('SELECT id FROM households').all() as { id: string }[];
    expect(households).toHaveLength(1);
    const legacy = households[0]!.id;
    for (const table of ['users', 'food_items', 'meals', 'shopping_items']) {
      expect(db.prepare(`SELECT DISTINCT household_id AS h FROM ${table}`).all(), table).toEqual([{ h: legacy }]);
    }
    expect(db.prepare('SELECT COUNT(*) AS n FROM meal_allocations').get()).toEqual({ n: 1 });
    expect(db.prepare('PRAGMA foreign_key_check').all()).toEqual([]);

    const auth = new AuthService(db, new HouseholdService(db));
    const { user } = await auth.createAdmin('Alex', PASSWORD);
    expect(user).toMatchObject({ username: 'Alex', isAdmin: true, householdId: legacy });
  });

  it('creating the admin again promotes the user and resets the password', async () => {
    app = await createTestApp();
    await signedIn(app, 'Alex');
    const { created, user } = await app.auth.createAdmin('alex', 'a brand new password');
    expect(created).toBe(false);
    expect(user.isAdmin).toBe(true);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', payload: { username: 'Alex', password: 'a brand new password' } });
    expect(login.statusCode).toBe(200);
  });

  it('a fresh database has no households until someone is invited', async () => {
    app = await createTestApp();
    const res = await register(app, 'ana', 'ABCDEFGH');
    expect(res.statusCode).toBe(403);
  });
});
