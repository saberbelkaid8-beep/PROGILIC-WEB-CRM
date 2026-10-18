# PROGILIC CRM - Project Summary

## Overview
PROGILIC CRM is a production-grade Customer Relationship Management system designed for multi-tenant business management. It provides tools for tracking clients, managing software licenses, handling technical support issues, and monitoring business requirements.

## Current Architecture
- **Frontend**: Vanilla JavaScript/TypeScript with Tailwind CSS, using a component-based rendering engine (`render-core.js`, `render-views.js`, etc.).
- **Backend/Persistence**: Firebase Firestore (Enterprise Edition) for real-time data synchronization.
- **Security**: Hardened Firestore security rules with attribute-based access control (ABAC).
- **Offline Capability**: Local IndexedDB caching with automatic background synchronization to Firebase.

## Key Features
- **Client Management**: Create, read, update, and delete clients, including sub-collections for programs, issues, and requirements.
- **Data Integrity**: Automated schema migration (v2 -> v3) and strict data validation for all writes.
- **Reporting & Statistics**: Automated calculation of client scores, license counts, and open issues.
- **Export/Import**: Robust import/export functionality for `.dum` and `.json` files, supporting relaxed JSON formats and binary/Base64 payloads.

## Deployment Information
- **Region**: europe-west3
- **Database**: `ai-studio-a76fe77b-fa2a-40a8-80e2-11da4bb068c7`
- **Project ID**: `gen-lang-client-0400245577`

## Status
Verified, linted, tested, and ready for use.
