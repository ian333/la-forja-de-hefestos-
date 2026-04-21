#!/usr/bin/env node
'use strict';
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const IN_DIR = path.join(__dirname, '..', 'fit-diagnostics');
const files = fs.readdirSync(IN_DIR).filter(f => f.endsWith('.svg'));

for (const f of files) {
  const svg = fs.readFileSync(path.join(IN_DIR, f), 'utf8');
  const resvg = new Resvg(svg, { background: '#0d0f14' });
  const png = resvg.render().asPng();
  const out = f.replace(/\.svg$/, '.png');
  fs.writeFileSync(path.join(IN_DIR, out), png);
  console.log('  ✓', out);
}
