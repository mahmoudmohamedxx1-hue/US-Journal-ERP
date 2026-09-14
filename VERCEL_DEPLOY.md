# Vercel Deployment Guide

## Prerequisites
1. A PostgreSQL database (use [Neon](https://neon.tech) — free tier, instant setup)
2. Your GitHub repo connected to Vercel

## Steps

1. **Create a Neon PostgreSQL database** (free):
   - Go to https://neon.tech
   - Create a new project
   - Copy the connection string: `postgresql://user:pass@host/db?sslmode=require`

2. **Import to Vercel**:
   - Go to https://vercel.com/new
   - Import your GitHub repo: `mahmoudmohamedxx1-hue/US-Journal-ERP`
   - Framework Preset: Next.js (auto-detected)
   - Build Command: `bash scripts/vercel-build.sh` (already in package.json)
   - Output Directory: `.next` (auto-detected)

3. **Set Environment Variables** (CRITICAL):
   - Go to Project Settings → Environment Variables
   - Add: `DATABASE_URL` = your Neon PostgreSQL connection string
   - Make sure it's set for Production, Preview, and Development

4. **Deploy**:
   - Click Deploy
   - The build script will automatically:
     - Detect PostgreSQL from DATABASE_URL
     - Switch Prisma provider from sqlite to postgresql
     - Run `prisma generate`
     - Run `next build --no-turbopack`

5. **Create database tables** (after first deploy):
   - Run locally: `DATABASE_URL=your_neon_url npx prisma db push`
   - Or use Vercel CLI: `vercel env pull && npx prisma db push`

6. **Seed the database** (optional):
   - Run locally: `DATABASE_URL=your_neon_url node scripts/seed.js`

## Common Issues

### 404 Not Found
- **Cause**: DATABASE_URL not set or Prisma can't connect
- **Fix**: Set DATABASE_URL in Vercel Environment Variables and redeploy

### Build Fails
- **Cause**: Turbopack not supported on Vercel for Next.js 16
- **Fix**: Build script already uses `--no-turbopack`

### Prisma Error: "Provider sqlite does not exist"
- **Cause**: Schema still says `provider = "sqlite"` but DATABASE_URL is PostgreSQL
- **Fix**: The build script auto-detects and switches to `postgresql`
