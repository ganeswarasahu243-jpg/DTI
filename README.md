# DTI — Digital Trust Inheritance

DTI is a trust-first digital inheritance platform built to help users securely manage digital assets, define access rules, and coordinate release workflows with strong safeguards.

## Tech Stack
- React + TypeScript + Vite
- Tailwind CSS + modern UI components
- Node.js + Express authentication API
- Supabase integration

## Prerequisites
- Node.js 18+
- npm 9+

## Getting Started
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Create your environment file:
   ```bash
   cp .env.example .env
   ```
4. Update `.env` with your required values (especially Supabase and secrets).

## Run Locally
Start the frontend:
```bash
npm run dev
```

Start the local auth API:
```bash
npm run dev:api
```

> Run both services during local development.

## Build for Production
```bash
npm run build
```

## Lint
```bash
npm run lint
```

## Project Structure
- `/src` — frontend app code (pages, features, UI, routing)
- `/server` — authentication and backend API logic
- `/.env.example` — environment variable template

## Security Note
Do not commit real credentials or secrets. Use `.env` for local configuration and keep sensitive values out of source control.
