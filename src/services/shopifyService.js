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

    url = nextPageUrl;
  } while (url);

  return allProducts;
}

async function getCollectionsFromProduct(productId) {
  let collections = [];
  const response = await shopify.collect.list({
    product_id: productId,
  });

  const collectionPromises = response.map((collect) => {
    return () => shopify.collection.get(collect.collection_id);
  });

  const c = await processPromisesBatch(collectionPromises, 10);

  return {
    id: productId,
    collections: c,
  };
}

function getNextPageUrl(linkHeader) {
  if (!linkHeader) return null;

  const match = linkHeader.match(/<(.*?)>; rel="next"/);
  return match ? match[1] : null;
}

async function updateProduct(productId, data) {
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
  let updateParams = {};

  const productCollectionsPromises = products.map((product) => {
    return () => getCollectionsFromProduct(product.id);
  });

  const productCollections = await processPromisesBatch(
    productCollectionsPromises,
    10
  );

  products = products.map((product) => {
    const productCollectionsData = productCollections.find(
      (pc) => pc.id === product.id
    );

    productCollectionsData.activeCollections =
      productCollectionsData.collections.filter(
        (collection) =>
          collection.id !== collectionId && collection.published_at
      );

    product.activeCollections = productCollectionsData.activeCollections;
    return product;
  });


  if (publishedAt) {
    console.log("The collection is activated");
    products = products.filter((product) => !product.published_at && product.status === 'active');
    updateParams = { published: true };
  } else {
    console.log("The collection is inactived");
    products = products.filter(
      (product) =>
        product.published_at && product.activeCollections.length === 0 && product.status === 'active'
    );
    updateParams = { published: false };
  }

  console.log("Updating product from collection: ", collectionData.title);
  console.log("Products: ", products.length);

  const productDeletePromises = products.map((product) => {
    return () => updateProduct(product.id, updateParams);
  });
  await processPromisesBatch(productDeletePromises, 10);

  console.log("All products updated");
};

module.exports = {
  getProductsByCollection,
  updateProduct,
  handleCollectionUp,
};
