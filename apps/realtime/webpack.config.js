const path = require('path');

/**
 * Same reasoning as apps/api/webpack.config.js: Nest CLI's default webpack config
 * externalizes everything under node_modules, but the `@crm/*` workspace packages
 * ship raw, uncompiled TypeScript as their entrypoint — so a `require('@crm/config')`
 * left in dist/main.js cannot execute (`ERR_MODULE_NOT_FOUND`). Bundle `@crm/*` like
 * first-party source and keep genuine third-party dependencies external.
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
