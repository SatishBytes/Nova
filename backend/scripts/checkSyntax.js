const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');

const backendRoot = path.resolve(__dirname, '..');

const checkDirectory = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.name === 'node_modules') continue;
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      checkDirectory(entryPath);
    } else if (entry.isFile() && entry.name.endsWith('.js')) {
      execFileSync(process.execPath, ['--check', entryPath], { stdio: 'inherit' });
    }
  }
};

checkDirectory(backendRoot);
process.stdout.write('Backend JavaScript syntax check passed.\n');
