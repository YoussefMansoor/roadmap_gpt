import {DataAPIClient} from "@datastax/astra-db-ts"
import {PuppeteerWebBaseLoader} from "langchain/document_loaders/web/puppeteer"
import OpenAI from "openai"
import "dotenv/config"
import {RecursiveCharacterTextSplitter} from "langchain/text_splitter"
import { GoogleGenerativeAI } from "@google/generative-ai";

type SimilarityMetric = "dot_product" | "cosine" | "euclidean"
const {ASTRA_DB_NAMESPACE, 
    ASTRA_DB_COLLECTION, 
    ASTRA_DB_API_ENDPOINT, 
    ASTRA_DB_APPLICATION_TOKEN, 
    OPENAI_API_KEY,
GEMINI_API_KEY} = process.env

const openai = new OpenAI({apiKey:OPENAI_API_KEY })
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);

const rmData = ['https://www.freecodecamp.org/news/how-to-become-a-software-engineer-2023-roadmap/']

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN)
const db = client.db(ASTRA_DB_API_ENDPOINT, {namespace:ASTRA_DB_NAMESPACE })
const splitter = new RecursiveCharacterTextSplitter({
    chunkSize:512,
    chunkOverlap:100
})
const createCollection = async (similarityMetric: SimilarityMetric= "dot_product") => {
    const res = await db.createCollection(ASTRA_DB_COLLECTION,{
        vector: {
            dimension: 1536,
            metric: similarityMetric
        }
    })
    console.log(res)
}



function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function generateContentWithRetry(chunk, retries = 5, delayMs = 2000) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const response = await model.generateContent(chunk);
            return response.response.text();
        } catch (error) {
            console.error(`Attempt ${attempt} failed:`, error);

            if (attempt === retries) {
                throw error; // Give up after max retries
            }

            // Wait before retrying (exponential backoff)
            await delay(delayMs * attempt);
        }
    }
}

const loadSampleData = async () => {
    const collection = await db.collection(ASTRA_DB_COLLECTION);

    for await (const url of rmData) {
        const content = await scrapePage(url);
        const chunks = await splitter.splitText(content);

        for await (const chunk of chunks) {
            try {
                const textEmbedding = await generateContentWithRetry(chunk);
                const res = await collection.insertOne({ text: textEmbedding });
                console.log(res);
            } catch (error) {
                console.error("Final attempt failed:", error);
            }
        }
    }
};

const scrapePage = async (url:string)=> {
    const loader = new PuppeteerWebBaseLoader(url,{
        launchOptions:{
            headless: true
        },
        gotoOptions:{
            waitUntil: "domcontentloaded"
        },
        evaluate:async (page,browser) => {
            const result = await page.evaluate(()=> document.body.innerHTML)
            await browser.close()
            return result
        }
    })
    return (await loader.scrape())?.replace(/<[^>]*>?/gm, '')
}

createCollection().then(()=> loadSampleData())

