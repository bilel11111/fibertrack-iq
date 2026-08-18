# FiberTrack IQ

FiberTrack IQ is a professional FTTH operations and supervision workspace for telecom teams. It centralizes network monitoring, subscriber activations, field operations, equipment, materials, alerts, topology analysis, maps, and technical assistance in a bilingual interface.

> This repository contains the commercial source distribution of FiberTrack IQ. It is intended for authorized customers and licensed deployments; it is not a free public edition.

## Product scope

The application provides role-based workspaces for administrators, project managers, operators, and technicians. The current modules include the operational dashboard, subscriber and activation management, equipment inventory, materials and stock operations, alerts, map-based localization, network topology, user administration, and a built-in technical assistant.

The interface currently supports French and Arabic, including right-to-left layout support for Arabic. A light and dark theme, zone filtering, local SQLite utilities, import/export scripts, and Cloudflare/TanStack Start configuration are included in the source tree.

## Technology

The project is a TypeScript web application built with React, TanStack Router/Start, Vite, Tailwind CSS, Radix UI, Leaflet, Recharts, and SQLite-oriented local utilities. The exact versions are declared in `package.json` and locked in `package-lock.json`.

## Local setup

Use Node.js 22 or a compatible current LTS release. Then install dependencies and start the development server:

```bash
npm ci
cp .env.example .env
npm run dev
```

The local development URL is printed by Vite. To create a production build, run:

```bash
npm run build
npm run preview
```

## Configuration and data protection

The original archive may contain local configuration, database files, or engineering spreadsheets. These are intentionally excluded from version control. Copy `.env.example` to `.env` and provide authorized local values. Do not commit `.env`, customer databases, customer spreadsheets, or generated build artifacts.

The helper scripts at the project root support local SQLite initialization, querying, importing, and equipment exporting. Run them only against a controlled copy of customer data.

## Commercial distribution

This project is prepared for a one-time licensed sales model. A customer release should be accompanied by a signed license record, a customer-specific deployment package, and the applicable support and usage terms. License issuance and activation controls should be configured before distributing the production build to customers.

## Validation

The baseline production build currently completes with:

```bash
npm run build
```

Run linting and a production build before every customer release:

```bash
npm run lint
npm run build
```

## License

Copyright © FiberTrack IQ. All rights reserved. The source code and commercial application are provided only to authorized licensees. Redistribution, resale, or publication without written authorization is prohibited.
