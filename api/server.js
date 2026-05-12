const express = require("express");
const cors = require('cors');
const { JWT_SECRET } = require("./middleware/auth.js");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cors());

//* API ROUTES
const userRoutes = require("./routes/userRoutes");
app.use("/api/auth", userRoutes);

const dataRoutes = require("./routes/dataRoutes");
app.use("/api/data", dataRoutes);

const host = "0.0.0.0";
app.listen(PORT, host, () => {
  console.log(` → Servidor corriendo en:`);
  console.log(`    • http://localhost:${PORT}`);
});