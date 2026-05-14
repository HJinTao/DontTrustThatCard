module.exports = {
  apps: [
    {
      name: "dont-trust-that-card-backend",
      cwd: "/home/ubuntu/DontTrustThatCard",
      script: "npm",
      args: "run start --workspace backend",
      env: {
        NODE_ENV: "production",
        PORT: "3000"
      }
    }
  ]
};
