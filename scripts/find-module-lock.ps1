$target = "app.asar"
Get-Process | ForEach-Object {
    $proc = $_
    try {
        $modules = $proc.Modules
        foreach ($m in $modules) {
            if ($m.FileName -like "*$target*") {
                Write-Host "FOUND in modules of PID $($proc.Id) ($($proc.ProcessName)): $($m.FileName)"
                Stop-Process -Id $proc.Id -Force
            }
        }
    } catch {}
}
