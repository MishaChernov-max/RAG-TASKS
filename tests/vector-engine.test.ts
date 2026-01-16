import { describe, it, expect, beforeEach } from "@jest/globals";
import { VectorEngine } from "../lib/vector-engine";
import { pipeline } from "@huggingface/transformers";

// 1. Мокаем библиотеку
jest.mock("@huggingface/transformers", () => ({
  pipeline: jest.fn(),
}));

// 2. РЕШЕНИЕ: Принудительно упрощаем тип через unknown
const mockedPipeline = pipeline as unknown as jest.MockedFunction<any>;

describe("VectorEngine: Types Fix", () => {
  let engine: VectorEngine;

  // 3. Мок для экстрактора (той функции, которую вернет pipeline)
  const mockExtractor = jest.fn() as jest.MockedFunction<any>;

  beforeEach(() => {
    jest.clearAllMocks();
    engine = new VectorEngine();

    // Настраиваем цепочку: pipeline() -> возвращает mockExtractor
    mockedPipeline.mockResolvedValue(mockExtractor);

    // Настраиваем результат работы экстрактора (вектор)
    mockExtractor.mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3]),
    });
  });

  it("должен корректно очищать текст", () => {
    const raw = ":::info\nТест\n:::";
    const clean = engine.getCleanText(raw);
    expect(clean).toBe("Тест");
  });

  it("buildVectorIndex должен работать без ошибок типов", async () => {
    const files = [
      {
        filePath: "f.md",
        fileContent: "---\ntitle: Тест\n---\nконтент",
      },
    ];

    const result = await engine.buildVectorIndex(files);

    expect(result.length).toBeGreaterThan(0);
    // Сравниваем массив с результатом мока
    expect(Array.from(result[0].vector!)).toEqual([0.1, 0.2, 0.3]);
  });
});
