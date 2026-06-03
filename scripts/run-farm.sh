#!/usr/bin/env bash
cd /home/ian/Orkesta/la-forja || exit 9
exec node --import tsx scripts/generative-farm.cjs "$@"
