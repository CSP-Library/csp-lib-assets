#!/usr/bin/env node
/**
 * generate-file-list.js
 *
 * Walks the repo (excluding hidden dirs, node_modules, and build output)
 * and writes files.json — a nested tree of files/directories.
 *
 * Run this during the Amplify build phase (see amplify.yml) so the
 * listing is always fresh as of the latest commit.
 */

const fs = require('fs');
const path = require('path');

// Directories to skip entirely
const EXCLUDE_DIRS = new Set([
  '.git',
  'node_modules',
  '.amplify',
  'amplify',       // amplify-generated backend folder, if present
  'dist',
  'build',
  '.next',
]);

// The root to scan — defaults to repo root (one level up from /scripts, adjust as needed)
const ROOT_DIR = process.argv[2] || path.resolve(__dirname, '..');
const OUTPUT_FILE = process.argv[3] || path.join(ROOT_DIR, 'files.json');

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true })
    .filter(entry => {
      if (entry.name.startsWith('.')) return false; // hidden files/dirs
      if (entry.isDirectory() && EXCLUDE_DIRS.has(entry.name)) return false;
      return true;
    })
    .sort((a, b) => {
      // directories first, then alphabetical
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

  return entries.map(entry => {
    const fullPath = path.join(dir, entry.name);
    const relPath = path.relative(ROOT_DIR, fullPath).split(path.sep).join('/');

    if (entry.isDirectory()) {
      return {
        name: entry.name,
        path: relPath,
        type: 'directory',
        children: walk(fullPath),
      };
    }

    const stats = fs.statSync(fullPath);
    return {
      name: entry.name,
      path: relPath,
      type: 'file',
      size: stats.size,
      modified: stats.mtime.toISOString(),
    };
  });
}

const tree = {
  generatedAt: new Date().toISOString(),
  root: path.basename(ROOT_DIR),
  entries: walk(ROOT_DIR),
};

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(tree, null, 2));
console.log(`File listing written to ${OUTPUT_FILE} (${tree.entries.length} top-level entries)`);
