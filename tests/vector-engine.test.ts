import { describe, it, expect, beforeEach, vi } from "vitest"; // 1. Добавили vi в импорт
import { VectorEngine } from "../lib/vector-engine";
import { pipeline } from "@huggingface/transformers";

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
}));

const mockedPipeline = pipeline as unknown as ReturnType<typeof vi.fn>;

describe("VectorEngine: Vitest Fix", () => {
  let engine: VectorEngine;

  const mockExtractor = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new VectorEngine();

    mockedPipeline.mockResolvedValue(mockExtractor);

    mockExtractor.mockResolvedValue({
      data: new Float32Array([0.1, 0.2, 0.3]),
    });
  });

  it("должен корректно очищать текст", () => {
    const raw = ":::info\nТест\n:::";
    const clean = engine.getCleanText(raw);
    expect(clean).toBe("Тест");
  });

  it("buildVectorIndex должен работать", async () => {
    const files = [
      {
        filePath: "f.md",
        fileContent: "---\ntitle: Тест\n---\nконтент",
      },
    ];

    const result = await engine.buildVectorIndex(files);

    expect(result.length).toBeGreaterThan(0);

    // ИСПРАВЛЕНИЕ:
    // Мы превращаем наши ожидаемые числа тоже в Float32, чтобы сравнение было корректным
    const expectedVector = Array.from(new Float32Array([0.1, 0.2, 0.3]));

    expect(Array.from(result[0].metadata.vector!)).toEqual(expectedVector);
  });
});
