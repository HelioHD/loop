@echo off
rem LOOP - Looking Promos | Helio Delfino Lopes de Alcantara
cd /d "%~dp0"
if not exist node_modules call npm install
start "" http://127.0.0.1:4747
npm start
