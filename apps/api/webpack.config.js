const path = require('path');

/**
 * Nest CLI's default webpack config externalizes everything under
 * node_modules (via webpack-node-externals) to keep the bundle small. In
 * this pnpm workspace, `@crm/*` packages are symlinked INTO node_modules
 * but ship raw, uncompiled TypeScript as their `main` entrypoint (they're
 * meant to be compiled by whatever bundles them, not pre-built) — so
 * externalizing them leaves a `require('@crm/auth')` in the output that
 * Node can't execute at runtime (`ERR_MODULE_NOT_FOUND` resolving a bare
 * `.ts` import with no extension). This override bundles `@crm/*` like any
 * other first-party source while still externalizing genuine third-party
 * dependencies (express, @nestjs/*, bcrypt, ...).
 */
module.exports = function (options) {
  return {
    ...options,
    externals: [
      (data, callback) => {
        const request = data.request;
        if (!request || request.startsWith('@crm/')) return callback();
        if (request.startsWith('.') || path.isAbsolute(request)) return callback();
        return callback(null, `commonjs ${request}`);
      },
    ],
  };
};
