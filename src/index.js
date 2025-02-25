const config = require("./utils/config");
const Shopify = require("shopify-api-node");
const fs = require("fs");
const { ACCESS_TOKEN, SHOP, SHOPIFY_API_KEY, SHOPIFY_API_SECRET, SCOPES } =
  config;

// Configura Shopify API
const shopify = new Shopify({
  shopName: SHOP,
  apiKey: SHOPIFY_API_KEY,
  password: ACCESS_TOKEN,
});


// Listar las collecciones de la tienda

const listCollections = async () => {
    try {
        const collect = await shopify.collect.list();
        let collections = await shopify.collection.get(496601727251);
        console.log(collect);
        console.log(collections);
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

const getProductCollections = async (productId) => {
    try {
        const collects = await shopify.collect.list({ product_id: productId });

        console.log(collections);
    } catch (error) {
        console.error(error);
    }
}

const main = async () => {
    await listCollections();
    await listProducts();
}

main();