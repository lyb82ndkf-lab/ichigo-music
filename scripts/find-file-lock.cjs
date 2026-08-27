const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const target = path.resolve(__dirname, '../release/win-unpacked/resources/app.asar');

// Use PowerShell with RestartManager to find processes locking the file
const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class FileLockFinder {
    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    const int RmRebootReasonNone = 0;
    const int CCH_RM_MAX_APP_NAME = 255;
    const int CCH_RM_MAX_SVC_NAME = 63;

    enum RM_APP_TYPE {
        RmUnknownApp = 0,
        RmMainWindow = 1,
        RmOtherWindow = 2,
        RmService = 3,
        RmExplorer = 4,
        RmConsole = 5,
        RmCritical = 1000
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_APP_NAME + 1)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = CCH_RM_MAX_SVC_NAME + 1)]
        public string strServiceShortName;
        public RM_APP_TYPE ApplicationType;
        public uint AppStatus;
        public uint TSSessionId;
        [MarshalAs(UnmanagedType.Bool)]
        public bool bRestartable;
    }

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Auto)]
    static extern int RmStartSession(out uint pSessionHandle, int dwFlags, string strSessionKey);

    [DllImport("rstrtmgr.dll")]
    static extern int RmEndSession(uint pSessionHandle);

    [DllImport("rstrtmgr.dll", CharSet = CharSet.Auto)]
    static extern int RmRegisterResources(uint pSessionHandle, uint nFiles, string[] rgsFilenames, uint nApplications, [In] RM_UNIQUE_PROCESS[] rgApplications, uint nServices, string[] rgsServiceNames);

    [DllImport("rstrtmgr.dll")]
    static extern int RmGetList(uint pSessionHandle, out uint pnProcInfoNeeded, ref uint pnProcInfo, [In, Out] RM_PROCESS_INFO[] rgAffectedApps, ref uint lpdwRebootReasons);

    public static List<Process> GetLockingProcesses(string path) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        int res = RmStartSession(out handle, 0, key);
        if (res != 0) return new List<Process>();

        try {
            string[] resources = new string[] { path };
            res = RmRegisterResources(handle, (uint)resources.Length, resources, 0, null, 0, null);
            if (res != 0) return new List<Process>();

            uint needed = 0;
            uint count = 0;
            uint reason = RmRebootReasonNone;

            res = RmGetList(handle, out needed, ref count, null, ref reason);
            if (res == 234) { // ERROR_MORE_DATA
                RM_PROCESS_INFO[] processInfo = new RM_PROCESS_INFO[needed];
                count = needed;
                res = RmGetList(handle, out needed, ref count, processInfo, ref reason);
                if (res == 0) {
                    List<Process> processes = new List<Process>();
                    for (int i = 0; i < count; i++) {
                        try {
                            processes.Add(Process.GetProcessById(processInfo[i].Process.dwProcessId));
                        } catch {}
                    }
                    return processes;
                }
            }
            return new List<Process>();
        } finally {
            RmEndSession(handle);
        }
    }
}
"@

$procs = [FileLockFinder]::GetLockingProcesses('${target.replace(/\\/g, '\\\\')}')
foreach ($p in $procs) {
    Write-Output "$($p.Id),$($p.ProcessName),$($p.Path)"
}
`;

try {
  const result = execSync(`powershell -NoProfile -Command "${psScript}"`, { encoding: 'utf8' });
  console.log('Locking processes:', result);
  const lines = result.trim().split('\n').filter(Boolean);
  for (const line of lines) {
    const [pid, name] = line.split(',');
    if (pid) {
      console.log(`Killing ${name} (PID ${pid})`);
      execSync(`taskkill /F /PID ${pid}`);
    }
  }
} catch (err) {
  console.error(err);
}
