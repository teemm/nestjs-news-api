import { ConflictException, ForbiddenException, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Role } from '@prisma/client';
import { SafeUser } from '../auth/types/auth.types';
import { EnvironmentVariables } from '../config/env.validation';
import { PrismaService } from '../prisma/prisma.service';
import { NewsService } from './news.service';
jest.mock('../common/config/multer.config', () => ({
  buildImageUrl: (base: string, filename: string) => `${base}/uploads/news/${filename}`,
  removeImageByUrl: jest.fn(),
}));
import { removeImageByUrl } from '../common/config/multer.config';

describe('News updates on standalone MongoDB', () => {
  const id = '6a993c6b6117c3e9b76aad69';
  const authorId = '000000000000000000000001';
  const existing = { id, authorId, title: 'Existing title', slug: 'existing-title', coverImage: '/uploads/news/old.jpg' };
  const user = { id: authorId, role: Role.USER } as SafeUser;
  let prisma: { news: { findUnique: jest.Mock; findUniqueOrThrow: jest.Mock }; $runCommandRaw: jest.Mock };
  let service: NewsService;
  beforeEach(() => {
    jest.clearAllMocks();
    prisma = {
      news: { findUnique: jest.fn().mockResolvedValue(existing), findUniqueOrThrow: jest.fn().mockResolvedValue(existing) },
      $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1, n: 1 }),
    };
    service = new NewsService(prisma as unknown as PrismaService,
      { get: () => 'http://localhost:3000' } as unknown as ConfigService<EnvironmentVariables, true>);
  });
  it('saves false and empty tags without replacing omitted fields or requiring a transaction', async () => {
    await expect(service.update(id, user, { published: false, tags: [] })).resolves.toEqual(existing);
    expect(prisma.$runCommandRaw).toHaveBeenCalledWith({ update: 'news', updates: [{
      q: { _id: { $oid: id } }, multi: false, upsert: false,
      u: { $set: { published: false, tags: [], updatedAt: { $date: expect.any(String) } } },
    }] });
  });
  it('preserves author permissions', async () => {
    await expect(service.update(id, { ...user, id: '000000000000000000000002' }, {})).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.$runCommandRaw).not.toHaveBeenCalled();
  });
  it('allows administrators and generates a changed title slug', async () => {
    prisma.news.findUnique.mockResolvedValueOnce(existing).mockResolvedValueOnce(null);
    await service.update(id, { ...user, id: '000000000000000000000002', role: Role.ADMIN }, { title: 'Changed title' });
    expect(prisma.$runCommandRaw.mock.calls[0][0].updates[0].u.$set).toMatchObject({ title: 'Changed title', slug: 'changed-title' });
  });
  it.each([
    [{ ok: 1, n: 0 }, NotFoundException],
    [{ ok: 1, n: 0, writeErrors: [{ code: 11000 }] }, ConflictException],
    [{ ok: 1, n: 0, writeErrors: [{ code: 121 }] }, InternalServerErrorException],
    [{ ok: 1, n: 1, writeConcernError: { code: 64 } }, InternalServerErrorException],
  ])('does not report success or delete the old image on write failure %j', async (result, errorType) => {
    prisma.$runCommandRaw.mockResolvedValueOnce(result);
    await expect(service.update(id, user, {}, { filename: 'new.jpg' } as Express.Multer.File)).rejects.toBeInstanceOf(errorType);
    expect(removeImageByUrl).not.toHaveBeenCalled();
    expect(prisma.news.findUniqueOrThrow).not.toHaveBeenCalled();
  });
  it('removes the old image after a successful replacement', async () => {
    await service.update(id, user, {}, { filename: 'new.jpg' } as Express.Multer.File);
    expect(removeImageByUrl).toHaveBeenCalledWith(existing.coverImage);
  });
});
