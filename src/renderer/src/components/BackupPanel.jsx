import { useEffect, useState } from 'react'
import { backupApi } from '../api/ipc.js'
import { useAuth } from '../context/AuthContext.jsx'
import Icon from './Icons.jsx'
import Modal from './Modal.jsx'

const fmtSize = (n) =>
  n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`
const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : '—')
const KIND = {
  auto: 'Auto',
  manual: 'Manual',
  'before-update': 'Before update',
  'before-restore': 'Before restore'
}
const kindOf = (name) => KIND[(name.match(/^BrandLover_(.+?)_\d{4}-/) || [])[1]] || '—'
const onSystemDrive = (p) => /^c:/i.test(p || '')

// Admin Settings → Backup: where backups go, Backup Now, and Restore.
export default function BackupPanel() {
  const { session, logout } = useAuth()
  const [st, setSt] = useState(null)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState('')
  const [confirmFile, setConfirmFile] = useState(null) // backup picked for restore
  const isOwner = session?.role === 'administrator'

  const load = () =>
    backupApi
      .status()
      .then(setSt)
      .catch((e) => setErr(e.message))

  useEffect(() => {
    load()
  }, [])

  const run = async (label, fn) => {
    setMsg('')
    setErr('')
    setBusy(label)
    try {
      await fn()
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy('')
      load()
    }
  }

  const backupNow = () =>
    run('backup', async () => {
      const r = await backupApi.create()
      setMsg(
        `Backup ban gaya: ${r.file} (${fmtSize(r.size)}, ${r.rows} records)` +
          (r.warning ? `\n⚠ ${r.warning}` : '')
      )
    })

  const pickFolder = (key) =>
    run('folder', async () => {
      const p = await backupApi.chooseFolder({
        title: key === 'folder' ? 'Main backup folder' : 'Second backup folder (USB / Google Drive)'
      })
      if (p) await backupApi.updateSettings({ [key]: p })
    })

  const clearExtra = () => run('folder', () => backupApi.updateSettings({ extraFolder: '' }))

  const doRestore = (file) =>
    run('restore', async () => {
      setConfirmFile(null)
      const r = await backupApi.restore({ file: file === true ? undefined : file })
      if (r?.canceled) return
      alert(
        'Restore mukammal ho gaya. Sab records wapas aa gaye.\n\n' +
          'Purana data (restore se pehle wala) yahan mehfooz hai:\n' +
          r.safetyBackup +
          '\n\nAb dobara login karein (backup wale password se).'
      )
      logout()
    })

  if (!st) {
    return (
      <div className="st-pane-body">
        <p className="muted-text">{err || 'Loading…'}</p>
      </div>
    )
  }

  const stale = !st.lastBackupAt || Date.now() - new Date(st.lastBackupAt) > 2 * 864e5

  return (
    <>
      {msg && <div className="inv-notice" style={{ whiteSpace: 'pre-line' }}>{msg}</div>}
      {err && <div className="login-error" style={{ whiteSpace: 'pre-line', marginBottom: 10 }}>{err}</div>}
      <div className="st-pane-body">
        <div className="st-receipt-form">
          <div className="st-card">
            <h3 className="st-card-title">Backup Status</h3>
            <p className={stale ? 'bk-warn' : 'bk-ok'}>
              <Icon name={stale ? 'alert' : 'check'} size={15} /> Last backup:{' '}
              <strong>{fmtDate(st.lastBackupAt)}</strong>
            </p>
            {st.lastError && <p className="bk-warn">⚠ {st.lastError}</p>}
            <p className="muted-text">
              Auto backup: roz aik dafa + har dafa app band karne par + har update se pehle.
              Har din ka aakhri backup {st.keep} din tak rakha jata hai.
            </p>
            <div className="bk-btns">
              <button className="btn-sm primary" onClick={backupNow} disabled={!!busy}>
                <Icon name="download" size={15} />{' '}
                {busy === 'backup' ? 'Backup ban raha hai…' : 'Backup Now'}
              </button>
              <button className="btn-sm ghost" onClick={() => backupApi.openFolder().catch((e) => setErr(e.message))}>
                <Icon name="book" size={15} /> Open Backup Folder
              </button>
            </div>
          </div>

          <div className="st-card">
            <h3 className="st-card-title">Backup Folders</h3>
            <label className="field">
              <span>Main folder</span>
              <div className="bk-path">
                <input value={st.folder} readOnly />
                <button className="btn-sm ghost" onClick={() => pickFolder('folder')} disabled={!!busy}>
                  Change
                </button>
              </div>
            </label>
            {onSystemDrive(st.folder) && (
              <p className="bk-warn">
                ⚠ Yeh folder C: drive par hai — Windows dobara install karne par yeh mit jayega.
                Neeche Second folder (USB / Google Drive) zaroor lagayein.
              </p>
            )}
            <label className="field" style={{ marginBottom: 0 }}>
              <span>Second folder — USB / Google Drive / OneDrive (recommended)</span>
              <div className="bk-path">
                <input value={st.extraFolder || ''} placeholder="Not set" readOnly />
                <button className="btn-sm ghost" onClick={() => pickFolder('extraFolder')} disabled={!!busy}>
                  Choose
                </button>
                {st.extraFolder && (
                  <button className="btn-sm ghost" onClick={clearExtra} disabled={!!busy}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>
            </label>
          </div>

          <div className="st-card">
            <h3 className="st-card-title">Restore (Windows crash ke baad)</h3>
            <ol className="st-steps">
              <li>Windows → MySQL → Brand Lover POS install karein, Administrator se login karein.</li>
              <li>
                Yahan <b>Restore from file</b> dabayein aur backup folder (USB / D: drive / Google
                Drive) se sab se <b>naya</b> <code>BrandLover_….sql</code> file chunein (purani{' '}
                <code>.sql.gz</code> files bhi chalti hain).
              </li>
              <li>Sab records wapas aa jayenge. Phir apne purane password se login karein.</li>
            </ol>
            {isOwner ? (
              <button className="btn-sm danger" onClick={() => setConfirmFile(true)} disabled={!!busy}>
                <Icon name="upload" size={15} />{' '}
                {busy === 'restore' ? 'Restore ho raha hai…' : 'Restore from file…'}
              </button>
            ) : (
              <p className="muted-text">Restore sirf Owner / Admin kar sakta hai.</p>
            )}
          </div>

          <div className="st-card">
            <h3 className="st-card-title">Recent Backups ({st.backups.length})</h3>
            {st.backups.length === 0 ? (
              <p className="muted-text">Abhi koi backup nahi — &quot;Backup Now&quot; dabayein.</p>
            ) : (
              <div className="st-table-wrap" style={{ maxHeight: 320 }}>
                <table className="data-table st-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Type</th>
                      <th>Size</th>
                      {isOwner && <th></th>}
                    </tr>
                  </thead>
                  <tbody>
                    {st.backups.slice(0, 50).map((b) => (
                      <tr key={b.name} title={b.path}>
                        <td>{fmtDate(b.modifiedAt)}</td>
                        <td>{kindOf(b.name)}</td>
                        <td>{fmtSize(b.size)}</td>
                        {isOwner && (
                          <td>
                            <button
                              className="btn-sm ghost"
                              onClick={() => setConfirmFile(b.path)}
                              disabled={!!busy}
                            >
                              Restore
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {confirmFile && (
        <Modal
          title="Restore backup?"
          width={480}
          onClose={() => setConfirmFile(null)}
          footer={
            <>
              <button className="btn-secondary" onClick={() => setConfirmFile(null)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={() => doRestore(confirmFile)}>
                Yes, Restore
              </button>
            </>
          }
        >
          <p>
            Is computer ka <b>maujooda sara data</b> backup wale data se badal diya jayega.
          </p>
          <p className="muted-text" style={{ marginTop: 8 }}>
            Hifazat ke liye, restore se pehle maujooda data ka aik backup khud ban jayega
            (&quot;Before restore&quot;).
          </p>
          {confirmFile !== true && (
            <p className="muted-text" style={{ marginTop: 8, wordBreak: 'break-all' }}>
              File: {confirmFile}
            </p>
          )}
        </Modal>
      )}
    </>
  )
}
