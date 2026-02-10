module.exports = {
    apps: [{
        name: 'sky-admin',
        script: 'server.js',
        instances: 1,
        autorestart: true,
        watch: false,
        max_memory_restart: '300M',
        restart_delay: 4000,
        env: {
            NODE_ENV: 'production',
            PORT: 7001
        }
    }]
};
