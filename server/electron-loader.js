// Node module-resolution hook: `import 'electron'` → server/electron-shim.js
const SHIM = new URL('./electron-shim.js', import.meta.url).href

export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'electron') return { url: SHIM, shortCircuit: true }
  return nextResolve(specifier, context)
}
