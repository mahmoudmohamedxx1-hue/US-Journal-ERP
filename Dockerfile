FROM node:20-slim

WORKDIR /app

# Install bun
RUN npm install -g bun

# Copy package files
COPY package.json bun.lock ./

# Install dependencies
RUN bun install --frozen-lockfile

# Copy source
COPY . .

# Build
RUN bun run build

# Initialize database
RUN bun run db:push

# Expose port
EXPOSE 3000

# Start
CMD ["bun", "run", "start"]
