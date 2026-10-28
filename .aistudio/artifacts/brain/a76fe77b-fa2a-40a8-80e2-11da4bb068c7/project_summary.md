# Executive Dashboard & Real-Time Intelligence Summary

## Overview
PROGILIC CRM v3 features a production-grade executive dashboard and client management engine with 100% reactive real-time data synchronization with Firestore and the CRM state store.

## Recent Enhancements & Fixes
1. **Dedicated Licenses & Versions Explorer Modal ("مستكشف التراخيص حسب الإصدار")**:
   - The "التفاصيل" button on the licenses card now opens a dedicated Licenses Explorer Modal instead of the ticket explorer.
   - Comprehensive breakdown of all CRM licenses grouped by platform (`Desktop`, `Mobile`, `Web`) and versions (`V27`, `V26`, `V24`, `V23`, `V21`).
   - Displays client name, company, wilaya, phone number, licensed machine count, start date, lifetime status, and a one-click button to jump directly to the client's software tab.
   - Includes one-click CSV export ("تصدير التراخيص CSV").

2. **Program Input Architecture Redesign**:
   - Removed manual text input for "اسم البرنامج / البرودوي" (`programName`) across all forms (Add Client, Edit Client, Add Program, Edit Program).
   - Standardized platforms strictly to: **Desktop**, **Mobile**, **Web** (completely eliminated "Hybrid").
   - Added dynamic type selection (`updateProgramTypeSelect`) tailored per platform:
     - **Desktop**: `تجاري (Commercial)`, `إنتاجي (Production)`, `توزيع (Distribution)`.
     - **Mobile**: `تطبيق لوحة القيادة (Tableau de bord)`, `تطبيق VDD (Vendeur Distributeur)`, `تطبيق التاجر (Commerçant)`.
     - **Web**: Displayed as clean empty state (`قيد التطوير`) as web versions are not yet released.
   - Program identities are automatically derived as standard formatted titles (e.g., `Desktop - تجاري V27`).

3. **Strict Client Validation**:
   - Mandatory validation rules enforced before submission ("valider"):
     - Full Name (`fullName`)
     - Company / Organization (`company`)
     - Phone Number (`phone`)
     - Wilaya (`wilaya`)
     - Commune (`commune`)
     - Main Business Type (`businessType`)
     - Specialized Business Field (`businessField`)
     - Client Status (`status`)
     - Last Contact Date (`lastContact`)
     - Start / Registration Date (`startDate`)
   - Optional fields clearly demarcated: Gmail (`gmailAccount`), Address/Quarter (`location`), Notes (`notes`).
   - If registering an active client's initial program: Platform, Type (if not Web), Version, and Machine Count are strictly validated.

4. **Modal Backdrop Dismissal Safety**:
   - Disabled modal closure on backdrop click (`mbk`).
   - Modals now only close upon clicking explicit "إلغاء" (Cancel) or "×" (Close) buttons, preventing accidental data loss when filling lengthy customer information.

5. **Global Timeline Performance Optimization**:
   - Default timeline date preset set to **"اليوم" (Today)** for lightweight, fast rendering.
   - Quick date filters for `اليوم` (Today), `أمس` (Yesterday), `آخر 7 أيام` (Last 7 Days), and `كل الأوقات` (All Time).
