const express = require("express");
const router = express.Router();
const cors = require('cors');
const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("./middleware/auth.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

//* API ROUTES
const userRoutes = require("./routes/userRoutes");
app.use("/api/auth", userRoutes);

const host = "0.0.0.0";
app.listen(PORT, host, () => {
  console.log(` → Servidor corriendo en:`);
  console.log(`    • http://localhost:${PORT}`);
});
