# Rebuilds ..\index.html from the templates, the images and the 2.5D board script in this folder.
# Run from PowerShell:  powershell -ExecutionPolicy Bypass -File src\build.ps1
# (src\board3d\board3d.js is made from the React + three.js code in ..\board3d: run "npm run build" there after changing it)
$d = $PSScriptRoot
$u = New-Object Text.UTF8Encoding $false
$h = [IO.File]::ReadAllText("$d\tpl_head.html")
$b = [IO.File]::ReadAllText("$d\tpl_body.html")
$a = [IO.File]::ReadAllText("$d\img\assets.json")
$g = [IO.File]::ReadAllText("$d\board3d\board3d.js") -replace '(?i)</script', '<\/script'
[IO.File]::WriteAllText((Join-Path $d '..\index.html'), $h + $b.Replace('/*ASSETS*/', 'const IMG=' + $a + ';').Replace('/*BOARD3D*/', $g), $u)
'index.html rebuilt'
