/**
 * Reads the newer one of package-lock.json or yarn.lock, converts it to its
 * counterpart (package-lock.json => yarn.lock or vice versa) using synp.
 */

import { promisify } from 'util';
import { writeFile } from 'fs';
import { npmToYarn, yarnToNpm } from 'synp';
import { exit } from 'process';
import { basename } from 'path';

const writeFileAsync = promisify(writeFile);

const npmExecPath = process.env.npm_execpath || 'npm';
const isYarn = basename(npmExecPath).startsWith('yarn');

async function main() {
  const libPath = process.cwd();
  if (isYarn) {
    console.info('Converting yarn.lock to package-lock.json...');
    await writeFileAsync('package-lock.json', yarnToNpm(libPath));
  } else {
    console.info('Converting package-lock.json to yarn.lock...');
    await writeFileAsync('yarn.lock', npmToYarn(libPath));
  }
}

main()
  .then(() => exit(0))
  .catch((err) => {
    console.error(err);
    exit(1);
  });
