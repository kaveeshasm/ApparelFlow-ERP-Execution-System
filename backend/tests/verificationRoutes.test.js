
const express = require("express");
const cookieParser = require("cookie-parser");
const jwt = require("jsonwebtoken");
const request = require("supertest");

jest.mock("../db", () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

process.env.JWT_SECRET = "test-secret-for-automated-tests";

const pool = require("../db");
const verificationRoutes = require("../routes/verificationRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/verification", verificationRoutes);

const createVerifierToken = () =>
  jwt.sign(
    { userId: 5, role: "cutting_verifier" },
    process.env.JWT_SECRET
  );

describe("Verification decision validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should reject an invalid order ID", async () => {
    const response = await request(app)
      .post("/verification/abc/decision")
      .set("Cookie", `token=${createVerifierToken()}`)
      .send({ decision: "APPROVED" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Invalid order ID");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("should reject an invalid decision", async () => {
    const response = await request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${createVerifierToken()}`)
      .send({ decision: "PENDING" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Decision must be APPROVED or REJECTED"
    );
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("should reject an order without a rejection reason", async () => {
    const response = await request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${createVerifierToken()}`)
      .send({
        decision: "REJECTED",
        rejection_note: "   ",
      });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "A rejection reason is required"
    );
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("should reject a request without authentication", async () => {
    const response = await request(app)
      .post("/verification/1/decision")
      .send({ decision: "APPROVED" });

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Authentication required");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("should reject users with the wrong role", async () => {
    const token = jwt.sign(
      { userId: 4, role: "cutting_supervisor" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${token}`)
      .send({ decision: "APPROVED" });

    expect(response.statusCode).toBe(403);
    expect(pool.connect).not.toHaveBeenCalled();
  });
});

describe("Verification approval rules", () => {
  let client;
  let queryResults;

  beforeEach(() => {
    jest.clearAllMocks();

    queryResults = [];

    client = {
      query: jest.fn(async () => {
        return queryResults.shift() || { rows: [] };
      }),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);
  });

  const sendDecision = (decision, extra = {}) =>
    request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${createVerifierToken()}`)
      .send({ decision, ...extra });

  const pendingOrder = {
    id: 1,
    status: "PENDING_VERIFICATION",
    target_qty: 100,
    actual_fabric_yds: 190,
    std_fabric_yards: 1.8,
  };

  const component = {
    id: 10,
    component_id: 2,
    component_name: "Front Panel",
    expected_qty: 100,
    actual_qty: 100,
    status: "GREEN",
  };

  test("should block approval when a component has a shortage", async () => {
    queryResults = [
      { rows: [] },
      { rows: [pendingOrder] },
      {
        rows: [{ ...component, actual_qty: 90, status: "RED" }],
      },
    ];

    const response = await sendDecision("APPROVED");

    expect(response.statusCode).toBe(422);
    expect(response.body.message).toBe(
      "Approval blocked: component shortages exist"
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("should block approval when a component has not been counted", async () => {
    queryResults = [
      { rows: [] },
      { rows: [pendingOrder] },
      {
        rows: [
          { ...component, actual_qty: null, status: "UNCHECKED" },
        ],
      },
    ];

    const response = await sendDecision("APPROVED");

    expect(response.statusCode).toBe(422);
    expect(response.body.message).toBe(
      "Approval blocked: some components have not been counted"
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("should approve a valid order and record its audit log", async () => {
    queryResults = [
      { rows: [] }, // BEGIN
      { rows: [pendingOrder] }, // Locked order
      { rows: [component] }, // Counted components
      { rows: [{ wastage_pct: "5.56" }] }, // Wastage calculation
      { rows: [] }, // Update order status
      { rows: [] }, // Insert audit log
      { rows: [] }, // COMMIT
    ];

    const response = await sendDecision("APPROVED");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe("VERIFIED");
    expect(response.body.decision).toBe("APPROVED");
    expect(Number(response.body.wastage_pct)).toBeCloseTo(5.56);

    expect(response.body.component_variances).toEqual([
      {
        component_id: 2,
        component_name: "Front Panel",
        expected_qty: 100,
        actual_qty: 100,
        variance: 0,
        status: "GREEN",
      },
    ]);

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE cutting_orders"),
      ["VERIFIED", 1]
    );

    const auditCall = client.query.mock.calls.find(
      ([sql]) => typeof sql === "string" &&
        sql.includes("INSERT INTO verification_logs")
    );

    expect(auditCall).toBeDefined();
    expect(auditCall[1][0]).toBe(1);
    expect(auditCall[1][1]).toBe(5);
    expect(auditCall[1][2]).toBe("APPROVED");
    expect(auditCall[1][3]).toBeNull();
    expect(Number(auditCall[1][4])).toBeCloseTo(5.56);

    const loggedVariances = JSON.parse(auditCall[1][5]);
    expect(loggedVariances[0].variance).toBe(0);

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });

  test("should reject an order and record the rejection reason", async () => {
    queryResults = [
      { rows: [] }, // BEGIN
      { rows: [pendingOrder] }, // Locked order
      { rows: [component] }, // Components
      { rows: [{ wastage_pct: "5.56" }] }, // Wastage
      { rows: [] }, // Update order status
      { rows: [] }, // Insert audit log
      { rows: [] }, // COMMIT
    ];

    const response = await sendDecision("REJECTED", {
      rejection_note: "Fabric quality issue",
    });

    expect(response.statusCode).toBe(200);
    expect(response.body.status).toBe("REJECTED");
    expect(response.body.decision).toBe("REJECTED");

    expect(client.query).toHaveBeenCalledWith(
      expect.stringContaining("UPDATE cutting_orders"),
      ["REJECTED", 1]
    );

    const auditCall = client.query.mock.calls.find(
      ([sql]) => typeof sql === "string" &&
        sql.includes("INSERT INTO verification_logs")
    );

    expect(auditCall).toBeDefined();
    expect(auditCall[1][1]).toBe(5);
    expect(auditCall[1][2]).toBe("REJECTED");
    expect(auditCall[1][3]).toBe("Fabric quality issue");

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
