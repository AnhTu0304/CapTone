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
ENV REACT_APP_GOOGLE_CLIENT_ID=802339246705-ulhj3r1h5e2fk5mlvns21je14q722cva.apps.googleusercontent.com
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
