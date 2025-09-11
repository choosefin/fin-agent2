# Backend Dockerfile for Motia Production
FROM motiadev/motia:latest

WORKDIR /app

# Install Dependencies
COPY package*.json ./
RUN npm ci --only=production

# Move application files
COPY . .

# Copy debug scripts and configs
COPY start-debug.sh /app/
COPY monitor.sh /app/
COPY motia.cloud.json /app/
RUN chmod +x /app/start-debug.sh /app/monitor.sh

# Setup python steps dependencies if needed
# RUN npx motia@latest install

# Build the Motia project
RUN npx motia build

# Expose the Motia port
EXPOSE 3001

# Use the shell script through sh
CMD ["sh", "/app/start-debug.sh"]