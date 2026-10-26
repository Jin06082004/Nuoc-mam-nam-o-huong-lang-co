/* eslint-disable @typescript-eslint/no-explicit-any */
import type { NextConfig } from "next";
import fs from "node:fs";

// Fix Node.js / libuv issue on Windows exFAT volumes where readlink on non-symlink
// files returns EISDIR instead of EINVAL. Next.js file tracing and Webpack expect EINVAL.
function patchExfatReadlink() {
  const origReadlink = fs.readlink;
  fs.readlink = function(path: any, options: any, callback?: any) {
    const cb = typeof options === "function" ? options : callback;
    const opts = typeof options === "function" ? undefined : options;
    const wrappedCb = (err: any, linkString: any) => {
      if (err && err.code === "EISDIR") {
        err.code = "EINVAL";
      }
      cb(err, linkString);
    };
    if (opts !== undefined) {
      return (origReadlink as any)(path, opts, wrappedCb);
    }
    return (origReadlink as any)(path, wrappedCb);
  } as any;

  if (fs.promises && fs.promises.readlink) {
    const origPromisesReadlink = fs.promises.readlink;
    fs.promises.readlink = async function(this: any, ...args: any[]) {
      try {
        return await origPromisesReadlink.apply(this, args as [any, any?]);
      } catch (err: any) {
        if (err && err.code === "EISDIR") {
          err.code = "EINVAL";
        }
        throw err;
      }
    } as any;
  }

  const origReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function(this: any, ...args: any[]) {
    try {
      return origReadlinkSync.apply(this, args as [any, any?]);
    } catch (err: any) {
      if (err && err.code === "EISDIR") {
        err.code = "EINVAL";
      }
      throw err;
    }
  } as any;
}

patchExfatReadlink();

function patchInputFileSystem(fsObj: any) {
  if (!fsObj) return;
  if (fsObj.readlink && !fsObj.__patchedExfatReadlink) {
    const orig = fsObj.readlink;
    fsObj.readlink = function(path: any, ...args: any[]) {
      const callback = args[args.length - 1];
      if (typeof callback === "function") {
        args[args.length - 1] = (err: any, ...res: any[]) => {
          if (err && err.code === "EISDIR") err.code = "EINVAL";
          callback(err, ...res);
        };
      }
      return orig.call(this, path, ...args);
    };
    fsObj.__patchedExfatReadlink = true;
  }
  if (fsObj.readlinkSync && !fsObj.__patchedExfatReadlinkSync) {
    const origSync = fsObj.readlinkSync;
    fsObj.readlinkSync = function(path: any, ...args: any[]) {
      try {
        return origSync.call(this, path, ...args);
      } catch (err: any) {
        if (err && err.code === "EISDIR") err.code = "EINVAL";
        throw err;
      }
    };
    fsObj.__patchedExfatReadlinkSync = true;
  }
}

const isTurbo = Boolean(
  process.env.TURBOPACK ||
  process.argv.some((arg) => arg.includes("turbo"))
);

const nextConfig: NextConfig = {
  poweredByHeader: false,
  ...(isTurbo
    ? {
        turbopack: {},
      }
    : {
        webpack: (config) => {
          // Disable persistent packfile caching on Windows NTFS/exFAT to avoid PackFileCacheStrategy snapshot errors
          config.cache = false;
          config.plugins = config.plugins || [];
          config.plugins.push({
            apply(compiler: any) {
              patchInputFileSystem(compiler.inputFileSystem);
              patchInputFileSystem(compiler.inputFileSystem?.fileSystem);

              compiler.hooks.beforeRun.tap("PatchInputFsBeforeRun", (comp: any) => {
                patchInputFileSystem(comp.inputFileSystem);
                patchInputFileSystem(comp.inputFileSystem?.fileSystem);
              });

              compiler.hooks.compilation.tap("PatchInputFsCompilation", (compilation: any) => {
                patchInputFileSystem(compilation.inputFileSystem);
                patchInputFileSystem(compilation.inputFileSystem?.fileSystem);
              });
            },
          });
          return config;
        },
      }),
};

export default nextConfig;
