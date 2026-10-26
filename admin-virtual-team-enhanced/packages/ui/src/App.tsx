import { useEffect, useMemo, useState } from 'react'
import './App.css'

type BootstrapStatus =
  | { bootstrapRequired: true }
  | { bootstrapRequired: false }

function App() {
  const apiBase = useMemo(
    () => (import.meta.env.VITE_TEAMD_URL as string) || 'http://127.0.0.1:3210',
    [],
  )

  const [status, setStatus] = useState<BootstrapStatus | null>(null)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${apiBase}/bootstrap/status`)
        const data = (await res.json()) as BootstrapStatus
        setStatus(data)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
  }, [apiBase])

  async function handleBootstrap(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`${apiBase}/bootstrap/admin`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ username, password }),
      })

      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as unknown
        throw new Error(`bootstrap failed: ${res.status} ${JSON.stringify(body)}`)
      }

      setStatus({ bootstrapRequired: false })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSubmitting(false)
    }
  }

  if (status?.bootstrapRequired) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'left' }}>
        <h1>Create admin account</h1>
        <p>Team daemon is in bootstrap mode.</p>
        <form onSubmit={handleBootstrap}>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Username
            <input
              value={username}
              onChange={e => setUsername(e.target.value)}
              autoComplete="username"
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <label style={{ display: 'block', marginBottom: 12 }}>
            Password (min 12 chars)
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="new-password"
              style={{ display: 'block', width: '100%' }}
            />
          </label>
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create admin'}
          </button>
        </form>
        {error ? <pre style={{ color: 'crimson' }}>{error}</pre> : null}
      </div>
    )
  }

  if (status && !status.bootstrapRequired) {
    return (
      <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'left' }}>
        <h1>Admin Virtual Team</h1>
        <p>Bootstrap complete. Login UI comes next.</p>
      </div>
    )
  }

  if (error) {
    return (
      <div style={{ maxWidth: 720, margin: '40px auto', textAlign: 'left' }}>
        <h1>Admin Virtual Team</h1>
        <pre style={{ color: 'crimson' }}>{error}</pre>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 520, margin: '40px auto', textAlign: 'left' }}>
      <h1>Admin Virtual Team</h1>
      <p>Loading…</p>
    </div>
  )
}

export default App

