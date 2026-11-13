import { AsyncLocalStorage } from 'node:async_hooks'

// Per-request state for the WEB server (server/index.js). Each HTTP request runs inside
// requestContext.run({ userId, ... }), so the logged-in user, pending downloads and uploaded
// files belong to that request only. The Electron desktop app never enters a context, so
// getStore() returns undefined there and the old single-user behaviour is kept.
export const requestContext = new AsyncLocalStorage()
