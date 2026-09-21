import { PrismaClient } from '@prisma/client';
import { createCipheriv, randomBytes } from 'crypto';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

const rawKey = process.env.ENCRYPTION_KEY;
if (!rawKey) {
  console.error('ERROR: ENCRYPTION_KEY environment variable is missing.');
  process.exit(1);
}

const key = Buffer.from(rawKey, 'hex');
if (key.length !== 32) {
  console.error(`ERROR: ENCRYPTION_KEY must be a 32-byte hex string (64 hex characters). Got ${key.length} bytes.`);
  process.exit(1);
}

function encrypt(plain) {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  const encrypted = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

const prisma = new PrismaClient();

async function main() {
  console.log('Checking for unencrypted tokens in the database...');
  const accounts = await prisma.account.findMany();
  let migrated = 0;
  let alreadyEncrypted = 0;

  for (const acc of accounts) {
    if (acc.token.startsWith('enc:')) {
      alreadyEncrypted++;
      continue;
    }

    // It's a plain text token!
    const encryptedToken = encrypt(acc.token);
    await prisma.account.update({
      where: { id: acc.id },
      data: { token: encryptedToken },
    });
    console.log(`Encrypted token for account: ${acc.label} (${acc.username})`);
    migrated++;
  }

  console.log(`\nMigration complete:`);
  console.log(`- Already encrypted: ${alreadyEncrypted}`);
  console.log(`- Newly encrypted: ${migrated}`);
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
