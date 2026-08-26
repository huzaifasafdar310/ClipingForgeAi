# syntax=docker/dockerfile:1
# ─────────────────────────────────────────────────────────────
# ClipAI Studio — Production Docker Image
# Configured for Hugging Face Spaces & Cloud Docker
# ─────────────────────────────────────────────────────────────

FROM python:3.11-slim

# Install system dependencies: FFmpeg + build tools
RUN apt-get update && apt-get install -y --no-install-recommends \
    ffmpeg \
    git \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies first
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir gunicorn>=21.2.0

# Copy application source
COPY . .

# Build the React frontend
RUN if [ -d "frontend" ] && [ -f "frontend/package.json" ]; then \
        curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
        && apt-get install -y nodejs \
        && cd frontend && npm ci --prefer-offline && npm run build \
        && apt-get purge -y nodejs && apt-get autoremove -y; \
    fi

# Create required runtime directories and ensure universal write permissions
RUN mkdir -p /app/clips /app/instance \
    && chmod -R 777 /app/clips /app/instance

# Hugging Face Spaces runs on port 7860 by default
EXPOSE 7860

# Production entrypoint via gunicorn on port 7860
CMD ["gunicorn", "app:app", \
     "--workers", "2", \
     "--bind", "0.0.0.0:7860", \
     "--timeout", "300", \
     "--keep-alive", "5", \
     "--access-logfile", "-", \
     "--error-logfile", "-", \
     "--log-level", "info"]
