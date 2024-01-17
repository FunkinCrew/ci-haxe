// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import * as path from 'node:path';
import * as core from '@actions/core';
import { exec, getExecOutput } from '@actions/exec';
import { NekoAsset, HaxeAsset, Env } from './asset';
import { restoreHaxelib, createHaxelibKey } from './haxelib';

const env = new Env();

export async function setup(version: string, nightly: boolean, cacheDependencyPath: string) {
  let nekoPath;
  let nekoHomebrew = false;
  const {
    stdout: existingNekoBinary,
    exitCode: exitNeko
  // exits with 1 if not found; don't fail the action
  } = await getExecOutput('which', ['neko'], { ignoreReturnCode: true }); 
  if (exitNeko === 0) {
    const { stdout: version } = await getExecOutput('neko', ['-version']);
    console.log(`[neko] found = v${version.trim()}`);
    const existingPath = path.dirname(existingNekoBinary.trim());
    nekoHomebrew = existingPath.startsWith('/opt/homebrew');
    if (nekoHomebrew) {
      /*
        From the brew install neko output:
        > You must add the following line to your .bashrc or equivalent:
        >   export NEKOPATH="/opt/homebrew/lib/neko"
       */
      nekoPath = `/opt/homebrew/lib/neko`
    }
    else {
      console.warn(`[neko] unsure of library path for ${existingPath}, assuming default`);
      nekoPath = `/usr/local/lib/neko`;
    }
  } else {
    const neko = NekoAsset.resolveFromHaxeVersion(version); // Haxelib requires Neko
    console.log(`[neko] missing = v${neko.version}`);
    console.log(`[neko] dl start = ${neko.downloadUrl}`);
    nekoPath = await neko.setup();
  }

  core.addPath(nekoPath);
  console.log(`[neko] NEKOPATH = ${nekoPath}`);
  core.exportVariable('NEKOPATH', nekoPath);
  core.exportVariable('LD_LIBRARY_PATH', `${nekoPath}:$LD_LIBRARY_PATH`);

  console.log(`[haxe] dl start = ${version}`);
  const haxe = new HaxeAsset(version, nightly);
  const haxePath = await haxe.setup();
  core.addPath(haxePath);
  console.log(`[haxe] HAXE_STD_PATH = ${haxePath}/std`);
  core.exportVariable('HAXE_STD_PATH', path.join(haxePath, 'std'));

  if (env.platform === 'osx') {
    // Ref: https://github.com/asdf-community/asdf-haxe/pull/7
    console.log('[neko] fixing dylib paths');
    await exec('ln', [
      '-sfv',
      path.join(nekoHomebrew ? `/opt/homebrew/lib/` : nekoPath, 'libneko.2.dylib'),
      path.join(haxePath, 'libneko.2.dylib'),
    ]);
  }

  console.log(`[haxelib] setup start = ${haxePath}/lib`);
  const haxelibPath = path.join(haxePath, 'lib');
  await exec('haxelib', ['setup', haxelibPath]);

  if (cacheDependencyPath.length > 0) {
    console.log(`[haxelib] dep cache = ${cacheDependencyPath}`);
    const key = await createHaxelibKey(haxe.target, version, cacheDependencyPath);
    await restoreHaxelib(key, haxelibPath);
  }
}
