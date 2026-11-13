import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'
import { requestContext } from './request.context.js'

export const ADMIN_ROLES = ['administrator', 'manager']
export const ALL_ROLES = ['administrator', 'manager', 'cashier']

export async function getUser(userId) {
  if (!userId) return null
  const [rows] = await pool.query(
    `SELECT id, username, full_name, role, is_active, password_hash
       FROM users WHERE id = ? LIMIT 1`,
    [userId]
  )
  return rows[0] || null
}

// The logged-in user lives HERE, in the main process — set by auth:login, cleared by
// auth:logout. Permission checks use it instead of trusting a user id sent by the window
// (anyone with DevTools could send the Owner's id).
// Web server: the user belongs to the current HTTP request (see request.context.js).
let sessionUserId = null
export function setSessionUser(id) {
  const store = requestContext.getStore()
  if (store) store.userId = id ? Number(id) : null
  else sessionUserId = id ? Number(id) : null
}
export function getSessionUserId() {
  const store = requestContext.getStore()
  return store ? store.userId : sessionUserId
}

// Throws if nobody is logged in, the user is inactive, or lacks an allowed role.
// Reusable by any handler that needs a permission gate. Returns the user row.
// `actingUserId` is kept for the old call sites but ignored — the session user is used.
// eslint-disable-next-line no-unused-vars
export async function authorize(actingUserId, allowedRoles = ADMIN_ROLES) {
  const user = await getUser(getSessionUserId())
  if (!user) throw new Error('Not logged in — please log in again.')
  if (!user.is_active) throw new Error('Your account is inactive.')
  if (!allowedRoles.includes(user.role)) {
    throw new Error('You do not have permission to perform this action.')
  }
  return user
}

export async function verifyPassword(userId, password) {
  const user = await getUser(userId)
  if (!user) return false
  return bcrypt.compare(password, user.password_hash)
}
