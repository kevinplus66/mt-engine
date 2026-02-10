# MT-Engine Docker Image
# 自包含构建，适合分享部署

# ============ Stage 1: Build Next.js Frontend ============
FROM node:20-alpine AS frontend-builder

WORKDIR /frontend

# Install dependencies (利用 Docker 缓存)
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --legacy-peer-deps

# Copy source code and build
COPY frontend/ ./
RUN npm run build

# ============ Stage 2: Python Runtime ============
FROM python:3.9-slim

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY app/ ./app/

# Copy frontend static files from builder stage
COPY --from=frontend-builder /frontend/out ./frontend/

# Create data directory
RUN mkdir -p /app/data

# Expose port
EXPOSE 5050

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import httpx; httpx.get('http://localhost:5050/health')" || exit 1

# Run the application
# 注意：不指定 USER，由 docker-compose 的 user: 参数控制
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "5050"]
