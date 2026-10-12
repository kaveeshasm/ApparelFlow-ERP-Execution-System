
const bcrypt = require("bcrypt");

async function main() {
  const password = "ChangeMe123!";
  const hash = await bcrypt.hash(password, 12);

  console.log("Test password:", password);
  console.log("Bcrypt hash:", hash);
}

main();
