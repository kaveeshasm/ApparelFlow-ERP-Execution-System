const express = require("express");
const crypto = require("crypto");

const pool = require("../db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// GET: Retrieve cutting orders created by the logged-in supervisor
router.get(
  "/",
  authenticateToken,
  authorizeRoles("cutting_supervisor"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          co.id,
          co.order_no,
          co.recipe_id,
          r.recipe_code,
          r.name AS recipe_name,
          r.category,
          co.target_qty,
          co.fabric_roll_id,
          co.actual_fabric_yds,
          co.status,
          co.created_by,
          co.created_at,
          co.updated_at
        FROM cutting_orders co
        JOIN recipes r ON r.id = co.recipe_id
        WHERE co.created_by = $1
        ORDER BY co.created_at DESC, co.id DESC
        `,
        [req.user.id]
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        orders: result.rows,
      });
    } catch (error) {
      console.error("Fetch cutting orders error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve cutting orders",
      });
    }
  }
);

// POST: Create a new cutting order
router.post(
  "/",
  authenticateToken,
  authorizeRoles("cutting_supervisor"),
  async (req, res) => {
    const {
      recipe_id,
      target_qty,
      fabric_roll_id,
      actual_fabric_yds,
    } = req.body;

    // Validate recipe ID
    if (!Number.isInteger(recipe_id) || recipe_id <= 0) {
      return res.status(400).json({
        success: false,
        message: "recipe_id must be a positive integer",
      });
    }

    // Validate target quantity
    if (!Number.isInteger(target_qty) || target_qty <= 0) {
      return res.status(400).json({
        success: false,
        message: "target_qty must be a positive integer",
      });
    }

    // Validate fabric roll ID
    if (
      typeof fabric_roll_id !== "string" ||
      fabric_roll_id.trim() === ""
    ) {
      return res.status(400).json({
        success: false,
        message: "fabric_roll_id is required",
      });
    }

    // Validate actual fabric quantity
    if (
      typeof actual_fabric_yds !== "number" ||
      !Number.isFinite(actual_fabric_yds) ||
      actual_fabric_yds <= 0
    ) {
      return res.status(400).json({
        success: false,
        message: "actual_fabric_yds must be a positive number",
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      // Check whether the recipe exists
      const recipeResult = await client.query(
        `
        SELECT id, name, std_fabric_yards, wastage_cap
        FROM recipes
        WHERE id = $1
        `,
        [recipe_id]
      );

      if (recipeResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Recipe not found",
        });
      }

      // Retrieve the recipe components
      const componentsResult = await client.query(
        `
        SELECT id, component_name, pieces_per_garment
        FROM recipe_components
        WHERE recipe_id = $1
        ORDER BY id
        `,
        [recipe_id]
      );

      if (componentsResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(422).json({
          success: false,
          message: "Selected recipe has no components",
        });
      }

      // Generate a unique cutting order number
      const orderNo = `CO-${Date.now()}-${crypto
        .randomBytes(3)
        .toString("hex")
        .toUpperCase()}`;

      // Insert the cutting order
      const orderResult = await client.query(
        `
        INSERT INTO cutting_orders (
          order_no,
          recipe_id,
          target_qty,
          fabric_roll_id,
          actual_fabric_yds,
          status,
          created_by
        )
        VALUES ($1, $2, $3, $4, $5, 'PENDING_VERIFICATION', $6)
        RETURNING
          id,
          order_no,
          recipe_id,
          target_qty,
          fabric_roll_id,
          actual_fabric_yds,
          status,
          created_by,
          created_at
        `,
        [
          orderNo,
          recipe_id,
          target_qty,
          fabric_roll_id.trim(),
          actual_fabric_yds,
          req.user.id,
        ]
      );

      const order = orderResult.rows[0];

      // Create a verification item for every recipe component
      for (const component of componentsResult.rows) {
        const expectedQty =
          component.pieces_per_garment * target_qty;

        await client.query(
          `
          INSERT INTO verification_items (
            order_id,
            component_id,
            expected_qty,
            actual_qty,
            status
          )
          VALUES ($1, $2, $3, NULL, 'UNCHECKED')
          `,
          [order.id, component.id, expectedQty]
        );
      }

      await client.query("COMMIT");

      return res.status(201).json({
        success: true,
        message: "Cutting order created successfully",
        order,
      });
    } catch (error) {
      if (client) {
        try {
          await client.query("ROLLBACK");
        } catch (rollbackError) {
          console.error("Transaction rollback error:", rollbackError);
        }
      }

      console.error("Create cutting order error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to create cutting order",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;