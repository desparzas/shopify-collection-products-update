const config = require("./utils/config");
const Shopify = require("shopify-api-node");
const fs = require("fs");
const axios = require("axios");
const { ACCESS_TOKEN, SHOP, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES } =
  config;

// Configura Shopify API
const shopify = new Shopify({
  shopName: SHOP,
  apiKey: SHOPIFY_API_KEY,
  password: ACCESS_TOKEN,
});

async function retryWithBackoff(fn, retries = 10, delay = 1000) {
  try {
    return await fn();
  } catch (error) {
    if (error.response && error.response.statusCode === 429 && retries > 0) {
      // console.log(`Rate limit hit, retrying in ${delay}ms...`);
      await new Promise((resolve) => setTimeout(resolve, delay));
      return retryWithBackoff(fn, retries - 1, delay * 2);
    } else {
      throw error;
    }
  }
}

async function processPromisesBatch(promises, batchSize = 10) {
  const results = [];
  for (let i = 0; i < promises.length; i += batchSize) {
    const batch = promises.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((promiseFn) => retryWithBackoff(promiseFn))
    );

    results.push(...batchResults);
  }
  return results;
}

// Listar las collecciones de la tienda
async function getProductsByCollection(collectionId) {
  const url = `https://${SHOP}.myshopify.com/admin/api/2024-01/collections/${collectionId}/products.json`;
  const response = await axios.get(url, {
    headers: { "X-Shopify-Access-Token": ACCESS_TOKEN }
  });
  return response.data.products;
}

// Inactivar Producto por Id
async function inactiveProductById(productId) {
  const url = `https://${SHOP}.myshopify.com/admin/api/2024-01/products/${productId}.json`;
  const response = await axios.put(url, {
    product: {
      id: productId,
      published: false
    }
  }, {
    headers: { "X-Shopify-Access-Token": ACCESS_TOKEN }
  });
  return response.data.product;
}

const listCollections = async () => {
    try {
        const collect = await shopify.collect.list();
        let collections = await shopify.collection.get(496601727251);
    } catch (error) {
        console.error(error);
    }
}

const listProducts = async () => {
    try {
        let products = await shopify.product.list();


    } catch (error) {
        console.error(error);
    }
}

getProductsByCollection("496601727251").then(console.log);

const main = async () => {
  const products = await getProductsByCollection("496601727251");
  // Inactivar los productos
  for (let product of products) {
    const inactiveProduct = await inactiveProductById(product.id);
    console.log(inactiveProduct);
  }
}

main();