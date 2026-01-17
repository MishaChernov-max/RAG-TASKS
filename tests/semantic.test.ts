import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { VectorEngine } from "../lib/vector-engine";
import * as lancedb from "@lancedb/lancedb";
import path from "path";
import fs from "fs";
import { pipeline } from "@huggingface/transformers";

// Увеличиваем таймаут, так как нейросеть грузится не мгновенно
describe("Semantic Search Integration (Real AI)", { timeout: 30000 }, () => {
  const tempDbPath = path.join(process.cwd(), "data/test-lancedb");
  let engine: VectorEngine;

  // Тестовые данные: 3 совершенно разные темы
  const corpus = [
    {
      filePath: "space.md",
      fileContent:
        "---\ntitle: Космос\n---\nАстронавты летят на Марс используя ракету.",
    },
    {
      filePath: "food.md",
      fileContent:
        "---\ntitle: Еда\n---\nДля приготовления супа нужно вскипятить воду и нарезать овощи.",
    },
    {
      filePath: "code.md",
      fileContent:
        "---\ntitle: Программирование\n---\nФункции в JavaScript позволяют переиспользовать код.",
    },
  ];

  // 1. Создаем реальную базу перед тестами
  beforeAll(async () => {
    // Чистим папку теста, если осталась от прошлого раза
    if (fs.existsSync(tempDbPath))
      fs.rmSync(tempDbPath, { recursive: true, force: true });
    fs.mkdirSync(tempDbPath, { recursive: true });

    engine = new VectorEngine();

    // Генерируем векторы (это займет время, так как качается модель!)
    console.log("⏳ Загрузка модели и индексация...");
    const vectorData = await engine.buildVectorIndex(corpus);

    // Сохраняем в LanceDB
    const db = await lancedb.connect(tempDbPath);
    await db.createTable(
      "vectors",
      vectorData as unknown as Record<string, unknown>[]
    );
    console.log("✅ Тестовая база готова.");
  });

  // Удаляем мусор после тестов
  afterAll(() => {
    if (fs.existsSync(tempDbPath))
      fs.rmSync(tempDbPath, { recursive: true, force: true });
  });

  // --- ВСПОМОГАТЕЛЬНАЯ ФУНКЦИЯ ПОИСКА ---
  // (По сути, это то, что будет у тебя в API)
  async function search(query: string) {
    // 1. Векторизуем запрос той же нейросетью
    const extractor = await pipeline(
      "feature-extraction",
      "Xenova/multilingual-e5-small"
    );
    const output = await extractor(query, { pooling: "mean", normalize: true });
    const queryVector = Array.from(output.data);

    // 2. Ищем в базе
    const db = await lancedb.connect(tempDbPath);
    const table = await db.openTable("vectors");

    // Ищем 1 ближайшего соседа
    return await table.vectorSearch(queryVector).limit(1).toArray();
  }

  // --- СОБСТВЕННО ТЕСТЫ ---

  it("должен найти 'Космос' по запросу про 'планеты' (Слов нет в тексте)", async () => {
    // В тексте: "Астронавты летят на Марс"
    // Запрос: "Путешествие между планетами"
    // Ключевых слов нет, совпадение только по смыслу!
    const results = await search("Путешествие между планетами");

    expect(results.length).toBeGreaterThan(0);
    expect(results[0].metadata.title).toBe("Космос");
  });

  it("должен найти 'Еду' по запросу 'кулинария'", async () => {
    const results = await search("рецепт вкусного обеда");

    expect(results[0].metadata.title).toBe("Еда");
  });

  it("должен найти 'Код' по техническому вопросу", async () => {
    const results = await search("как писать скрипты");

    expect(results[0].metadata.title).toBe("Программирование");
  });
});
