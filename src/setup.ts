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
  const neko = NekoAsset.resolveFromHaxeVersion(version); // Haxelib requires Neko
  console.log(`[neko] dl start = ${neko.version} (${neko.downloadUrl})`);
  const nekoPath = await neko.setup();

  core.addPath(nekoPath);
  console.log(`[neko] NEKOPATH = ${nekoPath}`);
  core.exportVariable('NEKOPATH', nekoPath);
  core.exportVariable('LD_LIBRARY_PATH', `${nekoPath}:$LD_LIBRARY_PATH`);

  const haxe = new HaxeAsset(version, nightly);
  console.log(`[haxe] dl start = ${version} (${haxe.downloadUrl})`);
  const haxePath = await haxe.setup();
  core.addPath(haxePath);
  console.log(`[haxe] HAXE_STD_PATH = ${haxePath}/std`);
  core.exportVariable('HAXEPATH', haxePath);
  core.exportVariable('HAXE_STD_PATH', path.join(haxePath, 'std'));

  if (env.platform === 'osx') {
    core.exportVariable('DYLD_FALLBACK_LIBRARY_PATH', `${nekoPath}:$DYLD_FALLBACK_LIBRARY_PATH`);

    // Ref: https://github.com/asdf-community/asdf-haxe/pull/7
    console.log('[neko] fixing dylib paths');
    await exec('ln', [
      '-sfv',
      path.join(nekoPath, '*.dylib'),
      path.join(haxePath, '*.dylib'),
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
