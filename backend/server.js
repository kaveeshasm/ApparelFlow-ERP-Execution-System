
require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");

const app = express();

app.use(
  cors({
    origin: ["http://localhost:3000", "http://localhost:3001"],
    credentials: true,
  })
);

app.use(express.json());
app.use(cookieParser());

app.get("/test", (req, res) => {
  res.json({
    success: true,
    message: "Backend connected successfully",
  });
});

app.use("/", require("./routes/authRoutes"));
app.use("/recipes", require("./routes/recipeRoutes"));
app.use("/recipes", require("./routes/recipeRoutes"));

app.use(
  "/cutting-orders",
  require("./routes/cuttingOrderRoutes")
);

app.use(
  "/verification",
  require("./routes/verificationRoutes")
);

app.use("/sewing-queue", require("./routes/sewingQueueRoutes"));

const PORT = process.env.PORT || 9090;

app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
});
