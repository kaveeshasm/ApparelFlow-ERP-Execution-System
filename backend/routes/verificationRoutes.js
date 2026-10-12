const express = require("express");

const pool = require("../db");
const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();

// GET: Retrieve orders waiting for verification
router.get(
  "/pending",
  authenticateToken,
  authorizeRoles("cutting_verifier"),
  async (req, res) => {
    try {
      const result = await pool.query(
        `
        SELECT
          co.id AS order_id,
          co.order_no,
          co.recipe_id,
          r.recipe_code,
          r.name AS recipe_name,
          r.category,
          co.target_qty,
          co.fabric_roll_id,
          co.actual_fabric_yds,
          co.created_at,
          COALESCE(
            json_agg(
              json_build_object(
                'verification_item_id', vi.id,
                'component_id', rc.id,
                'component_name', rc.component_name,
                'pieces_per_garment', rc.pieces_per_garment,
                'expected_qty', vi.expected_qty,
                'actual_qty', vi.actual_qty,
                'status', vi.status
              )
              ORDER BY vi.id
            ) FILTER (WHERE vi.id IS NOT NULL),
            '[]'::json
          ) AS components
        FROM cutting_orders co
        JOIN recipes r
          ON r.id = co.recipe_id
        LEFT JOIN verification_items vi
          ON vi.order_id = co.id
        LEFT JOIN recipe_components rc
          ON rc.id = vi.component_id
        WHERE co.status = 'PENDING_VERIFICATION'
        GROUP BY
          co.id,
          co.order_no,
          co.recipe_id,
          r.recipe_code,
          r.name,
          r.category,
          co.target_qty,
          co.fabric_roll_id,
          co.actual_fabric_yds,
          co.created_at
        ORDER BY co.created_at ASC, co.id ASC
        `
      );

      return res.status(200).json({
        success: true,
        count: result.rows.length,
        orders: result.rows,
      });
    } catch (error) {
      console.error("Fetch pending verification orders error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to retrieve pending orders",
      });
    }
  }
);

router.put(
  "/:orderId/counts",
  authenticateToken,
  authorizeRoles("cutting_verifier"),
  async (req, res) => {
    const { orderId } = req.params;
    const { counts } = req.body;

    // Validate order ID
    const parsedOrderId = Number(orderId);

    if (!Number.isInteger(parsedOrderId) || parsedOrderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    // Validate counts array
    if (!Array.isArray(counts) || counts.length === 0) {
      return res.status(400).json({
        success: false,
        message: "counts must be a non-empty array",
      });
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      // Check that the order exists and is still waiting for verification
      const orderResult = await client.query(
        `
        SELECT
          id,
          status
        FROM cutting_orders
        WHERE id = $1
        FOR UPDATE
        `,
        [parsedOrderId]
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(404).json({
          success: false,
          message: "Cutting order not found",
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== "PENDING_VERIFICATION") {
        await client.query("ROLLBACK");

        return res.status(409).json({
          success: false,
          message: "This order is no longer waiting for verification",
        });
      }

      // Get all verification items for this order
      const itemsResult = await client.query(
        `
        SELECT
          id,
          component_id,
          expected_qty
        FROM verification_items
        WHERE order_id = $1
        ORDER BY id
        `,
        [parsedOrderId]
      );

      if (itemsResult.rows.length === 0) {
        await client.query("ROLLBACK");

        return res.status(422).json({
          success: false,
          message: "No verification items found for this order",
        });
      }

      // Make sure every item has exactly one count
      if (counts.length !== itemsResult.rows.length) {
        await client.query("ROLLBACK");

        return res.status(400).json({
          success: false,
          message: "A count is required for every component",
        });
      }

      // Map submitted counts by verification item ID
      const submittedCounts = new Map();

      for (const item of counts) {
        if (
          !Number.isInteger(item.verification_item_id) ||
          item.verification_item_id <= 0
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Invalid verification_item_id",
          });
        }

        if (
          !Number.isInteger(item.actual_qty) ||
          item.actual_qty < 0
        ) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message:
              "actual_qty must be a non-negative integer",
          });
        }

        if (submittedCounts.has(item.verification_item_id)) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "Duplicate verification item ID",
          });
        }

        submittedCounts.set(
          item.verification_item_id,
          item.actual_qty
        );
      }

      // Update each verification item
      for (const verificationItem of itemsResult.rows) {
        if (!submittedCounts.has(verificationItem.id)) {
          await client.query("ROLLBACK");

          return res.status(400).json({
            success: false,
            message: "A count is missing for a component",
          });
        }

        const actualQty = submittedCounts.get(
          verificationItem.id
        );

        let status = "GREEN";

        if (actualQty > verificationItem.expected_qty) {
          status = "YELLOW";
        } else if (actualQty < verificationItem.expected_qty) {
          status = "RED";
        }

        await client.query(
          `
          UPDATE verification_items
          SET
            actual_qty = $1,
            status = $2
          WHERE id = $3
            AND order_id = $4
          `,
          [
            actualQty,
            status,
            verificationItem.id,
            parsedOrderId,
          ]
        );
      }

      await client.query("COMMIT");

      // Return updated verification items
      const updatedResult = await pool.query(
        `
        SELECT
          vi.id,
          vi.order_id,
          vi.component_id,
          rc.component_name,
          vi.expected_qty,
          vi.actual_qty,
          vi.status
        FROM verification_items vi
        JOIN recipe_components rc
          ON rc.id = vi.component_id
        WHERE vi.order_id = $1
        ORDER BY vi.id
        `,
        [parsedOrderId]
      );

      return res.status(200).json({
        success: true,
        message: "Verification counts recorded successfully",
        items: updatedResult.rows,
      });
    } catch (error) {
      await client.query("ROLLBACK");

      console.error("Record verification counts error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to record verification counts",
      });
    } finally {
      client.release();
    }
  }
);


router.post(
  "/:orderId/decision",
  authenticateToken,
  authorizeRoles("cutting_verifier"),
  async (req, res) => {
    const orderId = Number(req.params.orderId);
    const { decision, rejection_note } = req.body;

    if (!Number.isSafeInteger(orderId) || orderId <= 0) {
      return res.status(400).json({
        success: false,
        message: "Invalid order ID",
      });
    }

    if (!["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({
        success: false,
        message: "Decision must be APPROVED or REJECTED",
      });
    }

    if (
      decision === "REJECTED" &&
      (typeof rejection_note !== "string" ||
        rejection_note.trim() === "")
    ) {
      return res.status(400).json({
        success: false,
        message: "A rejection reason is required",
      });
    }

    const client = await pool.connect();
    let transactionStarted = false;

    try {
      await client.query("BEGIN");
      transactionStarted = true;

      // Lock the order so concurrent decisions cannot race.
      const orderResult = await client.query(
        `SELECT
           co.id,
           co.status,
           co.target_qty,
           co.actual_fabric_yds,
           r.std_fabric_yards
         FROM cutting_orders co
         JOIN recipes r ON r.id = co.recipe_id
         WHERE co.id = $1
         FOR UPDATE OF co`,
        [orderId]
      );

      if (orderResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(404).json({
          success: false,
          message: "Cutting order not found",
        });
      }

      const order = orderResult.rows[0];

      if (order.status !== "PENDING_VERIFICATION") {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(409).json({
          success: false,
          message: "This order has already been decided",
        });
      }

      // Lock and retrieve every component for this order.
      const itemsResult = await client.query(
        `SELECT
           vi.id,
           vi.component_id,
           rc.component_name,
           vi.expected_qty,
           vi.actual_qty,
           vi.status
         FROM verification_items vi
         JOIN recipe_components rc
           ON rc.id = vi.component_id
         WHERE vi.order_id = $1
         ORDER BY vi.id
         FOR UPDATE OF vi`,
        [orderId]
      );

      const items = itemsResult.rows;

      if (items.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(422).json({
          success: false,
          message: "No verification items exist for this order",
        });
      }

      if (decision === "APPROVED") {
        const hasUncountedItem = items.some(
          (item) =>
            item.actual_qty === null ||
            item.status === "UNCHECKED"
        );

        if (hasUncountedItem) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(422).json({
            success: false,
            message: "Approval blocked: some components have not been counted",
          });
        }

        const hasShortage = items.some(
          (item) => item.status === "RED"
        );

        if (hasShortage) {
          await client.query("ROLLBACK");
          transactionStarted = false;

          return res.status(422).json({
            success: false,
            message: "Approval blocked: component shortages exist",
          });
        }
      }

      // Calculate wastage using the required formula in PostgreSQL.
      const wastageResult = await client.query(
        `SELECT ROUND(
           (
             (
               actual_fabric_yds -
               (std_fabric_yards * target_qty)
             ) /
             (std_fabric_yards * target_qty)
           ) * 100,
           2
         ) AS wastage_pct
         FROM cutting_orders co
         JOIN recipes r ON r.id = co.recipe_id
         WHERE co.id = $1
           AND (std_fabric_yards * target_qty) > 0`,
        [orderId]
      );

      if (wastageResult.rows.length === 0) {
        await client.query("ROLLBACK");
        transactionStarted = false;

        return res.status(422).json({
          success: false,
          message: "Unable to calculate fabric wastage",
        });
      }

      const wastagePct = wastageResult.rows[0].wastage_pct;

      // Preserve the expected, actual, variance and status for auditing.
      const componentVariances = items.map((item) => ({
        component_id: item.component_id,
        component_name: item.component_name,
        expected_qty: item.expected_qty,
        actual_qty: item.actual_qty,
        variance:
          item.actual_qty === null
            ? null
            : item.actual_qty - item.expected_qty,
        status: item.status,
      }));

      const newStatus =
        decision === "APPROVED" ? "VERIFIED" : "REJECTED";

      await client.query(
        `UPDATE cutting_orders
         SET status = $1,
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $2`,
        [newStatus, orderId]
      );

      await client.query(
        `INSERT INTO verification_logs (
           order_id,
           verifier_id,
           decision,
           rejection_note,
           wastage_pct,
           component_variances
         )
         VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
        [
          orderId,
          req.user.id,
          decision,
          decision === "REJECTED"
            ? rejection_note.trim()
            : null,
          wastagePct,
          JSON.stringify(componentVariances),
        ]
      );

      await client.query("COMMIT");
      transactionStarted = false;

      return res.status(200).json({
        success: true,
        message:
          decision === "APPROVED"
            ? "Cutting order approved successfully"
            : "Cutting order rejected successfully",
        order_id: orderId,
        status: newStatus,
        decision,
        wastage_pct: wastagePct,
        component_variances: componentVariances,
      });
    } catch (error) {
      if (transactionStarted) {
        await client.query("ROLLBACK");
      }

      console.error("Verification decision error:", error);

      return res.status(500).json({
        success: false,
        message: "Failed to process verification decision",
      });
    } finally {
      client.release();
    }
  }
);



module.exports = router;