@echo off
set NODE_EXE=C:\Program Files\cursor\resources\app\resources\helpers\node.exe
if exist "%NODE_EXE%" (
  "%NODE_EXE%" "%~dp0server.js"
) else (
  node "%~dp0server.js"
)
