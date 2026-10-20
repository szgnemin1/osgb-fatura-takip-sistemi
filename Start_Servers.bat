@echo off
start "Fatura Takip" cmd /k "cd C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main && node server.js"
start "Tetkik Takip" cmd /k "cd C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main\osgb-tetkik-takip && node dist/server.cjs"
