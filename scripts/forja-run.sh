#!/bin/bash
# Lanzador ancla-a-repo: un ssh pelón cae en $HOME (regla #1 de CLAUDE.md).
# Este script SIEMPRE cd a la raíz del repo y luego ejecuta lo que se le pase,
# así el invocador no depende del cwd del shell remoto.
#   ssh iangpu 'bash /home/ian/Orkesta/la-forja/scripts/forja-run.sh npx vite --host --port 5001'
cd /home/ian/Orkesta/la-forja || { echo "no repo"; exit 1; }
exec "$@"
