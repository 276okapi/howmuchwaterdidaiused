@echo off
rem Builds ..\howmuchwaterdidaiused-setup.exe with the C# compiler built into Windows (.NET Framework 4.x).
rem Nothing to install. Rebuild only when Setup.cs changes: the agent scripts are downloaded
rem from the site at install time, so they are not inside the .exe.
setlocal
cd /d "%~dp0"
set "CSC=%WINDIR%\Microsoft.NET\Framework64\v4.0.30319\csc.exe"
if not exist "%CSC%" set "CSC=%WINDIR%\Microsoft.NET\Framework\v4.0.30319\csc.exe"
"%CSC%" /nologo /target:winexe /codepage:65001 /langversion:5 /optimize+ ^
  /out:"..\howmuchwaterdidaiused-setup.exe" ^
  /r:System.Windows.Forms.dll /r:System.Drawing.dll /r:System.Web.Extensions.dll ^
  Setup.cs
if errorlevel 1 (echo. & echo Kompilacja nie powiodla sie. & pause & exit /b 1)
echo Zbudowano: %~dp0..\howmuchwaterdidaiused-setup.exe
