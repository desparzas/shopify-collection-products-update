const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const morgan = require("morgan");
const webhookRoutes = require("./routes/webhookRoutes");

// create express app
const app = express();

// Conectar a la base de datos

// Middleware para recibir el cuerpo raw de los webhooks
app.use(morgan("dev"));
app.use(cors());
app.use(bodyParser.raw({ type: "application/json" }));

app.use((req, res, next) => {
  // Si buscas el HMAC, asumiendo que viene en los headers
  const hmac = req.headers["x-shopify-hmac-sha256"]; // Cambia según el nombre del header
  next();
});

app.use("/webhooks", webhookRoutes);

module.exports = app;
