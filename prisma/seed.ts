import { PrismaClient, Role } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ADMIN = {
  email: 'admin@example.com',
  name: 'Ada Admin',
  password: 'Admin1234',
  role: Role.ADMIN,
};

const AUTHOR = {
  email: 'user@example.com',
  name: 'Uma User',
  password: 'User12345',
  role: Role.USER,
};

interface SeedNews {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  tags: string[];
  published: boolean;
  views: number;
  owner: 'admin' | 'user';
}

const NEWS: SeedNews[] = [
  {
    title: 'NestJS 11 ships with faster bootstrapping',
    slug: 'nestjs-11-ships-with-faster-bootstrapping',
    excerpt: 'The new major release trims startup time and modernises the Express adapter.',
    content:
      'NestJS 11 reworks module resolution and lazy loading so large applications boot noticeably faster. ' +
      'The Express adapter moves to Express 5 semantics, logging gains structured context, and the CLI ' +
      'now emits smaller build artifacts by default.',
    tags: ['nestjs', 'typescript', 'release'],
    published: true,
    views: 128,
    owner: 'admin',
  },
  {
    title: 'Prisma with MongoDB: what changes',
    slug: 'prisma-with-mongodb-what-changes',
    excerpt: 'No migrations, ObjectId mapping and a few query operators you will actually use.',
    content:
      'Running Prisma against MongoDB replaces the migration workflow with `prisma db push`. ' +
      'Every model needs `@id @default(auto()) @map("_id") @db.ObjectId`, relation scalars need ' +
      '`@db.ObjectId`, and array fields unlock operators such as `has`, `hasEvery` and `hasSome`.',
    tags: ['prisma', 'mongodb', 'database'],
    published: true,
    views: 342,
    owner: 'admin',
  },
  {
    title: 'Handling file uploads without leaking disk space',
    slug: 'handling-file-uploads-without-leaking-disk-space',
    excerpt: 'Validate early, name files with a uuid, and delete the old one on replace.',
    content:
      'Multer writes to disk before your handler runs, so a request that fails validation can still ' +
      'leave a file behind. Reject unwanted mime types in the fileFilter, cap the size with limits, ' +
      'and remove orphaned files from a global exception filter.',
    tags: ['nestjs', 'multer', 'uploads'],
    published: true,
    views: 87,
    owner: 'user',
  },
  {
    title: 'JWT refresh rotation in practice',
    slug: 'jwt-refresh-rotation-in-practice',
    excerpt: 'Short access tokens, separate signing keys and a token type claim.',
    content:
      'Sign access and refresh tokens with different secrets and tag each payload with a `type` claim. ' +
      'That single field stops a refresh token from being replayed against a protected endpoint, and ' +
      'keeps rotation logic honest when the pair is exchanged.',
    tags: ['auth', 'jwt', 'security'],
    published: true,
    views: 213,
    owner: 'user',
  },
  {
    title: 'Draft: benchmarking the new query engine',
    slug: 'draft-benchmarking-the-new-query-engine',
    excerpt: 'Numbers are still being collected — this entry stays unpublished for now.',
    content:
      'An unpublished item, useful for verifying that the public listing hides drafts by default and ' +
      'that `GET /api/news?published=false` returns them when explicitly requested.',
    tags: ['benchmark', 'draft'],
    published: false,
    views: 0,
    owner: 'user',
  },
];

async function main(): Promise<void> {
  console.log('Seeding database...');

  // Idempotent: wipe seeded collections so re-running gives the same result.
  await prisma.news.deleteMany();
  await prisma.user.deleteMany();

  const [admin, user] = await Promise.all([
    prisma.user.create({
      data: { ...ADMIN, password: await bcrypt.hash(ADMIN.password, 12) },
    }),
    prisma.user.create({
      data: { ...AUTHOR, password: await bcrypt.hash(AUTHOR.password, 12) },
    }),
  ]);

  console.log(`  admin: ${admin.email} / ${ADMIN.password}`);
  console.log(`  user:  ${user.email} / ${AUTHOR.password}`);

  for (const item of NEWS) {
    const { owner, ...data } = item;
    const created = await prisma.news.create({
      data: { ...data, authorId: owner === 'admin' ? admin.id : user.id },
    });
    console.log(`  news:  ${created.slug} (${created.published ? 'published' : 'draft'})`);
  }

  console.log(`Done: 2 users, ${NEWS.length} news items.`);
}

main()
  .catch((error) => {
    console.error('Seeding failed:', error);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
