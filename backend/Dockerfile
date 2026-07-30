# Use an official Python runtime as a parent image
FROM python:3.14-slim

# Set the working directory in the container
WORKDIR /app

# Install uv
COPY --from=ghcr.io/astral-sh/uv:latest /uv /uvx /bin/

# Copy the dependency files
COPY pyproject.toml uv.lock ./

# Install dependencies
RUN uv sync --frozen --no-dev

# Copy the rest of the application code
COPY . .

RUN chmod +x scripts/entrypoint.sh

# Expose the port the app runs on
EXPOSE 8000

# Invoked via `bash <script>` rather than executed directly: if the file were
# ever checked out with CRLF line endings, running it directly would fail with
# "exec format error" on the shebang line, whereas bash tolerates being handed
# the path as an argument. (.gitattributes also forces LF for this file.)
ENTRYPOINT ["bash", "/app/scripts/entrypoint.sh"]

# Command to run the application
CMD ["uv", "run", "--no-sync", "fastapi", "run", "main.py", "--port", "8000", "--host", "0.0.0.0"]
