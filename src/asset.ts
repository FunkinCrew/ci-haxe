// Copyright (c) 2020 Sho Kuroda <krdlab@gmail.com>
//
// This software is released under the MIT License.
// https://opensource.org/licenses/MIT

import { rm } from "node:fs/promises";
import { join } from "node:path";
import { arch, platform } from "node:os";
import {
  cacheDir,
  downloadTool,
  find as findCached,
  extractTar,
  extractZip
} from "@actions/tool-cache";
import { debug }from "@actions/core";
import { exec } from "@actions/exec";

export type AssetFileExt = ".zip" | ".tar.gz";

abstract class Asset {
  constructor(
    readonly name: string,
    readonly version: string,
    protected readonly env: Env,
  ) {}

  async setup() {
    const toolPath = findCached(this.name, this.version);
    if (toolPath) {
      console.log(`[${this.name}] found = ${toolPath}`);
      return toolPath;
    }

    return cacheDir(await this.download(), this.name, this.version);
  }

  protected abstract get downloadUrl(): string;
  protected abstract get fileNameWithoutExt(): string;
  protected abstract get isDirectoryNested(): boolean;

  protected makeDownloadUrl(path: string) {
    return `https://github.com/HaxeFoundation${path}`;
  }

  protected get fileExt(): AssetFileExt {
    switch (this.env.platform) {
      case "win": {
        return ".zip";
      }

      default: {
        return ".tar.gz";
      }
    }
  }

  protected get fileName(): string {
    return `${this.fileNameWithoutExt}${this.fileExt}`;
  }

  private async download() {
    const downloadPath = await downloadTool(this.downloadUrl);
    const extractPath = await this.extract(
      downloadPath,
      this.fileNameWithoutExt,
      this.fileExt,
    );

    const toolRoot = await this.findToolRoot(
      extractPath,
      this.isDirectoryNested,
    );
    if (!toolRoot) {
      throw new Error(`tool directory not found: ${extractPath}`);
    }

    debug(`found toolRoot: ${toolRoot}`);
    return toolRoot;
  }

  private async extract(file: string, dest: string, ext: AssetFileExt) {
    await rm(dest, { recursive: true, force: true });

    switch (ext) {
      case ".tar.gz":
        return extractTar(file, dest);

      case ".zip":
        return extractZip(file, dest);

      default:
        throw new Error(`unknown ext: ${ext}`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
    }
  }

  // * NOTE: tar xz -C haxe-4.0.5-linux64 -f haxe-4.0.5-linux64.tar.gz --> haxe-4.0.5-linux64/haxe_20191217082701_67feacebc
  private async findToolRoot(extractPath: string, nested: boolean) {
    if (!nested) {
      return extractPath;
    }

    return new Promise<string | null>((res) => {
      exec("ls", ["-1", extractPath], {
        listeners: {
          stdout(data) {
            const entry = data.toString().trim();
            if (entry.length > 0) {
              res(join(extractPath, entry));
            }
          },
        },
      }).then(() => res(null));
    });
  }
}

// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-osx-universal.tar.gz
// * NOTE https://github.com/HaxeFoundation/neko/releases/download/v2-4-0/neko-2.4.0-win64.zip
export class NekoAsset extends Asset {
  static resolveFromHaxeVersion(version: string) {
    const nekoVer = version.startsWith("3.") ? "2.1.0" : "2.4.1"; // Haxe 3 only supports neko 2.1
    return new NekoAsset(nekoVer);
  }

  constructor(version: string, env = new Env("neko")) {
    super("neko", version, env);
  }

  get downloadUrl() {
    const tag = `v${this.version.replace(/\./g, "-")}`;
    return super.makeDownloadUrl(
      `/neko/releases/download/${tag}/${this.fileName}`,
    );
  }

  get target() {
    // No 64bit version of neko 2.1 available for windows
    if (this.env.platform === "win" && this.version.startsWith("2.1")) {
      return this.env.platform;
    }

    if (this.env.platform === "osx" && this.version.startsWith("2.4")) {
      return "osx-universal";
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get fileNameWithoutExt() {
    return `neko-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/4.0.5/haxe-4.0.5-linux64.tar.gz
// * NOTE https://github.com/HaxeFoundation/haxe/releases/download/3.4.7/haxe-3.4.7-win64.zip
export class HaxeAsset extends Asset {
  nightly = false;

  constructor(version: string, nightly: boolean, env = new Env("haxe")) {
    super("haxe", version, env);
    this.nightly = nightly;
  }

  get downloadUrl() {
    return this.nightly
      ? `https://build.haxe.org/builds/haxe/${this.nightlyTarget}/${this.fileName}`
      : super.makeDownloadUrl(`/haxe/releases/download/${this.version}/${this.fileName}`);
  }

  get target() {
    // Uses universal binary for osx
    if (this.env.platform === "osx") {
      return this.env.platform;
    }

    // No 64bit version of neko 2.1 available for windows, thus we can also only use 32bit version of Haxe 3
    if (this.env.platform === "win" && this.version.startsWith("3.")) {
      return this.env.platform;
    }

    return `${this.env.platform}${this.env.arch}`;
  }

  get nightlyTarget() {
    const plat = this.env.platform;
    switch (plat) {
      case "osx": {
        return "mac";
      }

      case "linux": {
        return "linux64";
      }

      case "win": {
        return "windows64";
      }

      default: {
        throw new Error(`${plat} not supported`); // eslint-disable-line @typescript-eslint/restrict-template-expressions
      }
    }
  }

  get fileNameWithoutExt() {
    if (this.nightly) {
      return `haxe_${this.version}`;
    }

    return `haxe-${this.version}-${this.target}`;
  }

  get isDirectoryNested() {
    return true;
  }
}

export class Env {
  constructor(readonly name = "env") {}

  get platform() {
    const plat = platform();
    switch (plat) {
      case "linux": {
        return "linux";
      }

      case "win32": {
        return "win";
      }

      case "darwin": {
        return "osx";
      }

      default: {
        throw new Error(`${plat} not supported`);
      }
    }
  }

  get arch() {
    const hostArch = arch();

    switch (hostArch) {
      case "x64":
        return "64";
      case "arm64":
        if (this.platform === "osx") return "64";
      default:
        throw new Error(`${hostArch} not supported`);
    }
  }
}
