# Architecture Map: PROGILIC CRM

## Overview
The architecture is modular, separating business logic, UI rendering, and persistence.

## Modules
### Business Layer (`/src/business`)
- **Actions (`actions/`)**: Orchestrates user interactions (login, client creation, sync actions).
- **Services (`/src/business/*.js`)**: Domain-specific logic for employees, backups, and data cleanup.
- **Storage (`storage.js`)**: Orchestrates import/export, data parsing, and high-level persistence.

### Presentation Layer (`/src/presentation`)
- **Core Router (`render-core.js`)**: Handles page routing and component lifecycle.
- **UI Components (`render-*.js`)**: Individual modules for rendering specific CRM views (employees, views, modals, login).

### Persistence/Firebase Layer (`/src/firebase`)
- **Service (`service.js`)**: Low-level Firestore CRUD operations.
- **Validation (`validation.js`)**: Strictly enforces schema for data before persistence.
- **Migration (`migration.js`)**: Handles resilient data schema updates.
- **Security Rules (`firestore.rules`)**: The database-level security gatekeeper.

### State Management (`/src/state`)
- **`store.js`**: Centralized, live-bound global state for the application.
