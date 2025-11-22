module.exports = {
  apps: [
    {
      name: "pos_server",
      script: "./dist/index.js",
      env: {
        MONGO_URI: "mongodb://127.0.0.1:27017/pos_billing_erp",
        PORT: 4000,
        NODE_ENV: "production"
      }
    }
  ]
};
