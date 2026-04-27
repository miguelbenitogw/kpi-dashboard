export function getAllowedEmailDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
}

export function getAllowedEmails(): string[] {
  return (process.env.ALLOWED_EMAILS ?? '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean)
}

export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false

  const normalized = email.toLowerCase()
  const allowedEmails = getAllowedEmails()
  const allowedDomains = getAllowedEmailDomains()

  const noRestrictions = allowedEmails.length === 0 && allowedDomains.length === 0
  if (noRestrictions) return true

  if (allowedEmails.includes(normalized)) return true

  const domain = normalized.split('@')[1]
  if (!domain) return false

  return allowedDomains.includes(domain)
}
