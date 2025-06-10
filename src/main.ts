// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { getInput, setFailed }from '@actions/core';
import { clean as semverClean, valid as semverValid } from 'semver';
import { setup } from './setup';

async function main(): Promise<void> {
  try {
    const inputVersion = getInput('haxe-version');
    const cacheDependencyPath = getInput('cache-dependency-path');
    const nightly = /^(\d{4}-\d{2}-\d{2}_[\w.-]+_\w+)|latest$/.test(inputVersion);
    const version = nightly ? inputVersion : semverValid(semverClean(inputVersion));
    if (version) {
      await setup(version, nightly, cacheDependencyPath);
    }
  } catch (error: any) { // eslint-disable-line @typescript-eslint/no-implicit-any-catch
    console.error(error);
    setFailed(error.message);
  }
}

await main();
