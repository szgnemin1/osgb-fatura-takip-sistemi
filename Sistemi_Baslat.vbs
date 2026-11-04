Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "taskkill /F /IM node.exe", 0, True

' Fatura Takip (Windows Server 2012 Uyumlu)
WshShell.CurrentDirectory = "C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main"
WshShell.Run "cmd.exe /c set NODE_SKIP_PLATFORM_CHECK=1 && node server.js > fatura-log.txt 2>&1", 0, False

' Tetkik Takip (Windows Server 2012 Uyumlu)
WshShell.CurrentDirectory = "C:\Users\emins\Downloads\osgb-fatura-takip\osgb-fatura-takip-main\osgb-tetkik-takip"
WshShell.Run "cmd.exe /c set NODE_SKIP_PLATFORM_CHECK=1 && node dist/server.cjs > tetkik-log.txt 2>&1", 0, False


