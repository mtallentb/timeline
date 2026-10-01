FROM python:3.12-alpine
WORKDIR /app
COPY index.html app.js styles.css events.json ./
EXPOSE 8080
CMD ["sh", "-c", "python -m http.server ${PORT:-8080}"]
