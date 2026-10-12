require("dotenv").config();

const app = require("./app");

const PORT = process.env.PORT || 9090;

if (process.env.NODE_ENV !== 'production') {
  app.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
  });
}

module.exports = app;