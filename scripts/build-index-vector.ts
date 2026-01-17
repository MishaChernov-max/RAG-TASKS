import { VectorEngine } from "../lib/vector-engine";
import { connect } from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { MdFiles } from "../lib/loader";

export async function buildVector(files: MdFiles[]) {
  try {
    const dbDir = path.join(process.cwd(), "data/lancedb");

    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }
    fs.mkdirSync(dbDir, { recursive: true });

    const engine = new VectorEngine();

    const rawDocs = await engine.buildVectorIndex(files);

    const flatData = rawDocs.map((doc) => ({
      text: doc.pageContent,
      vector: doc.metadata.vector!,
      source: doc.metadata.source,
      title: doc.metadata.title,
      chunkIndex: doc.metadata.chunkIndex ?? 0,
    }));

    const db = await connect(dbDir);

    const table = await db.createTable("vectors", flatData);

    console.log(`Готово! Сохранено ${flatData.length} векторов.`);
  } catch (e) {
    console.error("Критическая ошибка при сборке базы:", e);
  }
}
