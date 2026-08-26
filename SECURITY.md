# 🔒 ClipAI Studio — Security & Production Policy

This document outlines the security architecture, token handling protocols, authorization boundaries, and maintenance procedures for **ClipAI Studio**.

---

## 1. Authentication & Authorization Model

### 1.1 Session Management
- **Session Tokens**: All sessions are cryptographically signed using Flask's `SECRET_KEY` and delivered via HTTP-Only, `SameSite=Lax` cookies.
- **User Scoping**:
  - Every visitor is assigned an isolated session ID (`session['user_id']`).
  - Database records in `clips` and `jobs` are strictly associated with `user_id`.
  - All read, download, status, and patch endpoints (`/api/projects`, `/api/download/<clip_id>`, `/api/status/<job_id>`, `/api/clip/<clip_id>/caption-style`) verify ownership before returning or modifying data.
  - Cross-user data leakage and horizontal privilege escalation are strictly prevented.

---

## 2. OAuth Token Custody & YouTube API Security

### 2.1 In-Memory Client Custody
- Google OAuth access tokens are held **strictly in-memory** within React application state.
- Tokens are **never written to persistent storage** (`localStorage` or `IndexedDB`) to mitigate risk from any client-side vector.

### 2.2 Server-Side Token Verification & Expiry
- Before enqueueing any YouTube Shorts upload job, the backend verifies the access token against Google's tokeninfo endpoint (`https://oauth2.googleapis.com/tokeninfo`).
- The backend validates:
  1. Token signature and validity.
  2. Remaining TTL (`expires_in > 10s`).
  3. Required permissions (`https://www.googleapis.com/auth/youtube.upload`).
- Expired or invalid tokens return clear, actionable error feedback instead of silent failure.

---

## 3. Stored XSS Mitigation & Input Sanitization

- All user-supplied and AI-generated metadata (titles, descriptions, captions, tags) are sanitized on ingest via `html.escape` and tag-stripping regex patterns.
- The React frontend uses JSX text nodes by default, eliminating `innerHTML` injection vectors.

---

## 4. Administrative Security

- The database and storage cleanup endpoint `POST /api/admin/cleanup` is locked behind an `X-Admin-Key` header check.
- Requests without a valid matching `ADMIN_API_KEY` are rejected with `403 Forbidden`.

---

## 5. Concurrency & Rate Limiting

- **Rate Limiting**: Configured using `Flask-Limiter` backed by Redis (`REDIS_URL`) with an in-memory fallback.
- **Worker Concurrency**: Unbounded thread creation is replaced with a bounded `ThreadPoolExecutor(max_workers=3)` or asynchronous Redis Queue (`rq worker`) worker processes.

---

## 6. Secret Rotation Procedure

If any key is compromised or scheduled for rotation, follow these steps:

1. **Generate a New Secret Key**:
   ```bash
   python -c "import secrets; print(secrets.token_hex(32))"
   ```
2. **Update `.env`**:
   Replace `SECRET_KEY`, `ADMIN_API_KEY`, and external provider keys (`GROQ_API_KEY`, `YOUTUBE_API_KEY`, `GOOGLE_OAUTH_CLIENT_ID`).
3. **Restart the Application**:
   ```bash
   python app.py
   ```
4. **Git Pre-Commit Hygiene**:
   Ensure `.env`, `.env.*`, and `*.env` remain ignored by `.gitignore`.
