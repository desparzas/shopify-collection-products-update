const express = require("express");
const {
  verifyHMAC,
  handleCollectionUpdateRequest
} = require("../controllers/webhookController");

const router = express.Router();

// Ruta para el webhook de actualización de productos
router.post("/collections/update", verifyHMAC, handleCollectionUpdateRequest);
module.exports = router;
