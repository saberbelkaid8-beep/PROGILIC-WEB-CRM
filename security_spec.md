# Security Specification: Zero-Trust Data Invariants & "Dirty Dozen" Payloads

This specification defines the strict security posture and data invariants enforced at the database level using Firestore security rules. It includes 12 "Dirty Dozen" payloads designed to stress-test the validation boundaries and security gates.

---

## 1. Zero-Trust Data Invariants
1. **User Authentication & Owner Gate**: Every document read or write must reside under a path wildcard `{userId}` where `request.auth.uid == userId`. General cross-user queries or indexing are strictly prohibited.
2. **Write Verification Requirement**: All document inserts, updates, and deletes are protected by `request.auth.token.email_verified == true`.
3. **ID Poisoning Defenses**: Client documents at `users/{userId}/clients/{clientId}` must satisfy `incoming().id == int(clientId)` ensuring that IDs cannot be mutated or mismatched.
4. **Subcollection Lock**: Subcollection records (programs, issues, requirements, contacts) must keep their `id` field immutable on update operations.
5. **Pre-aggregated Schema Limits**: User profiles cannot be expanded beyond designated statistical counters and settings, preventing arbitrary document pollution.

---

## 2. The "Dirty Dozen" Test Payloads

Below are the 12 negative security test payloads designed to verify that malicious and malformed operations are rejected by `/firestore.rules`.

### Test Payload 1: Unauthenticated Read Attack
*   **Target Path**: `/users/attackerUID/clients/101`
*   **Operation**: `get`
*   **Context**: `request.auth == null`
*   **Expected Result**: `REJECTED (403 Forbidden)`

### Test Payload 2: Cross-Tenant Data Theft
*   **Target Path**: `/users/victimUID/clients/101`
*   **Operation**: `get`
*   **Context**: `request.auth.uid == 'attackerUID'` (Legitimate user trying to read another user's client)
*   **Expected Result**: `REJECTED (403 Forbidden)`

### Test Payload 3: Write Without Email Verification
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` and `request.auth.token.email_verified == false`
*   **Expected Result**: `REJECTED (403 Forbidden - Verified Email Required)`

### Test Payload 4: Arbitrary User Document Key Injection
*   **Target Path**: `/users/normalUser`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "v": 3,
      "nid": 105,
      "updatedAt": "2026-07-09T00:00:00Z",
      "hackerField": "maliciousPayloadToPolluteDatabaseSchema"
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - Keys do not match expected strict user fields)`

### Test Payload 5: Client ID Poisoning Mismatch
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 999, // Mismatched! Document is 101, but inner ID claims 999
      "fullName": "المخترق الخبيث",
      "status": "نشط"
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - inner id must match clientId wildcard)`

### Test Payload 6: Malformed Client Status Injection
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 101,
      "fullName": "محمد أحمد",
      "status": "HACKED_STATUS_MALICIOUS" // Not in ["نشط", "محتمل", "متوقف"]
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - status is not in enum list)`

### Test Payload 7: Oversized String Buffer Overflow Attack
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 101,
      "fullName": "محمد أحمد",
      "status": "نشط",
      "notes": "[A repeated sequence of 5000 characters to crash indexing/document limits...]"
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - notes string size exceeds 1000 characters limit)`

### Test Payload 8: Immutable Client ID Mutation Attack
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `update`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Existing Document**: `{"id": 101, "fullName": "سعيد", "status": "نشط"}`
*   **Updated Payload**: `{"id": 999, "fullName": "سعيد", "status": "نشط"}`
*   **Expected Result**: `REJECTED (400 Bad Request - inner client ID is immutable and cannot be changed on update)`

### Test Payload 9: Program Schema Mismatched Field Types
*   **Target Path**: `/users/normalUser/clients/101/programs/102`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 102,
      "programName": "البرنامج التجاري",
      "platform": "HackerOS", // Not in ["Desktop", "Mobile", "Web", "Hybrid"]
      "type": "تجاري"
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - platform not in program platform choices)`

### Test Payload 10: Client Field Mutation Escalation Attack
*   **Target Path**: `/users/normalUser/clients/101`
*   **Operation**: `update`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 101,
      "fullName": "محمد أحمد",
      "status": "نشط",
      "maliciousInternalAccessSetting": true // Injected key
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - update affectedKeys restricts to valid client properties only)`

### Test Payload 11: Contact History Length Buffer Overflow
*   **Target Path**: `/users/normalUser/clients/101/contacts/103`
*   **Operation**: `create`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Payload**:
    ```json
    {
      "id": 103,
      "date": "2026-07-09",
      "note": "[Large block of 100000 characters designed to blow up contacts database document limits]"
    }
    ```
*   **Expected Result**: `REJECTED (400 Bad Request - note exceeds maximum length of 2000 characters)`

### Test Payload 12: Index-Scraping List Attempt
*   **Target Path**: `/users/normalUser`
*   **Operation**: `list`
*   **Context**: `request.auth.uid == 'normalUser'` (Verified)
*   **Expected Result**: `REJECTED (403 Forbidden - list operations on parent users metadata collection are blocked)`
