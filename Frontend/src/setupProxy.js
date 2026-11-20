const { createProxyMiddleware } = require('http-proxy-middleware');

module.exports = function(app) {
  app.use(
    '/agent',
    createProxyMiddleware({
      target: 'http://localhost:8105',
      changeOrigin: true,
      ws: true,
    })
  );
  app.use(
    '/api',
    createProxyMiddleware({
      target: 'http://localhost:5005',
      changeOrigin: true,
      ws: true,
    })
  );
};
