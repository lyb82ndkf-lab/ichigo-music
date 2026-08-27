Get-Process | ForEach-Object {
    $proc = $_
    $id = $proc.Id
    $name = $proc.ProcessName
    try {
        $path = $proc.Path
        if ($path -and ($path -like "*ICHIGOMusic*" -or $path -like "*win-unpacked*")) {
            Write-Host "Killing PID $id ($name): $path"
            Stop-Process -Id $id -Force
        }
    } catch {}
}
