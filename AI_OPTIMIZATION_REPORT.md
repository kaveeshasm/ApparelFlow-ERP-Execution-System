# AI Optimization Report — ApparelFlow ERP Execution System

## 1. Tools & Prompting

### AI Tools Used

I primarily used **ChatGPT** as a development assistant while building the ApparelFlow ERP Execution System. My main purpose was to receive guidance, understand implementation approaches, troubleshoot errors, and generate initial versions of selected UI components.

The project was developed using Next.js, React, Node.js, Express, PostgreSQL, and Neon.

### How I Used AI

**UI scaffolding and styling**
- Used ChatGPT to generate initial dashboard components for the Cutting Supervisor, Cutting Verifier, and Sewing Supervisor.
- Used the generated UI code as a starting point and adapted it to the requirements of each role.
- Used AI suggestions to structure tables, summary cards, forms, status indicators, and user feedback messages.

**Backend development guidance**
- Requested guidance on structuring Express routes and authentication middleware.
- Used AI explanations to understand JWT authentication, role-based authorization, API requests, and database operations.
- Used AI assistance to troubleshoot API errors and connect the frontend to the backend.

**Database and workflow guidance**
- Used AI to understand the PostgreSQL schema, cutting-order workflow, component verification, and audit records.
- Received guidance on exporting the local database and migrating it to Neon.
- Used API testing and database queries to verify that the cloud database contained the required records.

**Prompting approach**

My prompts generally described a specific implementation task or problem, such as creating a dashboard, connecting a frontend page to an API endpoint, correcting a backend error, or implementing a role-specific workflow.

I reviewed the generated code and tested the relevant functionality instead of treating AI output as production-ready code.

---

## 2. Flawed / Broken AI Code

AI-generated code required review because a solution that appears correct in isolation may not satisfy the application's routing, security, or workflow requirements.

### Issue 1: Inconsistent Frontend Routing

During dashboard development, the Cutting Supervisor page existed under the `/cutting-supervisor` route, while the role-based login configuration referenced `/supervisor`.

This mismatch could cause a successful login to redirect the user to a different page than the intended dashboard.

**Potential impact**
- Users could reach an unexpected page after logging in.
- A dashboard might appear unavailable even when its component exists.
- Maintaining multiple route paths for the same role could create unnecessary confusion.

**Engineering response**

I identified the need to keep the dashboard folder structure and role-to-route mapping consistent. The appropriate correction is to use one intended route for the Cutting Supervisor in the authentication configuration and test the redirect after login.

### Issue 2: Frontend Validation Is Not a Security Boundary

During development, the UI included controls that restrict available actions, such as displaying role-specific buttons and showing orders appropriate to the current workflow.

However, frontend controls alone cannot enforce authorization. A user can bypass hidden or disabled buttons by sending requests directly through Postman or another HTTP client.

**Potential impact**
- An unauthorized user could attempt a protected operation directly.
- A user might try to approve an order without the required role.
- A sewing supervisor might attempt to access orders that have not been verified.

**Engineering response**

I used server-side authentication and authorization middleware to enforce role permissions. The backend also checks order status before allowing workflow transitions. These checks must remain effective even when a request is sent outside the frontend.

---

## 3. Human Refactoring

AI-generated code was used as an initial implementation, and I used engineering judgment to align the application with its requirements.

### Frontend Refactoring

- Integrated dashboard components with the actual Express API endpoints.
- Used loading indicators, error messages, and refresh actions to handle API responses.
- Added form validation and feedback for order creation and component verification.
- Aligned dashboard navigation with the role-specific application structure.

### Backend Refactoring

- Used authentication middleware to validate JWTs before protected operations.
- Used role-based authorization middleware to restrict access to role-specific routes.
- Derived the authenticated user identity from the verified token rather than trusting a user ID supplied in a request body.
- Validated quantities, required fields, fabric usage, and rejection reasons before database operations.
- Used database transactions and row locking for critical verification and workflow operations where required.

### Workflow Refactoring

The intended workflow is:

`Order Created → Pending Verification → Verified or Rejected → Sewing In Progress`

The Cutting Supervisor creates an order, and the order enters `PENDING_VERIFICATION`. The Cutting Verifier checks component quantities against expected quantities. An order containing a component shortage cannot be approved. Once approved, the order becomes `VERIFIED` and is eligible for the sewing queue. A rejected order cannot proceed to sewing.

The Sewing Supervisor can start sewing only for an eligible verified order. The backend validates the current status before updating it to `SEWING_IN_PROGRESS`.

These checks protect the workflow from invalid transitions rather than relying only on the state displayed in the UI.

---

## 4. Defensive Architecture

The application uses multiple layers of validation and authorization to protect its data and workflow.

### Authentication and API Guards

- JWT authentication protects relevant API endpoints.
- The authentication token is stored in an HTTP-only cookie.
- Role-based middleware restricts cutting, verification, and sewing operations.
- The backend obtains the authenticated user's identity and role from the verified token.
- Unauthorized operations are rejected by the server, even if attempted directly through Postman.

### State Machine and Status Protection

The order status represents the current state of the workflow.

| Status | Meaning |
|---|---|
| `PENDING_VERIFICATION` | The cutting order is awaiting component verification. |
| `VERIFIED` | The verifier approved the order. |
| `REJECTED` | The verifier rejected the order. |
| `SEWING_IN_PROGRESS` | Sewing has started for an approved order. |

The backend controls status transitions. A client cannot make an order eligible for sewing simply by changing a status value in the frontend.

- Cutting-order creation assigns the initial status on the server.
- Verification decisions are handled by protected endpoints.
- Component shortages block approval.
- Rejection requires a reason.
- Sewing queue retrieval filters for `VERIFIED` orders.
- Starting sewing requires the order to remain in the correct state.

Database constraints provide an additional layer of protection against invalid status values.

### Input Validation and Data Integrity

- Required inputs are checked before database operations.
- Target quantities and component counts must be valid integers.
- Invalid or negative quantities are rejected.
- Fabric usage must be a valid positive number.
- Verification decisions are validated.
- Database transactions protect critical multi-step operations from partial updates.

### Auditability

Verification records capture relevant information such as the verifier's ID, verification timestamp, approval or rejection decision, component variances, fabric wastage percentage, and rejection reason where applicable.

This supports traceability when reviewing decisions made during cutting verification.

### Database Reliability

The application uses PostgreSQL for persistent data and Neon as the cloud database provider. The local database was exported and restored to Neon, and the backend recipe endpoint was tested successfully against the cloud database.

The application should continue to be tested after deployment or configuration changes to confirm that authentication, data retrieval, and workflow operations work as expected.

---

## Conclusion

I used ChatGPT primarily as a development guide and as a source of initial UI code, implementation examples, and troubleshooting suggestions. The generated output was not treated as a substitute for understanding the system or validating its behavior.

This process reinforced the importance of checking route consistency, enforcing authorization on the backend, validating inputs, protecting workflow state transitions, and maintaining reliable audit records.

The final objective was not simply to generate code quickly, but to use AI assistance while applying engineering judgment to produce a more reliable, maintainable, and secure application.
