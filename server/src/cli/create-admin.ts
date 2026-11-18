// Creates the admin account, or promotes an existing user and resets their password.
// Usage: node dist/cli/create-admin.js <username>   (password from ADMIN_PASSWORD or the first line of stdin)
// Run it with the same DATABASE_PATH as the server.
import { createInterface } from 'node:readline';
import { AuthService } from '../auth/auth-service.js';
import { credentials } from '../auth/auth-routes.js';
import { HouseholdService } from '../households/household-service.js';
import { openDatabase } from '../shared/db.js';
import { validationMessage } from '../shared/validation-message.js';

async function readPassword(): Promise<string> {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (process.stdin.isTTY) process.stderr.write('Contraseña: ');
  const lines = createInterface({ input: process.stdin });
  for await (const line of lines) {
    lines.close();
    return line;
  }
  return '';
}

const parsed = credentials.safeParse({ username: process.argv[2] ?? '', password: await readPassword() });
if (!parsed.success) {
  console.error(validationMessage(parsed.error));
  process.exit(1);
}

const db = openDatabase(process.env.DATABASE_PATH ?? 'data/kitchen.sqlite');
try {
  const { user, created } = await new AuthService(db, new HouseholdService(db)).createAdmin(parsed.data.username, parsed.data.password);
  console.log(`${created ? 'Created' : 'Updated'} admin "${user.username}" in household "${user.householdName}".`);
} finally {
  db.close();
}
