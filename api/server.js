const express = require("express");
const cors = require('cors');
const os = require('os');
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

function getLocalIPv4() {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name]) {
      // Solo IPv4 y no internas (loopback)
      if (net.family === 'IPv4' && !net.internal) {
        return net.address;
      }
    }
  }
  return '0.0.0.0';
}


const host = "0.0.0.0";
app.listen(PORT, host, () => {
  const localIP = getLocalIPv4();
  console.log(` → Servidor corriendo en:`);
  console.log(`    • http://localhost:${PORT}`);
  console.log(`    • http://${localIP}:${PORT}`);
});