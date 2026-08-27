// scripts/unlock.ps1
$filePath = "D:\程序\wyyyy播放器\ichigomusic\release\win-unpacked\resources\app.asar"

# Try to find locking processes via RestartManager
Add-Type -TypeDefinition @"
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Diagnostics;

public class LockDetector {
    [StructLayout(LayoutKind.Sequential)]
    struct RM_UNIQUE_PROCESS {
        public int dwProcessId;
        public System.Runtime.InteropServices.ComTypes.FILETIME ProcessStartTime;
    }

    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    struct RM_PROCESS_INFO {
        public RM_UNIQUE_PROCESS Process;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 256)]
        public string strAppName;
        [MarshalAs(UnmanagedType.ByValTStr, SizeConst = 64)]
        public string strServiceShortName;
        public int ApplicationType;
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

    public static int[] GetPids(string path) {
        uint handle;
        string key = Guid.NewGuid().ToString();
        if (RmStartSession(out handle, 0, key) != 0) return new int[0];
        try {
            if (RmRegisterResources(handle, 1, new string[] { path }, 0, null, 0, null) != 0) return new int[0];
            uint needed = 0, count = 0, reason = 0;
            RmGetList(handle, out needed, ref count, null, ref reason);
            if (needed > 0) {
                RM_PROCESS_INFO[] infos = new RM_PROCESS_INFO[needed];
                count = needed;
                if (RmGetList(handle, out needed, ref count, infos, ref reason) == 0) {
                    List<int> pids = new List<int>();
                    for (int i = 0; i < count; i++) pids.Add(infos[i].Process.dwProcessId);
                    return pids.ToArray();
                }
            }
            return new int[0];
        } finally {
            RmEndSession(handle);
        }
    }
}
"@

$pids = [LockDetector]::GetPids($filePath)
Write-Host "Found PIDs locking app.asar:" ($pids -join ', ')
foreach ($pidNum in $pids) {
    Write-Host "Killing PID $pidNum"
    Stop-Process -Id $pidNum -Force -ErrorAction SilentlyContinue
}
