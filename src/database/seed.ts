/**
 * Dev seed: creates a demo account and two organizations with owner members,
 * mirroring the iOS sample data. Idempotent — safe to run repeatedly.
 *
 *   pnpm db:seed
 *
 * Demo login: demo@camflow.app / password
 */
import * as argon2 from 'argon2';
import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';
import { accounts, orgMembers, organizations } from './schema';

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to seed.');

  const pool = new Pool({ connectionString: url });
  const db = drizzle(pool, { schema, casing: 'snake_case' });

  try {
    const email = 'demo@camflow.app';
    let account = await db.query.accounts.findFirst({
      where: eq(accounts.email, email),
    });

    if (!account) {
      const passwordHash = await argon2.hash('password', {
        type: argon2.argon2id,
      });
      [account] = await db
        .insert(accounts)
        .values({
          email,
          displayName: 'Demo User',
          provider: 'email',
          passwordHash,
          colorHex: '#FF6B35',
        })
        .returning();
      console.log(`Created demo account ${account.id}`);
    } else {
      console.log(`Demo account already exists (${account.id})`);
    }

    const orgsToSeed: { name: string; plan: 'basic' | 'pro' | 'premium' }[] = [
      { name: 'Demo Construction Co.', plan: 'pro' },
      { name: 'Skyline Renovations', plan: 'basic' },
    ];

    for (const spec of orgsToSeed) {
      const existing = await db.query.organizations.findFirst({
        where: eq(organizations.name, spec.name),
      });
      if (existing) {
        console.log(`Org "${spec.name}" already exists (${existing.id})`);
        continue;
      }
      const [org] = await db
        .insert(organizations)
        .values({
          name: spec.name,
          ownerAccountId: account.id,
          planTier: spec.plan,
          trialStartedAt: new Date(),
          subscriptionStartedAt: new Date(),
        })
        .returning();
      await db.insert(orgMembers).values({
        organizationId: org.id,
        accountId: account.id,
        name: account.displayName,
        role: 'owner',
        status: 'active',
        colorHex: account.colorHex,
      });
      console.log(`Created org "${spec.name}" (${org.id}) with owner member`);
    }

    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
