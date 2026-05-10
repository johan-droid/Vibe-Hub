## 2026-05-10 - CSRF Protection Missing on State-Changing Endpoints
**Vulnerability:** State-changing authentication endpoints (`/logout`, `/logout-all`, `/sessions/:id/revoke`) in `apps/server-bridge/auth/routes.js` lacked CSRF protection.
**Learning:** Even though CSRF protection middleware (`csrfProtection`) was implemented in the codebase (`apps/server-bridge/utils/csrf.js`), it was not explicitly applied to the specific authentication endpoints that mutate session state, leaving them vulnerable to Cross-Site Request Forgery attacks.
**Prevention:** Ensure that any endpoint that performs state-changing operations (POST, PUT, DELETE, PATCH) is explicitly wrapped with the `csrfProtection` middleware, especially in authentication and session management flows.
