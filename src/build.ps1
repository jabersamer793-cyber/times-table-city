# Rebuilds ..\index.html from the templates and images in this folder.
# Run from PowerShell:  powershell -ExecutionPolicy Bypass -File src\build.ps1
$d = $PSScriptRoot
$u = New-Object Text.UTF8Encoding $false
$h = [IO.File]::ReadAllText("$d\tpl_head.html")
$b = [IO.File]::ReadAllText("$d\tpl_body.html")
$a = [IO.File]::ReadAllText("$d\img\assets.json")
[IO.File]::WriteAllText((Join-Path $d '..\index.html'), $h + $b.Replace('/*ASSETS*/', 'const IMG=' + $a + ';'), $u)
'index.html rebuilt'
