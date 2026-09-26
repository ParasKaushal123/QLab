# QUBIQ runner API
FROM python:3.11-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends docker.io util-linux && rm -rf /var/lib/apt/lists/*
WORKDIR /srv
COPY requirements.txt .
RUN pip install -r requirements.txt
COPY qlab_runner ./qlab_runner
RUN useradd -m runner
EXPOSE 8765
HEALTHCHECK --interval=15s --timeout=5s CMD python -c "import urllib.request;urllib.request.urlopen('http://localhost:8765/v1/health')"
CMD ["uvicorn", "qlab_runner.app:app", "--host", "0.0.0.0", "--port", "8765", "--workers", "1"]
