
const express = require("express");
const router = express.Router();

const pool = require("../db");
const { authenticateToken } = require("../middleware/authMiddleware");

// GET /recipes
router.get("/", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        r.id,
        r.recipe_code,
        r.name,
        r.category,
        r.std_fabric_yards,
        r.wastage_cap,
        COALESCE(
          json_agg(
            json_build_object(
              'id', rc.id,
              'component_name', rc.component_name,
              'pieces_per_garment', rc.pieces_per_garment,
              'image_url', rc.image_url
            )
          ) FILTER (WHERE rc.id IS NOT NULL),
          '[]'::json
        ) AS components
      FROM recipes r
      LEFT JOIN recipe_components rc
        ON r.id = rc.recipe_id
      GROUP BY
        r.id,
        r.recipe_code,
        r.name,
        r.category,
        r.std_fabric_yards,
        r.wastage_cap
      ORDER BY r.id;
    `);

    return res.status(200).json({
      success: true,
      count: result.rows.length,
      recipes: result.rows,
    });
  } catch (error) {
    console.error("Error fetching recipes:", error);

    return res.status(500).json({
      success: false,
      message: "Failed to retrieve recipes",
    });
  }
});

module.exports = router;
