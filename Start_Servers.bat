@echo off
set NODE_SKIP_PLATFORM_CHECK=1
start "Fatura Takip" cmd /k "cd /d C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main && set NODE_SKIP_PLATFORM_CHECK=1 && node server.js"
start "Tetkik Takip" cmd /k "cd /d C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main\osgb-tetkik-takip && set NODE_SKIP_PLATFORM_CHECK=1 && node dist/server.cjs"
