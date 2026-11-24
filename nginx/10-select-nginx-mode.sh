#!/bin/sh
set -e

if [ -f /etc/nginx/certs/edge.crt ] && [ -f /etc/nginx/certs/edge.key ]; then
  echo "[nginx-proxy] TLS certificates found at /etc/nginx/certs -> enabling HTTPS mode."
  cp /etc/nginx/nginx.https.conf /etc/nginx/nginx.conf
else
  echo "[nginx-proxy] No TLS certificates mounted -> starting in HTTP mode on port 80."
  cp /etc/nginx/nginx.http.conf /etc/nginx/nginx.conf
fi
