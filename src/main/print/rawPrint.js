import { spawn } from 'child_process'
import { writeFileSync, mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

// Sends raw bytes straight to a Windows print queue via WinSpool
// (StartDocPrinter/WritePrinter, dataType "RAW"), bypassing the printer
// driver's GDI rendering entirely. Works regardless of which driver
// (ZDesigner etc.) is bound to the queue.
const RAW_PRINT_PS1 = `
param(
  [Parameter(Mandatory=$true)][string]$PrinterName,
  [Parameter(Mandatory=$true)][string]$FilePath
)

Add-Type -TypeDefinition @"
using System;
using System.Runtime.InteropServices;

public class RawPrinterHelper {
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Ansi)]
    public class DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }

    [DllImport("winspool.Drv", EntryPoint = "OpenPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool OpenPrinter(string szPrinter, out IntPtr hPrinter, IntPtr pd);

    [DllImport("winspool.Drv", EntryPoint = "ClosePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool ClosePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartDocPrinterA", SetLastError = true, CharSet = CharSet.Ansi, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartDocPrinter(IntPtr hPrinter, Int32 level, [In, MarshalAs(UnmanagedType.LPStruct)] DOCINFOA di);

    [DllImport("winspool.Drv", EntryPoint = "EndDocPrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndDocPrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "StartPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool StartPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "EndPagePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool EndPagePrinter(IntPtr hPrinter);

    [DllImport("winspool.Drv", EntryPoint = "WritePrinter", SetLastError = true, ExactSpelling = true, CallingConvention = CallingConvention.StdCall)]
    public static extern bool WritePrinter(IntPtr hPrinter, IntPtr pBytes, Int32 dwCount, out Int32 dwWritten);

    public static bool SendBytesToPrinter(string szPrinterName, byte[] bytes) {
        IntPtr hPrinter;
        DOCINFOA di = new DOCINFOA();
        di.pDocName = "ZPL Label Job";
        di.pDataType = "RAW";
        bool ok = OpenPrinter(szPrinterName, out hPrinter, IntPtr.Zero);
        if (!ok) { return false; }
        try {
            if (!StartDocPrinter(hPrinter, 1, di)) { return false; }
            if (!StartPagePrinter(hPrinter)) { return false; }
            IntPtr pUnmanagedBytes = Marshal.AllocCoTaskMem(bytes.Length);
            Marshal.Copy(bytes, 0, pUnmanagedBytes, bytes.Length);
            int written;
            bool res = WritePrinter(hPrinter, pUnmanagedBytes, bytes.Length, out written);
            Marshal.FreeCoTaskMem(pUnmanagedBytes);
            EndPagePrinter(hPrinter);
            EndDocPrinter(hPrinter);
            return res;
        } finally {
            ClosePrinter(hPrinter);
        }
    }
}
"@

$bytes = [System.IO.File]::ReadAllBytes($FilePath)
$ok = [RawPrinterHelper]::SendBytesToPrinter($PrinterName, $bytes)
if (-not $ok) { Write-Error "RAW print failed"; exit 1 }
exit 0
`

export async function sendZplRaw(printerName, zpl) {
  const dir = mkdtempSync(join(tmpdir(), 'zpl-'))
  const dataPath = join(dir, 'label.zpl')
  const scriptPath = join(dir, 'rawprint.ps1')
  writeFileSync(dataPath, zpl, 'ascii')
  writeFileSync(scriptPath, RAW_PRINT_PS1, 'utf8')

  return new Promise((resolve) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      scriptPath,
      '-PrinterName',
      printerName,
      '-FilePath',
      dataPath
    ])
    let stderr = ''
    ps.stderr.on('data', (d) => {
      stderr += d.toString()
    })
    ps.on('close', (code) => {
      if (code === 0) resolve({ ok: true })
      else
        resolve({
          ok: false,
          error: stderr.trim() || `powershell exited with code ${code}`
        })
    })
    ps.on('error', (err) => resolve({ ok: false, error: err.message }))
  })
}
