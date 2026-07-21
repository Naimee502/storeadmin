module.exports = {
  apps: [
    {
      name: "pos_server",
      script: "./dist/index.js",
      env: {
        MONGO_URI: "mongodb://127.0.0.1:27017/pos_billing_erp",
        PORT: 4000,
        NODE_ENV: "production",
        // Picked up by the uploadImage resolver whenever NODE_ENV=production
        // (which pm2 sets here), so uploaded image URLs point at the public
        // domain instead of the dev LAN IP in server/.env.
        PUBLIC_BASE_URL_PROD: "https://rudra.digisysindiatech.com",
        JWT_ACCESS_SECRET: "your_super_secret_access_key_123",
        JWT_REFRESH_SECRET: "your_super_secret_refresh_key_456"
      }
    }
  ]
};
