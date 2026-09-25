# Paylix

Paylix is a modern, comprehensive platform designed to streamline school management, fee collection, and receipt tracking. Built with [Next.js](https://nextjs.org/) and powered by [Supabase](https://supabase.com/), it offers a seamless experience for administrators, accountants, and parents.

## Features

- **School Management**: Manage academic years, classes, and students efficiently.
- **Financial Operations**: Handle fee obligations, prior debts, and multi-currency payments.
- **Receipts & Reporting**: Generate detailed receipts and export data via Excel templates.
- **User Roles & Access Control**: Secure Role-Based Access Control (RBAC) with Row Level Security (RLS) policies using Supabase.
- **Notifications System**: Integrated alerts and audit logs.
- **Progressive Web App (PWA)**: Installable on devices for quick access, complete with offline indicators.

## Tech Stack

- **Framework**: Next.js (App Router)
- **Database & Auth**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Testing**: Vitest
- **Language**: TypeScript

## Getting Started

First, install dependencies:

```bash
npm install
# or yarn install / pnpm install / bun install
```

Ensure you have your Supabase environment variables set up.

Run the development server:

```bash
npm run dev
# or yarn dev / pnpm dev / bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the app.
