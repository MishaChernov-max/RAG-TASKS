import { VectorEngine } from "../lib/vector-engine";
import { connect } from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { MdFiles } from "../lib/loader";

export async function buildVector(files: MdFiles[]) {
  try {
    // 1. Чистим старую базу перед новой сборкой (чтобы не дублировать)
    const dbDir = path.join(process.cwd(), "data/lancedb");
    if (fs.existsSync(dbDir)) {
      fs.rmSync(dbDir, { recursive: true, force: true });
    }

    // 2. Создаем папку для БД
    fs.mkdirSync(dbDir, { recursive: true });

    // 3. Генерируем векторы (Твой код)
    const engine = new VectorEngine();

    const vectorData = await engine.buildVectorIndex(files);

    // 4. Инициализируем LanceDB
    console.log("💾 Сохранение в LanceDB...");
    const db = await connect(dbDir);

    // 5. Создаем таблицу
    // LanceDB сам поймет схему данных из твоего массива vectorData!
    // vectorData выглядит как [{ text, metadata, vector, id }, ...]
    const table = await db.createTable(
      "vectors",
      vectorData as unknown as Record<string, unknown>[]
    );
  } catch (e) {
    console.error("Ошибка:", e);
  }
}
