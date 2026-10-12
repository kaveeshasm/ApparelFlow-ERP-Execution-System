const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const pool = require("../db");

const {
  authenticateToken,
  authorizeRoles,
} = require("../middleware/authMiddleware");

const router = express.Router();


// ==================== LOGIN ====================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required",
      });
    }

    const result = await pool.query(
      `SELECT id, email, password_hash, role, full_name
       FROM users
       WHERE email = $1`,
      [email.trim().toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const user = result.rows[0];

    const passwordMatches = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        role: user.role,
      },
      process.env.JWT_SECRET,
      {
        expiresIn: "1h",
      }
    );

    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });

    return res.json({
      success: true,
      message: "Login successful",
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        role: user.role,
      },
    });

  } catch (error) {
    console.error("Login error:", error.message);

    return res.status(500).json({
      success: false,
      message: "An internal server error occurred",
    });
  }
});


// ==================== PROTECTED TEST ROUTE ====================

router.get(
  "/protected",
  authenticateToken,
  (req, res) => {
    res.json({
      success: true,
      message: "You are authenticated",
      user: req.user,
    });
  }
);


// ==================== CUTTING SUPERVISOR ====================

router.get(
  "/cutting-supervisor",
  authenticateToken,
  authorizeRoles("cutting_supervisor"),
  (req, res) => {
    res.json({
      success: true,
      message: "Cutting Supervisor access granted",
      user: req.user,
    });
  }
);


// ==================== CUTTING VERIFIER ====================

router.get(
  "/cutting-verifier",
  authenticateToken,
  authorizeRoles("cutting_verifier"),
  (req, res) => {
    res.json({
      success: true,
      message: "Cutting Verifier access granted",
      user: req.user,
    });
  }
);


// ==================== SEWING SUPERVISOR ====================

router.get(
  "/sewing-supervisor",
  authenticateToken,
  authorizeRoles("sewing_supervisor"),
  (req, res) => {
    res.json({
      success: true,
      message: "Sewing Supervisor access granted",
      user: req.user,
    });
  }
);


module.exports = router;