import { DataAPIClient } from "@datastax/astra-db-ts";
import { streamText } from "ai";
import { openai } from "@ai-sdk/openai";
import OpenAI from "openai";
const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPENAI_API_KEY, // ✅ Ensure OpenAI API key is set
} = process.env;


 // ✅ Initialize OpenAI with the API key
if (!ASTRA_DB_NAMESPACE || !ASTRA_DB_COLLECTION || !ASTRA_DB_API_ENDPOINT || !ASTRA_DB_APPLICATION_TOKEN || !OPENAI_API_KEY) {
  throw new Error("❌ Missing required environment variables!");
}
const openaiembed = new OpenAI({apiKey: OPENAI_API_KEY});
const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT, { namespace: ASTRA_DB_NAMESPACE });

export async function POST(req: Request) {
  try {
    console.log("📩 Received request...");

    const { messages } = await req.json();
    console.log("📝 Parsed messages:", messages);

    if (!messages || messages.length === 0) {
      throw new Error("❌ No messages found in the request!");
    }

    const latestMessage = messages[messages.length - 1]?.content;
    let docContext = "";

   const embedding = await openaiembed.embeddings.create({

      model: "text-embedding-3-small",
      input: latestMessage,
      encoding_format: "float",
   })

    // 🔍 Query Astra DB for relevant documents
    try {
      console.log("🔍 Querying Astra DB...");
      const collection = await db.collection(ASTRA_DB_COLLECTION);
      const cursor = collection.find(null, {
        sort: {
           $vector: embedding.data[0].embedding },
        limit: 10,
      });

      const documents = await cursor.toArray();
      const docsmap = documents?.map((doc) => doc.text);
      docContext = JSON.stringify(docsmap);

      console.log("✅ Fetched relevant documents from Astra DB.");
    } catch (error) {
      console.error("❌ Error querying Astra DB:", error);
      docContext = "";
    }

    // 📜 Define the system prompt template
    const template = {
      role: "system",
      content: `You are an AI assistant who knows everything about creating roadmaps. Use the below
      context to augment what you know about creating roadmaps. If the context does not include the information
      you need, answer based on your existing knowledge and do not mention the source of your information or 
      what the context does or does not include.
      Format responses using markdown where applicable and do not return images.
      ---------------
      START CONTEXT 
      ${docContext}
      END CONTEXT
      ---------------
      QUESTION: ${latestMessage}
      ---------------`,
    };

    console.log("🧠 Preparing OpenAI response...");

    // ✅ OpenAI streaming response
    const { textStream } = await streamText({
      model: openai("gpt-4"),
      messages: [template, ...messages],
    });

    console.log("✅ Successfully generated response!");

    // ✅ Return proper streaming response
    return new Response(textStream, {
      headers: { "Content-Type": "text/event-stream" },
    });

  } catch (err) {
    console.error("❌ Internal Server Error:", err);
    return new Response(`Internal Server Error: ${err.message}`, { status: 500 });
  }
}
