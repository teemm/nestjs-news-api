import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { AbstractLoader } from '@nestjs/serve-static/dist/loaders/abstract.loader';
import { ExpressLoader } from '@nestjs/serve-static/dist/loaders/express.loader';
import { removeVideoByUrl, removeVideoThumbnailByUrl } from './common/config/multer.config';
import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { PrismaService } from './prisma/prisma.service';

describe('Merged API routes', () => {
  let app: INestApplication;
  let token: string;
  const uploadedUrls: string[] = [];
  const uploadedThumbnailUrls: string[] = [];
  const admin = { id: '000000000000000000000001', name: 'Test admin', email: 'admin@example.test', role: 'ADMIN' };
  const banner = { id: '000000000000000000000002', title: 'Test banner', image: '/uploads/banners/test.png', link: 'https://example.test', active: true, sortOrder: 0 };
  const contactMessage = { id: '000000000000000000000004', name: 'Visitor', email: 'visitor@example.test', subject: 'Project question', message: 'Please tell me more about your services.', read: false, createdAt: new Date('2026-09-15T08:00:00Z') };
  const video = { id: '000000000000000000000003', title: 'Test video', url: 'https://youtube.com/watch?v=test', thumbnailUrl: 'https://img.youtube.com/vi/test/hqdefault.jpg', active: true, sortOrder: 0 };
  const prisma = {
    $runCommandRaw: jest.fn().mockResolvedValue({ ok: 1, n: 1 }),
    user: { findMany: jest.fn().mockResolvedValue([admin]), findUnique: jest.fn().mockResolvedValue(admin) },
    banner: {
      findMany: jest.fn().mockResolvedValue([banner]),
      findUnique: jest.fn().mockResolvedValue(banner),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...banner, ...data })),
    },
    contactMessage: {
      findMany: jest.fn().mockResolvedValue([contactMessage]), count: jest.fn().mockResolvedValue(1),
      findUnique: jest.fn().mockResolvedValue(contactMessage),
    },
    video: {
      findMany: jest.fn().mockResolvedValue([video]),
      findUnique: jest.fn().mockResolvedValue(video),
      create: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...video, ...data })),
      update: jest.fn().mockImplementation(({ data }: { data: object }) => Promise.resolve({ ...video, ...data })),
      delete: jest.fn().mockResolvedValue(video),
    },
    news: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
  };

  beforeAll(async () => {
    const environment: Record<string, string> = {
      DATABASE_URL: 'mongodb://127.0.0.1:27017/test',
      JWT_ACCESS_SECRET: 'test-access-secret-only-123',
      JWT_REFRESH_SECRET: 'test-refresh-secret-only-123',
      JWT_ACCESS_EXPIRES: '15m', JWT_REFRESH_EXPIRES: '7d',
      PORT: '3000', APP_URL: 'http://127.0.0.1:3000',
    };
    Object.assign(process.env, environment);
    const { AppModule } = await import('./app.module');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(PrismaService).useValue(prisma)
      // TestingModule compiles before the HTTP adapter exists, so select the real static loader.
      .overrideProvider(AbstractLoader).useClass(ExpressLoader)
      .overrideProvider(ConfigService).useValue({ get: (key: string) => environment[key] })
      .compile();
    app = module.createNestApplication();
    app.useLogger(false);
    app.setGlobalPrefix('api');
    await app.init();
    token = new JwtService().sign({ sub: admin.id, type: 'access' }, { secret: environment.JWT_ACCESS_SECRET });
  });

  afterEach(() => { uploadedUrls.splice(0).forEach(removeVideoByUrl); uploadedThumbnailUrls.splice(0).forEach(removeVideoThumbnailByUrl); });

  afterAll(async () => { if (app) await app.close(); });

  it('loads active and all banners and the random banner endpoint', async () => {
    await request(app.getHttpServer()).get('/api/banners').expect(200).expect([banner]);
    expect(prisma.banner.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: { active: true } }));
    await request(app.getHttpServer()).get('/api/banners?all=true').expect(200);
    expect(prisma.banner.findMany).toHaveBeenLastCalledWith(expect.objectContaining({ where: undefined }));
    await request(app.getHttpServer()).get('/api/banners/random').expect(200).expect(banner);
  });

  it('keeps news and the newly added safe users list available', async () => {
    await request(app.getHttpServer()).get('/api/news').expect(200);
    await request(app.getHttpServer()).get('/api/users').expect(200).expect([admin]);
    expect(prisma.user.findMany).toHaveBeenCalledWith(expect.objectContaining({
      select: expect.not.objectContaining({ password: true }),
    }));
  });

  it('protects banner mutations and allows an admin to edit and clear a link', async () => {
    await request(app.getHttpServer()).delete('/api/banners/' + banner.id).expect(401);
    await request(app.getHttpServer()).post('/api/banners').send({ title: 'Denied' }).expect(401);
    const response = await request(app.getHttpServer()).patch('/api/banners/' + banner.id)
      .set('Authorization', 'Bearer ' + token).send({ title: 'Updated banner', link: '' }).expect(200);
    expect(response.body.title).toBe('Updated banner');
    expect(response.body.link).toBeNull();
  });

  it('lists videos publicly and protects video changes for admins', async () => {
    await request(app.getHttpServer()).get('/api/videos').expect(200).expect([video]);
    await request(app.getHttpServer()).post('/api/videos').send(video).expect(401);
    const created = await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token)
      .send({ title: video.title, url: video.url, thumbnailUrl: video.thumbnailUrl, active: true, sortOrder: 0 })
      .expect(201);
    expect(created.body.title).toBe(video.title);
    await request(app.getHttpServer()).delete('/api/videos/' + video.id).expect(401);
    await request(app.getHttpServer()).delete('/api/videos/' + video.id)
      .set('Authorization', 'Bearer ' + token).expect(200);
  });


  it('uploads and serves a video, then removes the stored file when switching to a link', async () => {
    const created = await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token)
      .field('title', 'Uploaded clip').field('active', 'true').field('sortOrder', '2')
      .attach('video', Buffer.from('video transport fixture'), { filename: 'clip.mp4', contentType: 'video/mp4' })
      .attach('thumbnail', Buffer.from('preview image fixture'), { filename: 'preview.webp', contentType: 'image/webp' })
      .expect(201);
    uploadedUrls.push(created.body.url);
    uploadedThumbnailUrls.push(created.body.thumbnailUrl);
    expect(created.body.url).toMatch(/\/uploads\/videos\/[a-f0-9-]+\.mp4$/);
    expect(created.body.thumbnailUrl).toMatch(/\/uploads\/video-thumbnails\/[a-f0-9-]+\.webp$/);
    expect(created.body.active).toBe(true);
    expect(created.body.sortOrder).toBe(2);
    const mediaPath = new URL(created.body.url).pathname;
    const thumbnailPath = new URL(created.body.thumbnailUrl).pathname;
    await request(app.getHttpServer()).get(thumbnailPath).expect(200).expect('Content-Type', /image\/webp/);
    const served = await request(app.getHttpServer()).get(mediaPath).set('Range', 'bytes=0-4');
    if (served.status !== 206) throw new Error('Media response: ' + served.status + ' ' + served.text);
    expect(served.headers['content-type']).toContain('video/mp4');
    expect(served.headers['content-range']).toBe('bytes 0-4/23');
    const linked = { ...created.body, url: video.url, thumbnailUrl: video.thumbnailUrl };
    prisma.video.findUnique.mockResolvedValueOnce(created.body).mockResolvedValueOnce(linked);
    await request(app.getHttpServer()).patch('/api/videos/' + created.body.id)
      .set('Authorization', 'Bearer ' + token)
      .send({ url: video.url, thumbnailUrl: video.thumbnailUrl }).expect(200);
    await request(app.getHttpServer()).get(mediaPath).expect(404);
    await request(app.getHttpServer()).get(thumbnailPath).expect(404);
  });

  it('deletes uploaded video files along with their records', async () => {
    const created = await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token).field('title', 'Delete this clip')
      .attach('video', Buffer.from('clip'), { filename: 'clip.webm', contentType: 'video/webm' }).expect(201);
    uploadedUrls.push(created.body.url);
    const mediaPath = new URL(created.body.url).pathname;
    prisma.video.findUnique.mockResolvedValueOnce(created.body);
    await request(app.getHttpServer()).delete('/api/videos/' + created.body.id)
      .set('Authorization', 'Bearer ' + token).expect(200);
    await request(app.getHttpServer()).get(mediaPath).expect(404);
  });

  it('rejects unsupported uploads and cleans up files after failed validation', async () => {
    const directory = join(process.cwd(), 'uploads', 'videos');
    const before = readdirSync(directory).sort();
    await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token).field('title', 'Invalid upload')
      .attach('video', Buffer.from('text'), { filename: 'clip.txt', contentType: 'text/plain' }).expect(400);
    await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token)
      .attach('video', Buffer.from('clip'), { filename: 'clip.mp4', contentType: 'video/mp4' }).expect(400);
    prisma.$runCommandRaw.mockRejectedValueOnce(new Error('Test storage failure'));
    await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token).field('title', 'Failed save')
      .attach('video', Buffer.from('clip'), { filename: 'clip.mp4', contentType: 'video/mp4' }).expect(500);
    expect(readdirSync(directory).sort()).toEqual(before);
    await request(app.getHttpServer()).post('/api/videos')
      .set('Authorization', 'Bearer ' + token).send({ title: 'Missing video' }).expect(400);
  });

  it('stores contact messages publicly and restricts the inbox to admins', async () => {
    const input = { name: contactMessage.name, email: contactMessage.email, subject: contactMessage.subject, message: contactMessage.message };
    const created = await request(app.getHttpServer()).post('/api/contact-messages').send(input).expect(201);
    expect(created.body).toMatchObject({ ...input, read: false });
    await request(app.getHttpServer()).get('/api/contact-messages').expect(401);
    await request(app.getHttpServer()).get('/api/contact-messages/count').expect(401);
    const inbox = await request(app.getHttpServer()).get('/api/contact-messages')
      .set('Authorization', 'Bearer ' + token).expect(200);
    expect(inbox.body).toEqual([expect.objectContaining({ email: contactMessage.email })]);
    await request(app.getHttpServer()).get('/api/contact-messages/count')
      .set('Authorization', 'Bearer ' + token).expect(200).expect({ unread: 1 });
    prisma.contactMessage.findUnique
      .mockResolvedValueOnce(contactMessage).mockResolvedValueOnce({ ...contactMessage, read: true });
    const updated = await request(app.getHttpServer()).patch('/api/contact-messages/' + contactMessage.id)
      .set('Authorization', 'Bearer ' + token).send({ read: true }).expect(200);
    expect(updated.body.read).toBe(true);
    prisma.contactMessage.findUnique.mockResolvedValueOnce(contactMessage);
    await request(app.getHttpServer()).delete('/api/contact-messages/' + contactMessage.id)
      .set('Authorization', 'Bearer ' + token).expect(200);
  });

  it('preserves chat routes without requiring AI keys to start the API', async () => {
    await request(app.getHttpServer()).post('/api/chat').send({ message: 'Hello' }).expect(503);
  });
});
