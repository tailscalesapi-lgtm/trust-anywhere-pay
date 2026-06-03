module.exports = {
  apps: [
    {
      name: "ftescrow",
      script: ".output/server/index.mjs",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        HOST: "127.0.0.1",
        PORT: "3000",
      },
      max_memory_restart: "512M",
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      time: true,
    },
  ],
};
