
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
const sewingQueueRoutes = require("../routes/sewingQueueRoutes");

const app = express();

app.use(express.json());
app.use(cookieParser());
app.use("/sewing-queue", sewingQueueRoutes);

const createToken = (role, userId = 7) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET);

describe("Sewing queue access", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should reject unauthenticated users", async () => {
    const response = await request(app).get("/sewing-queue");

    expect(response.statusCode).toBe(401);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("should reject users without the sewing supervisor role", async () => {
    const response = await request(app)
      .get("/sewing-queue")
      .set(
        "Cookie",
        `token=${createToken("cutting_verifier")}`
      );

    expect(response.statusCode).toBe(403);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test("should return verified orders for the sewing supervisor", async () => {
    const verifiedOrders = [
      {
        order_id: 12,
        order_no: "CO-0012",
        recipe_name: "Basic T-Shirt",
        target_qty: 100,
        status: "VERIFIED",
        verifier_id: 5,
        wastage_pct: "5.56",
      },
    ];

    pool.query.mockResolvedValueOnce({
      rows: verifiedOrders,
    });

    const response = await request(app)
      .get("/sewing-queue")
      .set(
        "Cookie",
        `token=${createToken("sewing_supervisor")}`
      );

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.count).toBe(1);
    expect(response.body.orders).toEqual(verifiedOrders);

    const sql = pool.query.mock.calls[0][0];

    expect(sql).toContain("WHERE co.status = 'VERIFIED'");
    expect(sql).toContain("vl.decision = 'APPROVED'");
  });

  test("should return an empty queue when no orders are verified", async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const response = await request(app)
      .get("/sewing-queue")
      .set(
        "Cookie",
        `token=${createToken("sewing_supervisor")}`
      );

    expect(response.statusCode).toBe(200);
    expect(response.body.count).toBe(0);
    expect(response.body.orders).toEqual([]);
  });
});

describe("Starting sewing", () => {
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

  const startSewing = (orderId) =>
    request(app)
      .post(`/sewing-queue/${orderId}/start`)
      .set(
        "Cookie",
        `token=${createToken("sewing_supervisor")}`
      );

  test("should reject an invalid order ID", async () => {
    const response = await startSewing("abc");

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe("Invalid order ID");
    expect(pool.connect).not.toHaveBeenCalled();
  });

  test("should not start sewing for an unverified order", async () => {
    queryResults = [
      { rows: [] }, // BEGIN
      {
        rows: [{ id: 12, status: "PENDING_VERIFICATION" }],
      },
      { rows: [] }, // ROLLBACK
    ];

    const response = await startSewing(12);

    expect(response.statusCode).toBe(422);
    expect(response.body.message).toBe(
      "Only verified orders can start sewing"
    );
    expect(client.query).toHaveBeenCalledWith("ROLLBACK");
    expect(client.release).toHaveBeenCalled();
  });

  test("should start sewing for a verified order", async () => {
    queryResults = [
      { rows: [] }, // BEGIN
      {
        rows: [{ id: 12, status: "VERIFIED" }],
      },
      { rows: [] }, // UPDATE
      { rows: [] }, // COMMIT
    ];

    const response = await startSewing(12);

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.order_id).toBe(12);
    expect(response.body.status).toBe("SEWING_IN_PROGRESS");

    expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("UPDATE cutting_orders"),
        [12]
    );

    expect(client.query).toHaveBeenCalledWith("COMMIT");
    expect(client.release).toHaveBeenCalled();
  });
});
