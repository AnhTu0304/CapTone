FROM nginx:alpine

COPY security-headers.conf /etc/nginx/snippets/security-headers.conf
COPY nginx.conf /etc/nginx/nginx.https.conf
COPY nginx.http.conf /etc/nginx/nginx.http.conf
COPY nginx.http.conf /etc/nginx/nginx.conf
COPY 10-select-nginx-mode.sh /docker-entrypoint.d/10-select-nginx-mode.sh
RUN sed -i 's/\r$//' /docker-entrypoint.d/10-select-nginx-mode.sh && \
    chmod +x /docker-entrypoint.d/10-select-nginx-mode.sh

EXPOSE 80 443

HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget --quiet --tries=1 --spider http://127.0.0.1/healthz || exit 1
