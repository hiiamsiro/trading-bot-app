/**
 * Force polling so file changes are detected through Docker bind mounts (Windows/macOS).
 * Env WATCHPACK_POLLING / CHOKIDAR_USEPOLLING alone is not always applied to Nest's webpack graph.
 */
module.exports = (options) => ({
  ...options,
  watchOptions: {
    ...(options.watchOptions || {}),
    poll: 1000,
    aggregateTimeout: 300,
    ignored: /node_modules/,
  },
});
