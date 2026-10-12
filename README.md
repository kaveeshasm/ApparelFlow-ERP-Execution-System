# ApparelFlow ERP Execution System

A role-based ERP application for managing garment cutting orders, verifying component quantities, recording fabric wastage, and controlling the sewing workflow.

## 1. Architecture Summary

### Technology Stack

- **Frontend:** Next.js 16, React, TypeScript, Tailwind CSS
- **Backend:** Node.js and Express.js
- **Database:** PostgreSQL hosted on Neon
- **Database Driver:** `pg`
- **Authentication:** JSON Web Tokens (JWT), HTTP-only cookies, and role-based authorization

### System Architecture

```text
User
  |
  v
Next.js Frontend (Port 3000)
  |
  | HTTP requests with credentials
  v
Express.js Backend (Port 9090)
  |
  | Authentication, authorization,
  | validation, and business rules
  v
PostgreSQL Database (Neon)
```

### User Roles

| Role | Responsibilities |
|---|---|
| Cutting Supervisor | View recipes, create cutting orders, and monitor orders created by the supervisor. |
| Cutting Verifier | Check component quantities, approve valid orders, or reject orders with a reason. |
| Sewing Supervisor | View verified orders, review verification records, and start sewing. |

### Order Workflow

1. The cutting supervisor creates an order using a recipe, target quantity, fabric roll ID, and actual fabric usage.
2. The order enters `PENDING_VERIFICATION`.
3. The cutting verifier records actual component quantities.
4. Components are classified as `GREEN` (matches expected quantity), `YELLOW` (exceeds expected quantity), or `RED` (below expected quantity).
5. An order can be approved only when the required counts are present and no component has a shortage.
6. Approved orders become `VERIFIED`. Rejected orders become `REJECTED` and require a reason.
7. The sewing supervisor can access verified orders and start sewing, changing the status to `SEWING_IN_PROGRESS`.

## 2. Database Schema Documentation

The application uses PostgreSQL with the following main tables.

| Table | Purpose |
|---|---|
| `users` | Stores user accounts, login information, and role information. |
| `recipes` | Stores garment recipe details, including recipe codes, names, and standard fabric requirements. |
| `recipe_components` | Stores the components required to produce each garment and the expected pieces per garment. |
| `cutting_orders` | Stores cutting orders, target quantities, fabric roll IDs, actual fabric usage, creators, and workflow statuses. |
| `verification_items` | Stores expected and actual component quantities and their verification statuses for each cutting order. |
| `verification_logs` | Stores verification decisions, verifier identity, rejection notes, timestamps, fabric wastage percentages, and component variances. |

### Main Relationships

- A recipe can contain multiple recipe components.
- A recipe can be used to create multiple cutting orders.
- A cutting order contains multiple verification items.
- A cutting order can have verification log records.
- Users create cutting orders and perform verification decisions.

### Important Business Rules

**Expected fabric usage**

Expected fabric usage is calculated using the recipe's standard fabric requirement and the order's target quantity.

`Expected Fabric = Standard Fabric Yards × Target Quantity`

**Fabric wastage percentage**

`Wastage % = ((Actual Fabric Yards − Expected Fabric Yards) / Expected Fabric Yards) × 100`

**Verification rules**

- Component quantities must be valid non-negative integers.
- Missing component counts prevent approval.
- Any component with a `RED` status prevents approval.
- Rejection requires a reason.
- The authenticated verifier's identity is obtained from the verified JWT, not trusted from the request body.
- The sewing queue returns only orders with status `VERIFIED`.

## 3. Demo Credentials

Use the following accounts to test the three role-based dashboards.

| Role | Email | Password |
|---|---|---|
| Cutting Supervisor | `supervisor@apparelflow.com` | `ChangeMe123!` |
| Cutting Verifier | `verifier@apparelflow.com` | `ChangeMe123!` |
| Sewing Supervisor | `sewing@apparelflow.com` | `ChangeMe123!` |

These are the demo credentials configured in the login interface. Confirm that all three accounts authenticate successfully against the current database before submitting.

## 4. Setup and Installation

### Prerequisites

- Node.js and npm
- Access to the configured Neon PostgreSQL database
- Git, if cloning the repository

### Backend Setup

Open a terminal in the backend directory:

```bash
npm install
```

Create a `.env` file using the following variable names:

```env
DATABASE_URL=your_neon_postgresql_connection_string
JWT_SECRET=your_secret_key
PORT=9090
```

Use the actual values configured for your environment. Do not commit `.env` or database credentials to version control.

Start the backend using the start script configured in the backend's `package.json`, for example:

```bash
npm start
```

### Frontend Setup

Open a separate terminal in the Next.js project root:

```bash
npm install
npm run dev
```

Open the application at:

http://localhost:3000

The backend runs at:

http://localhost:9090

### Backend Connectivity Check

Visit the following endpoint to verify that the backend is running:

http://localhost:9090/test

A successful response should confirm that the backend is connected and responding.

## 5. Main API Endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/login` | Authenticate a user. |
| GET | `/recipes` | Retrieve recipes. |
| GET, POST | `/cutting-orders` | List the supervisor's orders and create cutting orders. |
| GET | `/verification/pending` | Retrieve orders awaiting verification. |
| PUT | `/verification/:orderId/counts` | Save component counts. |
| POST | `/verification/:orderId/decision` | Approve or reject an order. |
| GET | `/sewing-queue` | Retrieve verified orders for sewing. |
| POST | `/sewing-queue/:orderId/start` | Start sewing for a verified order. |

Endpoints are protected by backend authentication and role-based authorization where required.

## 6. Security and Validation

- JWT-based authentication identifies the logged-in user.
- Backend middleware enforces role-based access control.
- Server-side validation checks required fields and quantity values.
- Verification decisions enforce the required workflow rules.
- Database transactions are used for operations that require coordinated updates.
- Verification logs provide an audit trail of decisions and fabric wastage.
- The sewing queue excludes pending and rejected orders.

## 7. Notes

This project was developed as an ERP workflow assignment to demonstrate role-based access control, database integration, order processing, component verification, audit logging, and controlled workflow transitions.