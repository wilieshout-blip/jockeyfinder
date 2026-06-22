@echo off
REM Wrapper for the JockeyFinder 15-minute sync scheduled task.
REM Syncs race entries (jockeys/trainers) for near-term meetings + refreshes stables.
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "scripts\sync-entries.mjs" --days=5 >> "scripts\.cache\sync.log" 2>&1
