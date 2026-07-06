' wsl-guardian-launch.vbs — lanza el guardián de WSL OCULTO (sin ventana de consola).
' Va en la carpeta Startup de Windows → corre al iniciar sesión, en la sesión del
' usuario (con acceso a GPU). Mantiene WSL vivo y lo revive si se cuelga.
Set s = CreateObject("Wscript.Shell")
s.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File ""C:\Users\sebas\wsl-guardian.ps1""", 0, False
