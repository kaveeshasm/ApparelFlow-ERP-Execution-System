
const request = require("supertest");
const express = require("express");

jest.mock("../db", () => ({
  connect: jest.fn(),
  query: jest.fn(),
}));

jest.mock("../middleware/authMiddleware", () => ({
  authenticateToken: (req, res, next) => {
    const role = req.headers["x-test-role"];

    if (!role) {
      return res.status(401).json({
        success: false,
        message: "Authentication required",
      });
    }

    req.user = {
      id: Number(req.headers["x-test-user-id"] || 1),
      role,
    };

    next();
  },

  authorizeRoles: (...allowedRoles) => (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied",
      });
    }

    next();
  },
}));

const pool = require("../db");
const cuttingOrderRoutes = require("../routes/cuttingOrderRoutes");

const app = express();
app.use(express.json());
app.use("/cutting-orders", cuttingOrderRoutes);

describe("Cutting Order Routes", () => {
  let client;

  beforeEach(() => {
    jest.clearAllMocks();

    client = {
      query: jest.fn(),
      release: jest.fn(),
    };

    pool.connect.mockResolvedValue(client);
  });

  describe("GET /cutting-orders", () => {
    test("should reject unauthenticated requests", async () => {
      const response = await request(app).get("/cutting-orders");

      expect(response.status).toBe(401);
    });

    test("should reject users with the wrong role", async () => {
      const response = await request(app)
        .get("/cutting-orders")
        .set("x-test-role", "cutting_verifier");

      expect(response.status).toBe(403);
    });

    test("should return only orders created by the logged-in supervisor", async () => {
      pool.query.mockResolvedValue({
        rows: [
          {
            id: 1,
            order_no: "CO-TEST-001",
            status: "PENDING_VERIFICATION",
            created_by: 5,
          },
        ],
      });

      const response = await request(app)
        .get("/cutting-orders")
        .set("x-test-role", "cutting_supervisor")
        .set("x-test-user-id", "5");

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.count).toBe(1);

      expect(pool.query).toHaveBeenCalledWith(
        expect.stringContaining("WHERE co.created_by = $1"),
        [5]
      );
    });
  });

  describe("POST /cutting-orders", () => {
    const validOrder = {
      recipe_id: 1,
      target_qty: 10,
      fabric_roll_id: "ROLL-001",
      actual_fabric_yds: 15.5,
    };

    const supervisorRequest = () =>
      request(app)
        .post("/cutting-orders")
        .set("x-test-role", "cutting_supervisor");

    test("should reject unauthenticated requests", async () => {
      const response = await request(app)
        .post("/cutting-orders")
        .send(validOrder);

      expect(response.status).toBe(401);
    });

    test("should reject users with the wrong role", async () => {
      const response = await request(app)
        .post("/cutting-orders")
        .set("x-test-role", "cutting_verifier")
        .send(validOrder);

      expect(response.status).toBe(403);
    });

    test.each([
      ["missing recipe ID", { ...validOrder, recipe_id: undefined }],
      ["zero recipe ID", { ...validOrder, recipe_id: 0 }],
      ["negative recipe ID", { ...validOrder, recipe_id: -1 }],
      ["decimal recipe ID", { ...validOrder, recipe_id: 1.5 }],
      ["missing target quantity", { ...validOrder, target_qty: undefined }],
      ["zero target quantity", { ...validOrder, target_qty: 0 }],
      ["negative target quantity", { ...validOrder, target_qty: -5 }],
      ["decimal target quantity", { ...validOrder, target_qty: 2.5 }],
      ["missing fabric roll ID", { ...validOrder, fabric_roll_id: undefined }],
      ["empty fabric roll ID", { ...validOrder, fabric_roll_id: "   " }],
      ["zero fabric usage", { ...validOrder, actual_fabric_yds: 0 }],
      ["negative fabric usage", { ...validOrder, actual_fabric_yds: -2 }],
      ["string fabric usage", { ...validOrder, actual_fabric_yds: "15.5" }],
      ["missing fabric usage", { ...validOrder, actual_fabric_yds: undefined }],
    ])("should reject %s", async (_description, order) => {
      const response = await supervisorRequest().send(order);

      expect(response.status).toBe(400);
      expect(pool.connect).not.toHaveBeenCalled();
    });

    test("should return 404 when the recipe does not exist", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [] }); // Recipe lookup

      const response = await supervisorRequest().send(validOrder);

      expect(response.status).toBe(404);
      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
      expect(client.release).toHaveBeenCalled();
    });

    test("should reject a recipe without components", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: "Test Recipe",
              std_fabric_yards: 1.5,
              wastage_cap: 10,
            },
          ],
        })
        .mockResolvedValueOnce({ rows: [] }); // Components lookup

      const response = await supervisorRequest().send(validOrder);

      expect(response.status).toBe(422);
      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
      expect(client.release).toHaveBeenCalled();
    });

    test("should create an order and calculate expected component quantities", async () => {
      client.query
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({
          rows: [
            {
              id: 1,
              name: "Test Recipe",
              std_fabric_yards: 1.5,
              wastage_cap: 10,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 11,
              component_name: "Front Panel",
              pieces_per_garment: 2,
            },
            {
              id: 12,
              component_name: "Back Panel",
              pieces_per_garment: 1,
            },
          ],
        })
        .mockResolvedValueOnce({
          rows: [
            {
              id: 100,
              order_no: "CO-TEST-001",
              recipe_id: 1,
              target_qty: 10,
              fabric_roll_id: "ROLL-001",
              actual_fabric_yds: 15.5,
              status: "PENDING_VERIFICATION",
              created_by: 5,
            },
          ],
        })
        .mockResolvedValue({ rows: [] });

      const response = await supervisorRequest()
        .set("x-test-user-id", "5")
        .send(validOrder);

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.order.status).toBe("PENDING_VERIFICATION");

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO verification_items"),
        [100, 11, 20]
      );

      expect(client.query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO verification_items"),
        [100, 12, 10]
      );

      expect(client.query).toHaveBeenCalledWith("COMMIT");
      expect(client.release).toHaveBeenCalled();
    });

    test("should roll back when a database error occurs", async () => {
      client.query.mockRejectedValueOnce(new Error("Database error"));

      const response = await supervisorRequest().send(validOrder);

      expect(response.status).toBe(500);
      expect(client.query).toHaveBeenCalledWith("ROLLBACK");
      expect(client.release).toHaveBeenCalled();
    });
  });
});
