module.exports = {
  apps: [
    {
      name: "tyche-safety-training-server",
      script: "src/server.js",
      cwd: __dirname,
      instances: 1,
      exec_mode: "fork",
      autorestart: true,
      watch: ["src"],
      ignore_watch: ["node_modules", "test"],
      watch_delay: 500,
      max_memory_restart: "512M",
      env: {
        NODE_ENV: "development",
        PORT: 3000,
      },
    },
  ],
};
