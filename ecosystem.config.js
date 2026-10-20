module.exports = {
  apps: [
    {
      name: "osgb-fatura",
      script: "server.js",
      cwd: "C:\\Users\\emins\\Downloads\\osgb-fatura-takip\\osgb-fatura-takip-main",
      env: {
        NODE_ENV: "production",
        PORT: 5000
      }
    },
    {
      name: "osgb-tetkik",
      script: "dist/server.cjs",
      cwd: "C:\\Users\\emins\\Downloads\\osgb-fatura-takip\\osgb-fatura-takip-main\\osgb-tetkik-takip",
      env: {
        NODE_ENV: "production",
        PORT: 4000
      }
    }
  ]
};
