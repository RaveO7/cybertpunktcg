@echo off
rem Lance chaque jour par le Planificateur de taches Windows (tache "CyberpunkTCG - Import prix").
cd /d "%~dp0.."
if not exist data mkdir data
echo ===== %date% %time% ===== >> data\import-prices.log
call npm run import:prices >> data\import-prices.log 2>&1
