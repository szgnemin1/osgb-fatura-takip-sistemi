Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "taskkill /F /IM node.exe", 0, True

' Fatura Takip
WshShell.CurrentDirectory = "C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main"
WshShell.Run "cmd.exe /c node server.js > fatura-log.txt 2>&1", 0, False

' Tetkik Takip
WshShell.CurrentDirectory = "C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main\osgb-tetkik-takip"
WshShell.Run "cmd.exe /c node dist/server.cjs > tetkik-log.txt 2>&1", 0, False


