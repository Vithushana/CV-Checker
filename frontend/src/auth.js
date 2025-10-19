// src/auth.js
const API_URL = 'http://localhost:5000'

const KEY = 'cvchecker_token'
export function getToken() { return localStorage.getItem(KEY) || '' }
export function setToken(t) { t ? localStorage.setItem(KEY, t) : localStorage.removeItem(KEY) }

export async function requestOtp(email) {
  const r = await fetch(`${API_URL}/api/auth/request-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  if (!r.ok) throw new Error(await r.text() || 'otp_failed')
  return r.json()
}

export async function verifyOtp(email, code) {
  const r = await fetch(`${API_URL}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code }),
  })
  if (!r.ok) throw new Error(await r.text() || 'verify_failed')
  return r.json() // { token, user }
}
