#!/bin/bash
# Vercel build script — automatically switches Prisma provider based on DATABASE_URL

if [[ "$DATABASE_URL" == postgres* ]]; then
  echo "[Vercel] DATABASE_URL is PostgreSQL — switching Prisma provider to postgresql"
  sed -i 's/provider = "sqlite"/provider = "postgresql"/' prisma/schema.prisma
elif [[ "$DATABASE_URL" == file* ]]; then
  echo "[Vercel] DATABASE_URL is SQLite — keeping provider as sqlite"
else
  echo "[Vercel] DATABASE_URL not set — defaulting to sqlite"
fi

# Generate Prisma client
npx prisma generate

# Build Next.js
npx next build
