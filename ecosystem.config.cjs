module.exports = {
  apps: [
    {
      name: "ftescrow",
      script: "start-server.js",
      exec_mode: "fork",
      instances: 1,
      env: {
        NODE_ENV: "production",
        HOST: "0.0.0.0",
        PORT: "8080",
      },
      max_memory_restart: "512M",
      out_file: "logs/out.log",
      error_file: "logs/err.log",
      time: true,
    },
  ],
};
