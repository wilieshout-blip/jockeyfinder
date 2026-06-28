@echo off
REM Wrapper for the JockeyFinder 15-minute sync scheduled task.
REM Syncs race entries (jockeys/trainers) for near-term meetings + refreshes stables,
REM then back-fills completed race RESULTS (lights up jockey season stats).
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" "scripts\sync-entries.mjs" --days=5 >> "scripts\.cache\sync.log" 2>&1
"C:\Program Files\nodejs\node.exe" "scripts\sync-results.mjs" --days=3 >> "scripts\.cache\sync.log" 2>&1
REM Authoritative jockey/trainer season stats + apprentice claims (current season).
REM For TRUE career totals + suspensions, run the heavier profile pass occasionally
REM (it hits ~118 jockey profile pages): node scripts\sync-premierships.mjs --profiles
"C:\Program Files\nodejs\node.exe" "scripts\sync-premierships.mjs" >> "scripts\.cache\sync.log" 2>&1
