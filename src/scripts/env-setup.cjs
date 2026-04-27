// CommonJS env setup loaded via --require before ES module imports are resolved.
// Fixes: (1) missing env vars, (2) OpenSSL 3.x private_key newline issue.
const fs = require('fs')
const path = require('path')

function loadEnvFile(p) {
  try {
    const lines = fs.readFileSync(p, 'utf-8').split(/\r?\n/)
    for (const line of lines) {
      const t = line.trim()
      if (!t || t.startsWith('#')) continue
      const i = t.indexOf('=')
      if (i < 0) continue
      const k = t.slice(0, i).trim()
      let v = t.slice(i + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      v = v.replace(/\\n$/g, '').trim()
      if (!process.env[k]) process.env[k] = v
    }
  } catch {}
}

loadEnvFile(path.resolve(process.cwd(), '.env.production-local'))
loadEnvFile(path.resolve(process.cwd(), '.env.local'))

// Fix OpenSSL 3.x private_key newline issue
const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON
if (raw) {
  try {
    const parsed = JSON.parse(raw)
    if (parsed.private_key) {
      parsed.private_key = parsed.private_key.replace(/\\+n/g, '\n')
      process.env.GOOGLE_SERVICE_ACCOUNT_JSON = JSON.stringify(parsed)
    }
  } catch {}
}
