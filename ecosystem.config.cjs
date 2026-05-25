module.exports = {
  apps: [
    {
      name: 'toonflow-canvas',
      script: 'sirv',
      args: '/app/canvas/dist --port 5173 --host',
      exec_mode: 'fork',
      watch: false
    },
    {
      name: 'toonflow-gateway',
      script: 'node',
      args: 'dist/app.js',
      cwd: '/app/gateway',
      exec_mode: 'fork',
      watch: false
    },
    {
      name: 'toonflow-engine',
      script: 'node',
      args: 'dist/app.js',
      cwd: '/app/engine',
      exec_mode: 'fork',
      watch: false
    }
  ]
};
