# News API — NestJS 11 + Prisma (MongoDB)

A production-ready REST API: JWT authentication with refresh rotation, role-based access,
paginated news endpoints, and validated image uploads served over HTTP.

- **Runtime:** NestJS 11, TypeScript (strict), Express
- **Data:** Prisma 6 with `provider = "mongodb"` (no SQL migrations — `prisma db push`)
- **Auth:** `@nestjs/jwt` + `passport-jwt`, bcrypt (12 rounds)
- **Uploads:** Multer disk storage, served by `@nestjs/serve-static`
- **Docs:** Swagger UI at `/api/docs`

---

## 1. Install

```bash
npm install
cp .env.example .env      # then edit the two JWT secrets
```

Generate real secrets:

```bash
openssl rand -hex 32      # JWT_ACCESS_SECRET
openssl rand -hex 32      # JWT_REFRESH_SECRET
```

Every variable in `.env` is validated at boot — the process refuses to start with a
missing or malformed value.

| Variable | Example | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `mongodb://localhost:27017/news?replicaSet=rs0&directConnection=true` | Must point at a **replica set** |
| `JWT_ACCESS_SECRET` | `openssl rand -hex 32` | min 16 chars |
| `JWT_REFRESH_SECRET` | `openssl rand -hex 32` | must differ from the access secret |
| `JWT_ACCESS_EXPIRES` | `15m` | |
| `JWT_REFRESH_EXPIRES` | `7d` | |
| `PORT` | `3000` | |
| `APP_URL` | `http://localhost:3000` | Public base URL used to build image URLs |

## 2. Start MongoDB as a single-node replica set

Prisma requires a replica set (it uses transactions), so a plain `mongod` will not do.
The bundled compose file starts one and initiates `rs0` automatically via its healthcheck:

```bash
docker compose up -d
docker compose ps          # wait until the mongo service is "healthy"
```

Already running Mongo elsewhere? Any replica-set-enabled deployment works — just point
`DATABASE_URL` at it (MongoDB Atlas is a replica set out of the box).

## 3. Sync the schema and seed

```bash
npm run prisma:generate    # generate the typed Prisma client
npm run prisma:push        # create collections + indexes from prisma/schema.prisma
npm run seed               # 1 admin, 1 user, 5 news items
```

Or all three at once: `npm run db:setup`.

Seeded accounts:

| Role | Email | Password |
| --- | --- | --- |
| `ADMIN` | `admin@example.com` | `Admin1234` |
| `USER` | `user@example.com` | `User12345` |

The seed is idempotent — it clears the `users` and `news` collections before inserting.

## 4. Run

```bash
npm run start:dev          # watch mode
npm run start:prod         # after npm run build
```

- API: <http://localhost:3000/api>
- Swagger UI: <http://localhost:3000/api/docs>
- Uploaded images: <http://localhost:3000/uploads/news/…>

Other scripts: `npm run build`, `npm test`, `npm run lint`, `npm run format`,
`npm run prisma:studio`.

---

## Endpoints

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| `POST` | `/api/auth/register` | — | Create an account, returns user + token pair |
| `POST` | `/api/auth/login` | — | Returns `accessToken` (15m) + `refreshToken` (7d) |
| `POST` | `/api/auth/refresh` | — | Rotates the pair |
| `GET` | `/api/auth/me` | Bearer | Current user |
| `GET` | `/api/news` | — | Paginated list: `?page&limit&search&tag&published` |
| `GET` | `/api/news/:slug` | — | One item; increments `views` |
| `POST` | `/api/news` | Bearer | `multipart/form-data`, optional `image` field |
| `PATCH` | `/api/news/:id` | Bearer | Author or `ADMIN`; a new image replaces the old file |
| `DELETE` | `/api/news/:id` | Bearer | Author or `ADMIN`; deletes the image file too |

**Listing defaults.** `GET /api/news` returns published items only. Pass
`?published=false` for drafts. `page` defaults to `1`, `limit` to `10` (max `100`).
`search` matches `title`, `excerpt` and `content` case-insensitively; `tag` matches an
exact entry in the `tags` array.

```jsonc
// GET /api/news?limit=2
{
  "data": [ /* news items, each with an embedded `author` */ ],
  "meta": { "total": 4, "page": 1, "limit": 2, "totalPages": 2 }
}
```

**Image rules.** `image/jpeg`, `image/png`, `image/webp` only, max **5 MB**. Files land in
`./uploads/news` named `<uuid><ext>`; `coverImage` comes back as `${APP_URL}/uploads/news/<file>`.
Anything else is rejected with `400` and an explanatory message. Files written by a request
that later fails are removed automatically.

**Errors** share one shape:

```json
{
  "statusCode": 409,
  "error": "Conflict",
  "message": "A record with this email already exists.",
  "path": "/api/auth/register",
  "method": "POST",
  "timestamp": "2026-09-02T07:35:38.676Z"
}
```

`message` is an array of strings when validation fails. Prisma `P2002` maps to `409`,
`P2025` to `404`, `P2003`/`P2023` to `400`.

---

## Example requests

**Register**

```bash
curl -X POST http://localhost:3000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{
        "email": "jane@example.com",
        "password": "Str0ngPassword",
        "name": "Jane Doe"
      }'
```

Passwords need at least 8 characters, one uppercase letter and one digit.

**Login** (capture the token for the next call)

```bash
TOKEN=$(curl -s -X POST http://localhost:3000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"user@example.com","password":"User12345"}' \
  | python3 -c 'import sys,json; print(json.load(sys.stdin)["accessToken"])')
```

**Create a news item with a cover image**

```bash
curl -X POST http://localhost:3000/api/news \
  -H "Authorization: Bearer $TOKEN" \
  -F 'title=Hello Brave New World' \
  -F 'excerpt=A short summary shown in listings.' \
  -F 'content=The full article body, long enough to pass validation.' \
  -F 'tags=nestjs,prisma' \
  -F 'published=true' \
  -F 'image=@./cover.png;type=image/png'
```

```jsonc
{
  "id": "6a97d204b837e0c9d798ca4a",
  "slug": "hello-brave-new-world",          // auto-generated, uniquified with -2, -3, …
  "coverImage": "http://localhost:3000/uploads/news/a15ea3fd-….png",
  "tags": ["nestjs", "prisma"],
  "published": true,
  "views": 0,
  "author": { "id": "…", "email": "user@example.com", "name": "Uma User", "role": "USER" }
}
```

**Replace the image / edit**

```bash
curl -X PATCH http://localhost:3000/api/news/<id> \
  -H "Authorization: Bearer $TOKEN" \
  -F 'title=Hello Braver New World' \
  -F 'image=@./new-cover.webp;type=image/webp'
```

**Delete**

```bash
curl -X DELETE http://localhost:3000/api/news/<id> -H "Authorization: Bearer $TOKEN"
```

**Refresh the token pair**

```bash
curl -X POST http://localhost:3000/api/auth/refresh \
  -H 'Content-Type: application/json' \
  -d '{"refreshToken":"<refreshToken>"}'
```

---

## Project layout

```
prisma/
  schema.prisma            User + News models (ObjectId mapping, Role enum)
  seed.ts                  1 admin, 1 user, 5 news items
src/
  main.ts                  helmet, CORS, /api prefix, Swagger, shutdown hooks
  app.module.ts            env validation, static uploads, global pipe + filter
  config/env.validation.ts typed, validated environment
  prisma/                  global PrismaModule + PrismaService (connect/disconnect)
  common/
    config/multer.config.ts   storage, mime whitelist, size cap, URL helpers
    decorators/               @CurrentUser(), @Roles()
    guards/roles.guard.ts     RolesGuard
    filters/                  AllExceptionsFilter (Prisma + HTTP mapping)
    utils/slug.util.ts        slugify + unit test
  users/                   UsersService (findByEmail / findById / create)
  auth/                    controller, service, JwtStrategy, JwtAuthGuard, DTOs
  news/                    controller, service, DTOs
uploads/news/              runtime image storage (git-ignored)
```

## Security notes

- The password hash is never selected into a response — `UsersService` uses an explicit
  `SAFE_USER_SELECT`, and only `findByEmailWithPassword` reads it for the login check.
- Access and refresh tokens are signed with **different** secrets and carry a `type`
  claim, so a refresh token cannot be replayed against a protected route.
- Login compares against a dummy hash when the email is unknown, so response time does
  not leak account existence.
- `ValidationPipe` runs with `whitelist`, `forbidNonWhitelisted` and `transform`, so
  unknown request properties are rejected with `400`.
- `/uploads` is served with `Cross-Origin-Resource-Policy: cross-origin` so a browser
  front-end on another origin can display the images; everything else is behind helmet.
