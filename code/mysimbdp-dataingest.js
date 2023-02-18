const csv = require('csvtojson');
const lineReader = require('line-reader');
const argv = require('minimist')(process.argv.slice(2));



const write_concern = argv['w'] || 'majority'
const num_workers = argv['num_workers']
const num_reviews_per_worker = argv['num_reviews_per_worker']
const offset = argv['offset'] === undefined ? 0 : argv['offset']

const host = argv['host'] || 'mongodb://138.197.184.163'

const { MongoClient, ServerApiVersion } = require('mongodb');
const uri = `${host}:27000/amazon_reviews?retryWrites=true&w=${write_concern}`;
const file_path = '../data/data.tsv'




async function insert_reviews(reviews, client) {
    const collection = client.db(client.name).collection('products')
    const session = client.startSession()
    try {
        await session.withTransaction(async () => {
            const productReviewMap = new Map();
            reviews.forEach(review => {
                if (!productReviewMap.get(review.product_id)) {
                    productReviewMap.set(review.product_id, [])
                }

                productReviewMap.get(review.product_id).push(review)
            });

            for (let [product_id, product_reviews] of productReviewMap) {
                const existingProduct = await collection.findOne({ product_id })
                if (existingProduct) {
                    await collection.updateOne({ product_id }, { $push: { reviews: { $each: product_reviews } } })
                } else {
                    const newProduct = {
                        product_id,
                        customer_id: product_reviews[0].customer_id,
                        product_title: product_reviews[0].product_title,
                        product_category: product_reviews[0].product_category,
                        reviews: product_reviews.map(({ review_id, review_body, review_date, star_rating }) => ({ review_id, review_body, review_date, star_rating }))
                    };
                    await collection.insertOne(newProduct)
                }
            }
        })
    } catch (error) {
        throw error;
    } finally {
        session.endSession();
    }
}


const reviews_from_file = async (filePath, from_line, to_line) => {
    let lineCount = 0;
    let lines = []
    await new Promise((resolve) => {
        lineReader.eachLine(filePath, (line, last) => {
            if (lineCount === 0 || lineCount >= from_line && lineCount <= to_line) {
                lines.push(line)
            }
            lineCount++;
            if (last)
                resolve()
        });
    })
    return await csv({ delimiter: '\t' }).fromString(lines.join('\n'));
}


const ingest_no_daas = async (file_path, from_line, to_line, client) => {


    const reviews = await reviews_from_file(file_path, from_line, to_line)


    const start = Date.now();
    await insert_reviews(reviews, client)
    console.log(`Write (no-daas) ${num_reviews_per_worker} reviews in ${Date.now() - start} seconds (${num_workers} concurrent transactions)`)

}


const ingest_daas = async (file_path, from_line, to_line) => {
    const reviews = await reviews_from_file(file_path, from_line, to_line)

    const start = Date.now();

    await fetch('http://138.197.184.163:5000/api/reviews', {
        headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }, method: 'POST', body: JSON.stringify(reviews)
    })

    console.log(`Write (daas) ${num_reviews_per_worker} reviews in ${Date.now() - start} seconds (${num_workers} concurrent transactions)`)
}



const add_no_daas = async (num_workers, num_reviews_per_worker, offset) => {
    const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
    client.connect().then(async () => {
        await Promise.all(Array.from(Array(num_workers).keys()).map(
            async (_, ind) => { await ingest_no_daas(file_path, offset + ind * num_reviews_per_worker + 1, offset + ind * num_reviews_per_worker + num_reviews_per_worker, client) }
        ))
    }).then(() => { client.close() })
}

const add_daas = async (num_workers, num_reviews_per_worker, offset) => {
    await Promise.all(Array.from(Array(num_workers).keys()).map(
        async (_, ind) => { await ingest_daas(file_path, offset + ind * num_reviews_per_worker + 1, offset + ind * num_reviews_per_worker + num_reviews_per_worker) }
    ))
}




if (argv['d']) add_daas(num_workers, num_reviews_per_worker, offset)
else add_no_daas(num_workers, num_reviews_per_worker, offset)



module.exports = { insert_reviews }