import fs from "fs";
import { getMarkdown } from "../lib/loader";
import { BM25Search } from "../lib/search-engine";
import path from "path";
import { buildVector } from "./build-index-vector";

(async () => {
  try {
    const files = getMarkdown();
    const searchEngine = new BM25Search(files);
    const dataToSave = JSON.stringify(searchEngine);
    const pathToIndex = path.join(process.cwd(), "search-index.json");
    fs.writeFileSync(pathToIndex, dataToSave, "utf8");
    await buildVector(files);
  } catch (e) {
    console.error("Возникла ошибка:" + e);
    process.exit(1);
  }
})();
