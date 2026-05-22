# ==========================================================================
# ResumeAI Dockerfile - Production Environment Build
# ==========================================================================

# Use official, optimized Python runtime base image
FROM python:3.11-slim

# Set strict system environments
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PORT=8000

# Set build directory
WORKDIR /app

# Install critical OS packages (build dependencies, libmagic, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Install python packages directly into container
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Copy complete project source code
COPY . /app/

# Create media directory for resume storage uploads
RUN mkdir -p /app/media /app/staticfiles

# Expose Django server port
EXPOSE 8000

# Execute server boot command
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]
