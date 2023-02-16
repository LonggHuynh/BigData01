
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const argv = require('minimist')(process.argv.slice(2));
const port = 5000
const app = express()
const host = argv['host'] ||'138.197.184.163'

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `mongodb://${host}:27000/amazon_reviews?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const { insert_reviews } = require('./mysimbdp-dataingest')

app.use(bodyParser.json({ limit: '50mb' }));
app.use(cors())
app.use(express.json());




app.get('/api/products/:product_id', async (req, res) => {
  const productId = req.params.product_id;
  const collection = client.db('amazon_reviews').collection('products'); const product = await collection.findOne(
    { product_id: productId }
  );
  res.json(product);
});

app.get('/api/products/:product_id/reviews', async (req, res) => {
  const productId = req.params.product_id;
  const collection = client.db('amazon_reviews').collection('products');
  const product = await collection.findOne({ product_id: productId });
  res.json(product.reviews);
});

app.post('/api/reviews', async (req, res) => {
  const reviews = req.body
  await insert_reviews(reviews, client)
  res.end('app_reviews')
})


client.connect()
  .then(app.listen(port, () => console.log(`Server is listenning on  ${port}`)))
  .catch(err => console.log(err))
