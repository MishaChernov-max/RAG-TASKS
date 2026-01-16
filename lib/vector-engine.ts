import markdownToTxt from "markdown-to-txt";
import { MdFiles } from "./loader";
import matter from "gray-matter";
import {
  pipeline,
  type FeatureExtractionPipeline,
} from "@huggingface/transformers";

type Metadata = {
  source: string;
  title: string;
  chunkIndex: number;
};

interface Chunk {
  text: string;
  metadata: Metadata;
  vector?: number[];
}

export class VectorEngine {
  // 1. ОБЯЗАТЕЛЬНО объявляем свойства класса
  private extractor: FeatureExtractionPipeline | null = null;
  public allChunks: Chunk[] = [];

  constructor() {}

  // 2. Инициализация модели (Singleton паттерн)
  private async getExtractor() {
    if (!this.extractor) {
      const pipe = await pipeline(
        "feature-extraction",
        "Xenova/multilingual-e5-small"
      );

      this.extractor = pipe as FeatureExtractionPipeline;
    }
    return this.extractor;
  }

  private chanking(text: string, filePath: string, title: string) {
    const chunks: Chunk[] = [];
    let chunk: string[] = [];
    const LIMIT = 200;
    const OVERLAP = 40;

    const array = text.split(/\s+/);

    for (let index = 0; index < array.length; index++) {
      const word = array[index];
      if (chunk.length >= LIMIT) {
        const start = chunk.length - OVERLAP;
        const endOfChunk = chunk.slice(start, chunk.length);

        chunks.push({
          text: chunk.join(" "),
          metadata: {
            source: filePath,
            title,
            chunkIndex: chunks.length, // ИСПРАВЛЕНО: Индекс куска, а не файла
          },
        });

        chunk = [...endOfChunk, word];
      } else {
        chunk.push(word);
      }
    }

    if (chunk.length > 0) {
      chunks.push({
        text: chunk.join(" "),
        metadata: {
          source: filePath,
          title,
          chunkIndex: chunks.length,
        },
      });
    }
    return chunks;
  }

  async buildVectorIndex(rawdata: MdFiles[]) {
    const extractor = await this.getExtractor();

    this.allChunks = [];

    for (const { filePath, fileContent } of rawdata) {
      const { data, content } = matter(fileContent);

      const docTitle = (data.title as string) || "Без названия";
      const cleanText = this.getCleanText(content);

      const fullText = `${docTitle}. ${cleanText}`;

      const fileChunks = this.chanking(fullText, filePath, docTitle);

      for (const chunk of fileChunks) {
        const output = await extractor(chunk.text, {
          pooling: "mean",
          normalize: true,
        });

        chunk.vector = Array.from(output.data) as number[];

        this.allChunks.push(chunk);
      }
    }

    return this.allChunks;
  }

  getCleanText(rawContent: string): string {
    let text = rawContent || ""; // Защита от null

    text = text.replace(/```[\s\S]*?```/g, "");
    text = text.replace(/^---[\s\S]*?---/g, "");
    text = text.replace(/{%[\s\S]*?%}/g, "");
    text = text.replace(/{[\s\S]*?}/g, "");
    text = text.replace(/:::[^\s]*/g, "");
    text = markdownToTxt(text);
    text = text.replace(/&[a-z0-9#]+;/gi, " ");

    return text.replace(/\\/g, "").replace(/\s+/g, " ").trim();
  }
}
