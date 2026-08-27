$target = "win-unpacked"
Get-CimInstance Win32_Process | ForEach-Object {
    $p = $_
    $cmd = $p.CommandLine
    $name = $p.ProcessName
    $id = $p.ProcessId
    if ($cmd -and ($cmd -like "*$target*")) {
        Write-Host "FOUND Process PID $id ($name): $cmd"
        Stop-Process -Id $id -Force
    }
}
