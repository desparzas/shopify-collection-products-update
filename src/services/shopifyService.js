const config = require("../utils/config");
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

async function retryWithBackoff(fn, retries = 10, delay = 2000) {
  try {
    return await fn();
  } catch (error) {
    if (retries > 0) {
      console.log(`Rate limit hit, retrying in ${delay}ms...`);
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

async function getProductsByCollection(collectionId) {
  let allProducts = [];
  let url = `https://${SHOP}.myshopify.com/admin/api/2024-01/collections/${collectionId}/products.json?limit=250`;

  do {
    const response = await axios.get(url, {
      headers: { "X-Shopify-Access-Token": ACCESS_TOKEN },
    });

    allProducts = allProducts.concat(response.data.products);

    const linkHeader = response.headers["link"];
    const nextPageUrl = getNextPageUrl(linkHeader);
    console.log(nextPageUrl);

    url = nextPageUrl;
  } while (url);

  return allProducts;
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  const match = linkHeader.match(/<(.*?)>; rel="next"/);
  return match ? match[1] : null;
}

async function updateProduct(productId, data) {
  console.log("Updating product: ", productId);
  const url = `https://${SHOP}.myshopify.com/admin/api/2024-01/products/${productId}.json`;
  const response = await axios.put(
    url,
    {
      product: {
        id: productId,
        ...data
      },
    },
    {
      headers: { "X-Shopify-Access-Token": ACCESS_TOKEN },
    }
  );
  console.log("Updated product: ", productId);
  return response.data.product;
}

const handleCollectionUp = async (collectionData) => {
  const collectionId = collectionData.id;
  const publishedAt = collectionData.published_at;

  let products = await getProductsByCollection(collectionId);
  console.log("Productos de la colección", collectionId);
  console.log(products.length);
  console.log(products);
  let updateParams = {};

  if (publishedAt) {
    console.log("La colección está publicada");
    products = products.filter((product) => !product.published_at);
    updateParams = { published: true };
  } else {
    console.log("La colección está inactiva");
    products = products.filter((product) => product.published_at);
    updateParams = { published: false };
  }

  console.log("Inactivando productos de la colección", collectionId);
  console.log(products.length);


  const productDeletePromises = products.map((product) => {
    return () => updateProduct(product.id, updateParams);
  });
  await processPromisesBatch(productDeletePromises, 10);

};

module.exports = {
  getProductsByCollection,
  updateProduct,
  handleCollectionUp,
};
