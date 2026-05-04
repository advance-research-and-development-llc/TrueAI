import http from 'node:http'
import { URL } from 'node:url'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import type { BootstrapAdminInput, BootstrapStatus } from '@trueai/shared'

type JsonValue = null | boolean | number | string | JsonValue[] | { [k: string]: JsonValue }

const DEFAULT_PORT = Number(process.env.TRUEAI_TEAMD_PORT ?? 3210)
const DATA_DIR = process.env.TRUEAI_DATA_DIR ?? defaultDataDir()
const DB_PATH = join(DATA_DIR, 'db.json')

interface DbShape {
  users: Array<{ id: string; username: string; passwordHash: string; role: 'admin' }>
}

function defaultDataDir() {
  const home = process.env.HOME ?? process.cwd()
  return join(home, '.trueai-teamd')
}

function readDb(): DbShape {
  try {
    const raw = readFileSync(DB_PATH, 'utf8')
    const parsed = JSON.parse(raw) as Partial<DbShape>
    return {
      users: Array.isArray(parsed.users) ? (parsed.users as DbShape['users']) : [],
    }
  } catch {
    return { users: [] }
  }
}

function writeDb(db: DbShape) {
  mkdirSync(DATA_DIR, { recursive: true })
  // Atomic-ish write: write to temp then rename would be better; keep v1 simple.
  const raw = JSON.stringify(db, null, 2)
  writeFileSync(DB_PATH, raw, 'utf8')
}

function json(res: http.ServerResponse, statusCode: number, body: JsonValue) {
  const raw = JSON.stringify(body)
  res.writeHead(statusCode, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(raw),
  })
  res.end(raw)
}

function readJson(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    req.on('data', (d: Buffer) => chunks.push(d))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw) return resolve(null)
      try {
        resolve(JSON.parse(raw))
      } catch (e) {
        reject(e)
      }
    })
    req.on('error', reject)
  })
}

function hashPassword(password: string): string {
  const salt = randomBytes(16)
  const key = scryptSync(password, salt, 32)
  return `scrypt:${salt.toString('hex')}:${key.toString('hex')}`
}

function verifyPassword(password: string, stored: string): boolean {
  const parts = stored.split(':')
  if (parts.length !== 3 || parts[0] !== 'scrypt') return false
  const salt = Buffer.from(parts[1] as string, 'hex')
  const key = Buffer.from(parts[2] as string, 'hex')
  const derived = scryptSync(password, salt, 32)
  return timingSafeEqual(key, derived)
}

function bootstrapStatus(db: DbShape): BootstrapStatus {
  return db.users.length === 0
    ? { bootstrapRequired: true }
    : { bootstrapRequired: false }
}

function routeAllowedWhenBootstrapping(pathname: string): boolean {
  return (
    pathname === '/health' ||
    pathname === '/bootstrap/status' ||
    pathname === '/bootstrap/admin'
  )
}

export function startServer(port = DEFAULT_PORT) {
  mkdirSync(DATA_DIR, { recursive: true })

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)
    const pathname = url.pathname
    const method = (req.method ?? 'GET').toUpperCase()

    const db = readDb()
    const status = bootstrapStatus(db)

    if (pathname === '/health' && method === 'GET') {
      return json(res, 200, { ok: true, ...status })
    }

    if (pathname === '/bootstrap/status' && method === 'GET') {
      return json(res, 200, status)
    }

    if (status.bootstrapRequired && !routeAllowedWhenBootstrapping(pathname)) {
      return json(res, 403, { error: 'bootstrap_required' })
    }

    if (pathname === '/bootstrap/admin' && method === 'POST') {
      if (!status.bootstrapRequired) {
        return json(res, 409, { error: 'bootstrap_already_completed' })
      }
      let body: unknown
      try {
        body = await readJson(req)
      } catch {
        return json(res, 400, { error: 'invalid_json' })
      }
      const input = body as Partial<BootstrapAdminInput>
      const username = typeof input.username === 'string' ? input.username.trim() : ''
      const password = typeof input.password === 'string' ? input.password : ''
      if (!username || password.length < 12) {
        return json(res, 400, { error: 'invalid_input' })
      }
      const newDb: DbShape = {
        users: [
          {
            id: randomBytes(16).toString('hex'),
            username,
            passwordHash: hashPassword(password),
            role: 'admin',
          },
        ],
      }
      writeDb(newDb)
      return json(res, 201, { ok: true })
    }

    if (pathname === '/auth/login' && method === 'POST') {
      let body: unknown
      try {
        body = await readJson(req)
      } catch {
        return json(res, 400, { error: 'invalid_json' })
      }
      const input = body as Partial<{ username: string; password: string }>
      const username = typeof input.username === 'string' ? input.username.trim() : ''
      const password = typeof input.password === 'string' ? input.password : ''
      const user = db.users.find(u => u.username === username)
      if (!user || !verifyPassword(password, user.passwordHash)) {
        return json(res, 401, { error: 'invalid_credentials' })
      }
      // v1: no sessions yet.
      return json(res, 200, { ok: true, role: user.role })
    }

    return json(res, 404, { error: 'not_found' })
  })

  server.listen(port)
  return server
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').toString()) {
  console.log(`[teamd] listening on http://127.0.0.1:${DEFAULT_PORT}`)
  startServer(DEFAULT_PORT)
}

function pathToFileURL(path: string) {
  const abs = path.startsWith('/') ? path : join(process.cwd(), path)
  return new URL(`file://${abs}`)
}
