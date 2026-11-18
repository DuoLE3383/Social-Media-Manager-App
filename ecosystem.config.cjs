// PM2 configuration — starts BOTH the API server and the web server.
//
//   pm2 start ecosystem.config.cjs --update-env
//   pm2 save            # remember the process list across reboots
//   pm2 logs            # view output
//
// The API process also serves the built frontend (build/) with SPA fallback,
// so you can point nginx (or a tunnel) at a single port: 8787.
// If you prefer nginx to serve static files itself, set SERVE_STATIC=false
// in the env block below.

const path = require('path');

module.exports = {
  apps: [
    {
      name: 'ai-social-api',
      cwd: __dirname,
      script: 'server/index.mjs',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      max_memory_restart: '600M',
      env: {
        NODE_ENV: 'production',
        HOST: '127.0.0.1',
        PORT: '8787',
        // SERVE_STATIC: 'false',  // uncomment if nginx serves build/ itself
      },
      out_file: path.join(__dirname, 'logs', 'api-out.log'),
      error_file: path.join(__dirname, 'logs', 'api-error.log'),
      merge_logs: true,
      time: true,
    },
    {
      name: 'ai-social-web',
      cwd: __dirname,
      script: 'node_modules/serve/build/main.js',
      args: '-s build -l 3000',
      instances: 1,
      exec_mode: 'fork',
      watch: false,
      autorestart: true,
      env: {
        NODE_ENV: 'production',
      },
      out_file: path.join(__dirname, 'logs', 'web-out.log'),
      error_file: path.join(__dirname, 'logs', 'web-error.log'),
      merge_logs: true,
      time: true,
    },
  ],
};
