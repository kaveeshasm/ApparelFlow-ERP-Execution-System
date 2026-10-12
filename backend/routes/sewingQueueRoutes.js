
const express = require("express");
const router = express.Router();

const pool = require("../db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

// Get verified cutting orders for the sewing supervisor
router.get(
  "/",
  authenticateToken,
  authorizeRoles("sewing_supervisor"),
  async (req, res) => {
    try {
      const result = await pool.query(`
        SELECT
          co.id AS order_id,
          co.order_no,
          co.recipe_id,
          r.name AS recipe_name,
          r.category,
          co.target_qty,
          co.fabric_roll_id,
          co.actual_fabric_yds,
          co.status,
          co.created_at,
          vl.verifier_id,
          vl.timestamp AS verified_at,
          vl.wastage_pct,
          vl.rejection_note,
          vl.component_variances
        FROM cutting_orders co
        JOIN recipes r
          ON r.id = co.recipe_id
        LEFT JOIN verification_logs vl
          ON vl.order_id = co.id
          AND vl.decision = 'APPROVED'
        WHERE co.status = 'VERIFIED'
        ORDER BY co.updated_at ASC, co.id ASC
      `);

      return res.status(200).json({
        success: true,
        message: "Sewing queue retrieved successfully",
        count: result.rows.length,
        orders: result.rows,
      });
    } catch (error) {
      console.error("Sewing queue error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve sewing queue",
      });
    }
  }
);

// Start sewing for a verified cutting order
router.post(
  "/:orderId/start",
  authenticateToken,
  authorizeRoles("sewing_supervisor"),
  async (req, res) => {
    const orderId = Number(req.params.orderId);

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    let client;

    try {
      client = await pool.connect();

      await client.query("BEGIN");

      // Lock the order to prevent concurrent start requests
      const orderResult = await client.query(
        `SELECT id, status
         FROM cutting_orders
         WHERE id = $1
         FOR UPDATE`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Cutting order not found",
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== "VERIFIED") {
        await client.query("ROLLBACK");

        return res.status(422).json({
          success: false,
          message: "Only verified orders can start sewing",
        });
      }

      // Update the order status when sewing starts
      await client.query(
        `UPDATE cutting_orders
         SET status = 'SEWING_IN_PROGRESS',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $1`,
        [orderId]
      );

      await client.query("COMMIT");

      return res.status(200).json({
        success: true,
        message: "Sewing started successfully",
        order_id: orderId,
        status: "SEWING_IN_PROGRESS",
      });
    } catch (error) {
      if (client) {
        await client.query("ROLLBACK").catch(() => {});
      }

      console.error("Start sewing error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to start sewing",
      });
    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

module.exports = router;
