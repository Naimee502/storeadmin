module.exports = {
  apps: [
    {
      name: "pos_server",
      script: "./dist/index.js",
      env: {
        MONGO_URI: "mongodb://127.0.0.1:27017/pos_billing_erp",
        PORT: 4000,
        NODE_ENV: "production",
        JWT_ACCESS_SECRET: "your_super_secret_access_key_123",
        JWT_REFRESH_SECRET: "your_super_secret_refresh_key_456"
      }
    }
  ]
};
