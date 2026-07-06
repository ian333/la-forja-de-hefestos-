# wsl-guardian.ps1 — mantiene WSL (Ubuntu) vivo en iangpu sin intervención.
#   1) Arranca WSL al iniciar sesión (boot del distro → systemd → tailscaled → SSH).
#   2) Lo mantiene vivo con un proceso keep-alive (sleep infinity).
#   3) Si WSL se CUELGA (3 health-checks fallan), hace `wsl --shutdown` y lo revive.
# Corre oculto, en la sesión interactiva del usuario (acceso a GPU para el render).
$ErrorActionPreference = 'SilentlyContinue'
$distro = 'Ubuntu'
$log = "$env:USERPROFILE\wsl-guardian.log"
function Log($m){ "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Out-File -Append -FilePath $log -Encoding utf8 }
Log "=== guardian arranca ==="
$keep = $null
$fail = 0
while ($true) {
  # (1)(2) asegurar el keep-alive que mantiene WSL booteado
  if ($null -eq $keep -or $keep.HasExited) {
    Log "lanzo keep-alive (boot WSL)"
    $keep = Start-Process -PassThru -WindowStyle Hidden -FilePath "wsl.exe" `
            -ArgumentList "-d","$distro","-u","root","-e","sleep","infinity"
    Start-Sleep -Seconds 20
  }
  # (3) health-check con timeout de 30s
  $j = Start-Job { param($d) wsl.exe -d $d -u root -e echo ok } -ArgumentList $distro
  $ok = $false
  if (Wait-Job $j -Timeout 30) { if ((Receive-Job $j) -match 'ok') { $ok = $true } }
  Stop-Job $j -EA SilentlyContinue; Remove-Job $j -Force -EA SilentlyContinue
  if ($ok) { $fail = 0 }
  else {
    $fail++; Log "health FAIL ($fail/3)"
    if ($fail -ge 3) {
      Log "WSL colgado -> wsl --shutdown + revivir"
      wsl.exe --shutdown
      Start-Sleep -Seconds 10
      $keep = $null   # fuerza relanzar el keep-alive -> re-bootea WSL
      $fail = 0
    }
  }
  Start-Sleep -Seconds 30
}
