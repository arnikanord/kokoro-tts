module.exports = {
  apps: [{
    name: 'kokoro-tts',
    script: 'npm',
    args: 'start',
    cwd: '/projects/web/kokoro-tts',
    // Note: Next.js automatically loads .env.local when running 'next start'
    // Environment variables are now read at runtime in the API routes
    env: {
      NODE_ENV: 'production',
      PORT: '3006'
    },
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    error_file: '/projects/web/kokoro-tts/logs/err.log',
    out_file: '/projects/web/kokoro-tts/logs/out.log',
    log_file: '/projects/web/kokoro-tts/logs/combined.log',
    time: true
  }]
}