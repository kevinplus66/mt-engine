# MT-Engine Docker Image
# 自包含构建，适合分享部署

# ============ Stage 1: Build Next.js Frontend ============

FROM node:22-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies (利用 Docker 缓存)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code and build
COPY frontend/app ./app
COPY frontend/components ./components
COPY frontend/hooks ./hooks
COPY frontend/lib ./lib
COPY frontend/providers ./providers
COPY frontend/public ./public
COPY frontend/components.json frontend/next.config.ts frontend/postcss.config.mjs frontend/tsconfig.json ./
RUN npm run build

# ============ Stage 2: Python Runtime ============
FROM python:3.12-slim

WORKDIR /app

ARG MT_ENGINE_COMMIT=unknown
ENV MT_ENGINE_COMMIT=${MT_ENGINE_COMMIT}
LABEL org.opencontainers.image.revision="${MT_ENGINE_COMMIT}"

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY app/ ./app/

# Copy CHANGELOG.md for version reading
COPY CHANGELOG.md ./CHANGELOG.md

# Copy frontend static files from builder stage
COPY --from=frontend-builder /frontend/out ./frontend/
RUN chmod -R a+rX /app/app /app/frontend /app/CHANGELOG.md

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; r = httpx.get('http://127.0.0.1:5050/health'); raise SystemExit(0 if 200 <= r.status_code < 300 else 1)"

# Run the application
# 注意：不指定 USER，由 docker-compose 的 user: 参数控制
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5050"]
