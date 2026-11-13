// Runs before the React app (imported first by main.web.jsx).
import '../src/preload/index.js' // defines window.api (all desktop channels → HTTP)
import { installWebPrinting } from './printing.js'
import { API_BASE } from './transport.js'

window.__POS_WEB__ = true
installWebPrinting(window.api)

// Demo logins for the login screen (only when the server runs with DEMO_MODE on).
window.api.demoInfo = async () => {
  const res = await fetch(`${API_BASE}/api/demo-info`)
  const body = await res.json()
  return body?.ok ? body.data : null
}
