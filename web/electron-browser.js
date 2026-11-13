// Browser replacement for 'electron' used by src/preload/index.js in the web build.
// ipcRenderer.invoke(channel, payload) → POST {API}/api/rpc/<channel>
import { invoke } from './transport.js'

export const ipcRenderer = { invoke }

export const contextBridge = {
  exposeInMainWorld(name, api) {
    window[name] = api
  }
}

export default { ipcRenderer, contextBridge }
