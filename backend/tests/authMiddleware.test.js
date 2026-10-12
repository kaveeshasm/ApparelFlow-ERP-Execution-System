
const jwt = require("jsonwebtoken");
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");

require("dotenv").config();

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const app = express();

app.use(cookieParser());

app.get(
  "/cutting-supervisor",
  authenticateToken,
  authorizeRoles("cutting_supervisor"),
  (req, res) => {
    res.status(200).json({
      success: true,
      userId: req.user.id,
      role: req.user.role,
    });
  }
);

describe("Authentication and Role Authorization", () => {
  beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-automated-tests";
  });

  test("should reject requests without a token", async () => {
    const response = await request(app).get("/cutting-supervisor");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe("Authentication required");
  });

  test("should reject an invalid token", async () => {
    const response = await request(app)
      .get("/cutting-supervisor")
      .set("Cookie", "token=invalid-token");

    expect(response.statusCode).toBe(401);
    expect(response.body.message).toBe(
      "Invalid or expired authentication token"
    );
  });

  test("should reject a user with the wrong role", async () => {
    const token = jwt.sign(
      { userId: 5, role: "cutting_verifier" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/cutting-supervisor")
      .set("Cookie", `token=${token}`);

    expect(response.statusCode).toBe(403);
    expect(response.body.message).toBe(
      "You do not have permission to access this resource"
    );
  });

  test("should allow a user with the correct role", async () => {
    const token = jwt.sign(
      { userId: 4, role: "cutting_supervisor" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .get("/cutting-supervisor")
      .set("Cookie", `token=${token}`);

    expect(response.statusCode).toBe(200);
    expect(response.body.role).toBe("cutting_supervisor");
    expect(response.body.userId).toBe(4);
  });
});
