@echo off
REM Daily JockeyFinder profile scrape: TRUE all-time career totals + suspensions.
REM Hits ~118 LoveRacing jockey profile pages, so it runs once a day on its own
REM schedule (the 15-min run-sync.cmd keeps doing the light premiership-only sync).
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "scripts\sync-premierships.mjs" --profiles >> "scripts\.cache\sync.log" 2>&1
