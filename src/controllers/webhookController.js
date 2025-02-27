const config = require("../utils/config");
const crypto = require("crypto");
const shopifyService = require("../services/shopifyService");
const processedCollections = new Set();

let processing = false;
const queue = [];

// Middleware para validar el HMAC
function verifyHMAC(req, res, next) {
  const hmac = req.headers["x-shopify-hmac-sha256"];
  const hash = crypto
    .createHmac("sha256", config.WEBHOOK_SECRET)
    .update(req.body, "utf8", "hex")
    .digest("base64");

  if (hash !== hmac) {
    return res.status(401).send("Unauthorized");
  }

  next();
}

async function processQueue() {
  if (processing || queue.length === 0) {
    return;
  }

  processing = true;

  const { req, res } = queue.shift();

  try {
    // Procesa la petición aquí, llamando a handleCollectionUpdate
    await handleCollectionUpdate(req, res);
  } catch (error) {
    console.error("Error processing webhook:", error);
    res.status(500).send("Internal Server Error");
  }

  processing = false;
  processQueue(); // Procesa la siguiente petición en la cola
}

// Endpoint para recibir el webhook
async function handleCollectionUpdate(req, res) {
  try {
    const collectionData = JSON.parse(req.body);
    // ESCRIBIR LO RECIBIDO EN EL WEBHOOK
    console.log(JSON.stringify(collectionData, null, 2));

    console.log(
      "Processing webhook fro collection",
      collectionData.id,
      "-",
      collectionData.title
    );
    // if (processedCollections.has(collectionData.id)) {
    //   return res.status(200).send("Evento ya procesado recientemente.");
    // }

    // processedCollections.add(collectionData.id);
    // setTimeout(() => processedCollections.delete(collectionData.id), 120000);

    shopifyService.handleCollectionUp(collectionData).catch(error => {
      console.error("Error en handleCollectionUp:", error);
    });

    return res.status(200).send("Webhook recibido");
  } catch (error) {
    console.error("Error handling collection update webhook:", error);
    return res.status(500).send("Internal Server Error");
  }
}

async function handleCollectionUpdateRequest(req, res) {
  queue.push({ req, res });
  processQueue();
}

module.exports = {
  verifyHMAC,
  handleCollectionUpdateRequest,
};
