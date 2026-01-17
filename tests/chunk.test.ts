import { describe, it, expect, vi, beforeEach } from "vitest";
import { pipeline } from "@huggingface/transformers";
import { VectorEngine } from "@/lib/vector-engine"; // Проверьте путь

vi.mock("@huggingface/transformers", () => ({
  pipeline: vi.fn(),
}));

describe("VectorEngine Integration", () => {
  let engine: VectorEngine;
  const EMBEDDING_SIZE = 384;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new VectorEngine();
    // Хак для тестов: уменьшаем размер чанка
    (engine as any).splitter.chunkSize = 50;
    (engine as any).splitter.chunkOverlap = 10;
  });

  it("должен корректно резать текст и формировать метаданные", async () => {
    const shortContent =
      "Это первое длинное предложение для теста. А это второе.";
    const mockFile = {
      filePath: "test-folder/doc.md",
      fileContent: `---\ntitle: AI Test\n---\n${shortContent}`,
    };

    // Мок ответа модели
    const mockOutputData = new Float32Array(EMBEDDING_SIZE * 2).fill(0.1);
    const mockExtractor = vi.fn().mockResolvedValue({ data: mockOutputData });
    (pipeline as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockExtractor,
    );

    const result = await engine.buildVectorIndex([mockFile]);

    expect(result.length).toBe(2);

    const firstChunk = result[0];

    // ПРАВКА 1: Используем objectContaining, чтобы игнорировать поле 'loc'
    expect(firstChunk.metadata).toEqual(
      expect.objectContaining({
        source: "test-folder/doc.md",
        title: "AI Test",
        chunkIndex: 0,
      }),
    );

    // Проверка вектора
    expect(firstChunk.metadata.vector).toHaveLength(EMBEDDING_SIZE);
  });

  it("не должен падать на битых файлах (Error Handling)", async () => {
    // ПРАВКА 2: Более надежный мок ошибки
    const mockExtractor = vi.fn();

    // При первом вызове (bad.md) кидаем ошибку
    mockExtractor.mockRejectedValueOnce(new Error("Test Error"));
    // При втором вызове (good.md) возвращаем данные
    mockExtractor.mockResolvedValue({
      data: new Float32Array(EMBEDDING_SIZE).fill(0.1),
    });

    (pipeline as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(
      mockExtractor,
    );

    const files = [
      { filePath: "bad.md", fileContent: "bad" }, // Этот упадет
      { filePath: "good.md", fileContent: "---\ntitle: Ok\n---\nGood" }, // Этот пройдет
    ];

    // Вызываем метод. Он НЕ должен выкинуть исключение, так как внутри есть try/catch
    const result = await engine.buildVectorIndex(files);

    // Должен обработаться только 1 файл (good.md)
    expect(result.length).toBe(1);
    expect(result[0].metadata.title).toBe("Ok");
  });
});
