import express from "express";
import { MilvusClient, ConsistencyLevelEnum } from "@zilliz/milvus2-sdk-node";
import { config } from "./config.serverless.js";
import { isVersionAtLeast } from "./utils";
import fs from "fs";
import path from "path";

const data = JSON.parse(
  fs.readFileSync(path.join(__dirname, "public/artichaut.json"), "utf8")
);

const VECTOR_TEST = data.embedding;
const PATH_TEST = data.path;
const COLLECTION_NAME = "embeddings_512";

const app = express();
const port = 3000;
app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.json());
app.use(express.static("public"));

if (!isVersionAtLeast("2.2.17", MilvusClient.sdkInfo.version)) {
  console.warn(
    `Please upgrade your node sdk version, it should >= 2.2.17, your version is ${MilvusClient.sdkInfo.version}`
  );
  process.exit();
}

const { uri, token } = config;
console.log(uri, token);
console.info(`Connecting to DB: ${uri}`);
const client = new MilvusClient({
  address: uri,
  token: token,
});
console.info(`Success!`);

app.get("/", (req, res) => {
  res.render("index", { COLLECTION_NAME, PATH_TEST, VECTOR_TEST });
});

app.post("/query", async (req, res) => {
  console.log(req.body.path);
  console.log("thisis the pathtest", PATH_TEST)
  try {
   console.time('Query time');
   const queryResults = await client.query({
     collection_name: COLLECTION_NAME,
     filter: `path == "${PATH_TEST}"`,
     output_fields: ['embedding'],
     limit: 1,
   });
   console.timeEnd('Query time');
   console.log('test02', queryResults.data[0].embedding);
   const mini_embedding = queryResults.data[0].embedding.slice(0, 5);

   if (queryResults.data && queryResults.data.length > 0) {
     const paths = [
      mini_embedding,
     ];
     res.json({ paths }); // Send the paths to the client
   } else {
     res.json({ message: "No results found" });
   }
  } catch (error) {
   console.error(error);
   res.status(500).send('An error occurred');
  }
 });

app.post("/search", async (req, res) => {
  console.log(req.body.path);
  const vector = req.body.vector;

  try {
    console.time(`Searching vector`);
    const search_params = {
      metric_type: "L2",
      offset: 0,
      ignore_growing: false,
      params: { nprobe: 50 },
    };
    const searchResults = await client.search({
      collection_name: COLLECTION_NAME,
      vector: VECTOR_TEST,
      output_fields: ["path", "embedding"],
      limit: 4,
    });
    console.timeEnd(`Searching vector`);
    if (searchResults.results && searchResults.results.length >= 3) {
      const paths = [
        searchResults.results[1].path,
        searchResults.results[2].path,
        searchResults.results[3].path,
      ];
      res.json({ paths });
    } else {
      res.json({ message: "Not enough search results" });
    }
  } catch (error) {
    console.error(error);
    res.status(500).send("An error occurred");
  }
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
