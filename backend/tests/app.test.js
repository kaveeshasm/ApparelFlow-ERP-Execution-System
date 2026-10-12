
const request = require("supertest");
const app = require("../app");

describe("ApparelFlow Backend API", () => {
  test("GET /test should return a successful response", async () => {
    const response = await request(app).get("/test");

    expect(response.statusCode).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe(
      "Backend connected successfully"
    );
  });

  test("Unknown routes should return 404", async () => {
    const response = await request(app).get(
      "/route-that-does-not-exist"
    );

    expect(response.statusCode).toBe(404);
  });

  test("Rejecting an order without a reason should return 400", async () => {
    const jwt = require("jsonwebtoken");

    const token = jwt.sign(
      { userId: 5, role: "cutting_verifier" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${token}`)
      .send({ decision: "REJECTED", rejection_note: "   " });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "A rejection reason is required"
    );
  });

  test("Invalid verification decisions should return 400", async () => {
    const jwt = require("jsonwebtoken");

    const token = jwt.sign(
      { userId: 5, role: "cutting_verifier" },
      process.env.JWT_SECRET
    );

    const response = await request(app)
      .post("/verification/1/decision")
      .set("Cookie", `token=${token}`)
      .send({ decision: "PENDING" });

    expect(response.statusCode).toBe(400);
    expect(response.body.message).toBe(
      "Decision must be APPROVED or REJECTED"
    );
  });
});
