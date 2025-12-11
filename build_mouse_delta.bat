@echo off
echo Building mouse_delta.exe ...

cl mouse_delta.cpp /O2 /EHsc /nologo user32.lib

if exist mouse_delta.exe (
    echo.
    echo SUCCESS! mouse_delta.exe created.
    echo.
) else (
    echo.
    echo FAILED to build mouse_delta.exe
    echo.
)
pause
