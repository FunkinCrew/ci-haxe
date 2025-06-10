import { access, constants } from 'node:fs/promises';
import { info, getState, saveState, setOutput } from '@actions/core';
import { saveCache, restoreCache } from '@actions/cache';
import { hashFiles } from '@actions/glob';

enum State {
  CachePrimaryKey = 'PRIMARY_KEY',
  CacheRestoreResult = 'RESTORE_RESULT',
  CacheHaxelibPath = 'HAXELIB_PATH',
}

export async function createHaxelibKey(platform: string, version: string, cacheDependencyPath: string): Promise<string> {
  const fileHash = await hashFiles(cacheDependencyPath);
  if (!fileHash)
    throw new Error('Some specified paths were not resolved, unable to cache dependencies.');

  return `haxelib-cache-${platform}-haxe${version}-${fileHash}`;
}

export async function restoreHaxelib(primaryKey: string, haxelibPath: string): Promise<void> {
  saveState(State.CachePrimaryKey, primaryKey);
  saveState(State.CacheHaxelibPath, haxelibPath);

  const restoreResult = await restoreCache([haxelibPath], primaryKey);
  setOutput('cache-hit', Boolean(restoreResult));

  if (!restoreResult)
    return info('haxelib cache is not found');

  saveState(State.CacheRestoreResult, restoreResult);
  info(`Cache restored from key: ${restoreResult}`);
}

export async function saveHaxelib(): Promise<void> {
  const restoreResult = getState(State.CacheRestoreResult);
  const primaryKey = getState(State.CachePrimaryKey);
  const haxelibPath = getState(State.CacheHaxelibPath);

  try {
    await access(haxelibPath, constants.F_OK)
  }
  catch {
    throw new Error(`Cache folder path is retrieved but doesn't exist on disk: ${haxelibPath}`);
  }

  if (primaryKey === restoreResult)
    return info(`Cache hit occurred on the primary key ${primaryKey}, not saving cache.`);

  const cacheId = await saveCache([haxelibPath], primaryKey);
  if (cacheId === -1) return;

  info(`Cache saved with the key: ${primaryKey}`);
}
