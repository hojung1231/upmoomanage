@echo off
rem upmu app: open data folders from the app in Explorer (current user only)
rem Opens existing folders only. Never runs files or programs.
set "D=%LOCALAPPDATA%\upmu"
if not exist "%D%" mkdir "%D%"
set "V=%D%\open-folder.vbs"
> "%V%" echo Set a = WScript.Arguments
>> "%V%" echo If a.Count = 0 Then WScript.Quit
>> "%V%" echo u = a(0)
>> "%V%" echo p = Unescape(Mid(u, InStr(u, ":") + 1))
>> "%V%" echo Set f = CreateObject("Scripting.FileSystemObject")
>> "%V%" echo If f.FolderExists(p) Then
>> "%V%" echo   CreateObject("Shell.Application").Explore p
>> "%V%" echo Else
>> "%V%" echo   MsgBox "Folder not found: " ^& p, 48, "upmu"
>> "%V%" echo End If
reg add "HKCU\Software\Classes\upmu-folder" /ve /d "URL:upmu-folder" /f >nul
reg add "HKCU\Software\Classes\upmu-folder" /v "URL Protocol" /d "" /f >nul
reg add "HKCU\Software\Classes\upmu-folder\shell\open\command" /ve /d "wscript.exe \"%V%\" \"%%1\"" /f >nul
echo.
echo Done. Go back to the app and press the setup-complete button.
pause
