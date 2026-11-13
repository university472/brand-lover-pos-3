// Loaded with `node --import ./server/register.js server/index.js`.
import { register } from 'node:module'

process.env.POS_WEB = '1'
process.env.TZ ||= 'Asia/Karachi' // shop time for "today" in reports
register('./electron-loader.js', import.meta.url)
