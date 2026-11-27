# Stage 1: Build React Application
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency manifests
COPY package*.json ./

# Install dependencies (use legacy-peer-deps for React 19 compatibility if needed)
RUN npm ci --legacy-peer-deps || npm install --legacy-peer-deps

# Copy source code
COPY . .

# Build production bundle (disable CRA inline runtime script to enforce strict CSP without 'unsafe-inline')
ENV NODE_ENV=production
ENV INLINE_RUNTIME_CHUNK=false
ENV REACT_APP_API_URL=/api/v1
# .env* is dockerignored, so per-deploy client ID comes in as a build arg (empty -> code fallback)
ARG REACT_APP_GOOGLE_CLIENT_ID=
ENV REACT_APP_GOOGLE_CLIENT_ID=$REACT_APP_GOOGLE_CLIENT_ID
RUN npm run build

# Stage 2: Serve with Production Nginx
FROM nginx:1.25-alpine

# Remove default nginx configs
RUN rm -rf /etc/nginx/conf.d/*

# Copy custom nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy build artifacts from builder
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 80

# Run nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
