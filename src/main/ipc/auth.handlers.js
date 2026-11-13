import bcrypt from 'bcryptjs'
import pool from '../db/pool.js'
import {
  authorize,
  verifyPassword,
  setSessionUser,
  getSessionUserId,
  ADMIN_ROLES
} from '../services/auth.guard.js'

export function registerAuthHandlers(ipcMain) {
  ipcMain.handle('auth:list-users', async () => {
    try {
      const [rows] = await pool.query(
        'SELECT id, username, full_name, role FROM users WHERE is_active = 1 ORDER BY username'
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('auth:login', async (_e, creds) => {
    try {
      const { username, password } = creds || {}
      if (!username || !password) {
        return { ok: false, error: 'Username and password are required.' }
      }
      const [rows] = await pool.query(
        'SELECT * FROM users WHERE username = ? AND is_active = 1 LIMIT 1',
        [username]
      )
      if (rows.length === 0) return { ok: false, error: 'User not found.' }

      const user = rows[0]
      const match = await bcrypt.compare(password, user.password_hash)
      if (!match) return { ok: false, error: 'Incorrect password.' }

      await pool.query('UPDATE users SET last_login = NOW() WHERE id = ?', [
        user.id
      ])
      setSessionUser(user.id) // the main process now knows who is logged in
      return {
        ok: true,
        data: {
          id: user.id,
          username: user.username,
          fullName: user.full_name,
          role: user.role
        }
      }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  ipcMain.handle('auth:logout', async () => {
    setSessionUser(null)
    return { ok: true, data: { loggedOut: true } }
  })

  // Re-verify the logged-in user's OWN password — gate for entering Admin Settings.
  ipcMain.handle('auth:verify-password', async (_e, { password } = {}) => {
    try {
      const userId = getSessionUserId()
      if (!userId) return { ok: false, error: 'Not logged in — please log in again.' }
      if (!password) return { ok: false, error: 'Password required.' }
      const ok = await verifyPassword(userId, password)
      return ok
        ? { ok: true, data: { verified: true } }
        : { ok: false, error: 'Incorrect password.' }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Change own password — requires the current password.
  ipcMain.handle(
    'auth:change-password',
    async (_e, { currentPassword, newPassword } = {}) => {
      try {
        const actingUserId = getSessionUserId() // only your OWN password
        if (!actingUserId) return { ok: false, error: 'Not logged in — please log in again.' }
        if (!newPassword || newPassword.length < 4)
          return {
            ok: false,
            error: 'New password must be at least 4 characters.'
          }
        const ok = await verifyPassword(actingUserId, currentPassword)
        if (!ok) return { ok: false, error: 'Current password is incorrect.' }
        const hash = await bcrypt.hash(newPassword, 10)
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
          hash,
          actingUserId
        ])
        return { ok: true, data: { changed: true } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // Admin: full user list (incl. inactive).
  ipcMain.handle('auth:list-users-admin', async (_e, { actingUserId }) => {
    try {
      await authorize(actingUserId, ADMIN_ROLES)
      const [rows] = await pool.query(
        `SELECT id, username, full_name, role, is_active, last_login, created_at
           FROM users ORDER BY is_active DESC, full_name`
      )
      return { ok: true, data: rows }
    } catch (err) {
      return { ok: false, error: err.message }
    }
  })

  // Admin: create a user (defaults to salesman/cashier).
  ipcMain.handle(
    'auth:create-user',
    async (_e, { actingUserId, username, fullName, password, role }) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        const uname = (username || '').trim()
        const fname = (fullName || '').trim()
        if (!uname || !fname)
          return { ok: false, error: 'Username and full name are required.' }
        if (!password || password.length < 4)
          return { ok: false, error: 'Password must be at least 4 characters.' }
        const finalRole = ['administrator', 'manager', 'cashier'].includes(role)
          ? role
          : 'cashier'
        const [exist] = await pool.query(
          'SELECT id FROM users WHERE username = ? LIMIT 1',
          [uname]
        )
        if (exist.length)
          return { ok: false, error: 'That username is already taken.' }
        const hash = await bcrypt.hash(password, 10)
        const [res] = await pool.query(
          `INSERT INTO users (username, password_hash, full_name, role, is_active)
         VALUES (?, ?, ?, ?, 1)`,
          [uname, hash, fname, finalRole]
        )
        return { ok: true, data: { id: res.insertId } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // Admin: update name / role / active status (with safety rails).
  ipcMain.handle(
    'auth:update-user',
    async (_e, { actingUserId, id, fullName, role, isActive }) => {
      try {
        const admin = await authorize(actingUserId, ADMIN_ROLES)
        const finalRole = ['administrator', 'manager', 'cashier'].includes(role)
          ? role
          : undefined
        if (Number(id) === Number(admin.id) && isActive === false)
          return { ok: false, error: "You can't deactivate your own account." }
        if (
          Number(id) === Number(admin.id) &&
          finalRole &&
          finalRole !== admin.role
        )
          return { ok: false, error: "You can't change your own role." }
        // Never let the last active admin be removed/demoted.
        if (
          isActive === false ||
          (finalRole && !ADMIN_ROLES.includes(finalRole))
        ) {
          const [[u]] = await pool.query(
            'SELECT role FROM users WHERE id = ?',
            [id]
          )
          if (u && ADMIN_ROLES.includes(u.role)) {
            const [[c]] = await pool.query(
              `SELECT COUNT(*) AS n FROM users WHERE is_active = 1 AND role IN ('administrator','manager')`
            )
            if (c.n <= 1)
              return {
                ok: false,
                error: 'At least one active admin must remain.'
              }
          }
        }
        await pool.query(
          `UPDATE users SET full_name = COALESCE(?, full_name),
                          role = COALESCE(?, role),
                          is_active = COALESCE(?, is_active)
          WHERE id = ?`,
          [
            fullName?.trim() || null,
            finalRole || null,
            isActive === undefined ? null : isActive ? 1 : 0,
            id
          ]
        )
        return { ok: true, data: { id } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )

  // Admin: reset another user's password.
  ipcMain.handle(
    'auth:reset-password',
    async (_e, { actingUserId, id, newPassword }) => {
      try {
        await authorize(actingUserId, ADMIN_ROLES)
        if (!newPassword || newPassword.length < 4)
          return { ok: false, error: 'Password must be at least 4 characters.' }
        const hash = await bcrypt.hash(newPassword, 10)
        await pool.query('UPDATE users SET password_hash = ? WHERE id = ?', [
          hash,
          id
        ])
        return { ok: true, data: { id } }
      } catch (err) {
        return { ok: false, error: err.message }
      }
    }
  )
}
