#!/usr/bin/env node

// Synchronizes the version in src/manifest.json with the version in package.json
import fs from 'fs';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync('./package.json', 'utf8'));
const manifestPath = './src/manifest.json';
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));

if (manifest.version !== pkg.version) {
  manifest.version = pkg.version;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + '\n');
  console.log('✓ Updated manifest.json version to ' + pkg.version);
} else {
  console.log('✓ manifest.json version already in sync with package.json: ' + pkg.version);
}