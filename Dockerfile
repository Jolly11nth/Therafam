# Therafam: one Railway service for React + FastAPI
# Build the Vite frontend, then serve its dist/ from FastAPI.

FROM node:22-alpine AS frontend-build
WORKDIR /frontend
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

FROM python:3.11-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1

COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && pip install --no-cache-dir -r requirements.txt

COPY --from=frontend-build /frontend/dist ./dist
COPY backend ./backend
COPY main.py ./main.py
COPY database ./database

ENV PORT=8000
EXPOSE 8000

CMD ["sh", "-c", "uvicorn backend.app:app --host 0.0.0.0 --port ${PORT:-8000}"]
