// HTTP transport for window.api in the browser.
// API base: VITE_API_URL (e.g. https://brand-lover-pos-api.onrender.com) or same origin.
export const API_BASE = (import.meta.env.VITE_API_URL || '').replace(/\/+$/, '')

const TOKEN_KEY = 'blpos_token'
const getToken = () => sessionStorage.getItem(TOKEN_KEY)

// Channels that used a native "Open file" dialog on the desktop → browser file picker.
const UPLOAD_CHANNELS = {
  'inventory:items:import': '.xlsx,.xls,.csv',
  'backup:restore': '.sql,.gz'
}

// ---------- "Connecting to server" banner (free hosting sleeps when idle) ----------
let pending = 0
let bannerTimer = null
function banner(show) {
  let el = document.getElementById('api-wait-banner')
  if (!el) {
    el = document.createElement('div')
    el.id = 'api-wait-banner'
    el.innerHTML =
      '<span class="api-wait-spinner"></span><span>Connecting to server… (first load after idle can take up to a minute)</span>'
    document.body.appendChild(el)
  }
  el.classList.toggle('show', show)
}
function begin() {
  pending++
  if (!bannerTimer) bannerTimer = setTimeout(() => banner(true), 2500)
}
function end() {
  pending = Math.max(0, pending - 1)
  if (pending === 0) {
    clearTimeout(bannerTimer)
    bannerTimer = null
    banner(false)
  }
}

function pickFile(accept) {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    input.style.display = 'none'
    input.onchange = () => resolve(input.files?.[0] || null)
    // Cancel has no event in older browsers; focus returning is a good-enough signal.
    window.addEventListener('focus', () => setTimeout(() => !input.files?.length && resolve(null), 800), {
      once: true
    })
    document.body.appendChild(input)
    input.click()
    setTimeout(() => input.remove(), 60000)
  })
}

async function fileToBase64(file) {
  const buf = new Uint8Array(await file.arrayBuffer())
  let bin = ''
  for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000))
  return btoa(bin)
}

export function saveDownload({ filename, base64, mime }) {
  const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }))
  const a = Object.assign(document.createElement('a'), { href: url, download: filename })
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function sessionExpired() {
  const had = sessionStorage.getItem('session')
  sessionStorage.removeItem(TOKEN_KEY)
  sessionStorage.removeItem('session')
  if (had) {
    location.hash = '#/login'
    location.reload()
  }
}

export async function invoke(channel, payload) {
  let upload
  if (UPLOAD_CHANNELS[channel]) {
    const file = await pickFile(UPLOAD_CHANNELS[channel])
    if (!file) return { ok: true, data: { canceled: true } }
    upload = { name: file.name, base64: await fileToBase64(file) }
  }

  begin()
  try {
    let res
    for (let attempt = 0; ; attempt++) {
      try {
        res = await fetch(`${API_BASE}/api/rpc/${encodeURIComponent(channel)}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {})
          },
          body: JSON.stringify({ payload: payload ?? null, upload })
        })
      } catch {
        res = null // network error / server waking up
      }
      // 502/503/network = server is starting (cold start) → wait and retry for ~90 s.
      if (res && res.status !== 502 && res.status !== 503 && res.status !== 504) break
      if (attempt >= 30) {
        return { ok: false, error: 'Cannot reach the server. Please check your internet and try again.' }
      }
      banner(true)
      await new Promise((r) => setTimeout(r, 3000))
    }

    let body
    try {
      body = await res.json()
    } catch {
      return { ok: false, error: `Server error (${res.status}).` }
    }

    if (channel === 'auth:login' && body?.ok && body.data?.token) {
      sessionStorage.setItem(TOKEN_KEY, body.data.token)
    }
    if (channel === 'auth:logout') sessionStorage.removeItem(TOKEN_KEY)
    if (body && !body.ok && /not logged in/i.test(body.error || '')) sessionExpired()

    if (body?.ok && body.data?.download) {
      saveDownload(body.data.download)
      delete body.data.download
    }
    return body
  } finally {
    end()
  }
}
