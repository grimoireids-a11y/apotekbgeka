# Security Specification & Payload-First Threat Model (OBGYN Practice Management System)

## 1. Data Invariants
1. **Default Deny**: No unauthenticated or unverified Firebase user may read or write any document in any of the 35 collections.
2. **Strict Role Separation (UU Kesehatan / Permenkes 24/2022)**:
   - Only `SUPER_ADMIN` can manage `users`, `roles`, `permissions`, `practice_settings`, `system_settings`, `integrations`, `backups`, and approve `refunds`.
   - Only `DOKTER_SPOG` or `SUPER_ADMIN` can author/sign/lock `medical_records`, `diagnoses`, `ultrasound_records`, `pregnancies`, and authorize `prescriptions`.
   - Once a `medical_records` document reaches `status == 'locked'`, no non-admin update or delete is permitted.
   - `ASISTEN_DOKTER` cannot modify `medical_records`, `diagnoses`, doctor-signed `prescriptions`, or delete any medical record.
   - `DOKTER_SPOG` cannot modify processed `payments`, `invoices`, `cash_sessions`, or `cash_transactions`.
3. **Immutable Audit Trail**: `audit_logs` and `medical_record_versions` are strictly append-only (`allow update, delete: if false`).
4. **End-to-End Encryption (UU PDP No. 27/2022)**: Sensitive PII and clinical fields are encrypted client-side with AES-256-GCM before transmission; per-user wrapped keys are stored isolated in `/users/{userId}` with owner/admin read gates.
5. **Path & Size Hardening**: Every document ID must satisfy `^[a-zA-Z0-9_\-]+$` (`<= 128` chars), and every validated string enforces explicit upper bounds.

## 2. Adversarial "Dirty Dozen" Payloads (Expected: PERMISSION_DENIED)
1. **Unauthenticated Patient Read**: `GET /patients/pat-1` with `auth: null`.
2. **Unverified Email Spoof**: `GET /patients/pat-1` with `auth.token.email == 'grimoireids@gmail.com'` and `email_verified: false`.
3. **Self-Privilege Escalation**: `CREATE /users/{uid}` with `role: 'SUPER_ADMIN'` by non-admin.
4. **Assistant Editing Locked RME**: `UPDATE /medical_records/rme-1` by `ASISTEN_DOKTER` trying to change `diagnosis` or `status`.
5. **Doctor Modifying Cashier Payment**: `UPDATE /payments/pay-1` by `DOKTER_SPOG` trying to alter `amount`.
6. **Audit Log Tampering**: `DELETE /audit_logs/log-1` or `UPDATE /audit_logs/log-1` by any user (including Super Admin).
7. **Shadow Field Injection**: `CREATE /patients/pat-9` including unexpected key `isVerifiedAdmin: true`.
8. **ID Poisoning**: `CREATE /patients/invalid..id/with/spaces` exceeding allowed regex/length.
9. **Oversized String Exhaustion**: `CREATE /patients/pat-10` with 50KB `fullName`.
10. **Assistant Approving Refund**: `UPDATE /refunds/ref-1` setting `status: 'Disetujui'` by `ASISTEN_DOKTER`.
11. **Doctor Deleting Patient**: `DELETE /patients/pat-1` by `DOKTER_SPOG`.
12. **Cross-User Key Harvest**: `GET /users/other-uid` by `ASISTEN_DOKTER` or `DOKTER_SPOG` attempting to read another user's `e2eeWrappedKey`.
