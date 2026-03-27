FROM python:3.9-slim

# Create a non-root user (Hugging Face Spaces requirement)
RUN useradd -m -u 1000 user
USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy dependency manifest
COPY --chown=user requirements.txt .

# Install dependencies (ignoring pip warnings)
RUN pip install --no-cache-dir -r requirements.txt

# Copy our ML logic
COPY --chown=user *.py ./

# Expose port 7860 (Hugging Face Default)
EXPOSE 7860

# Run FastAPI via Uvicorn
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
