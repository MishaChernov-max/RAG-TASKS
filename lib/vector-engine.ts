import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { Document } from "@langchain/core/documents";
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
  chunkIndex?: number;
  vector?: number[];
};

export class VectorEngine {
  // 1. ОБЯЗАТЕЛЬНО объявляем свойства класса
  private extractor: FeatureExtractionPipeline | null = null;
  public allChunks: Document<Metadata>[] = [];
  private splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 500,
    chunkOverlap: 100,
    separators: ["\n\n", "\n", ". ", "! ", "? ", " ", ""],
  });
  private embeddingSize = 384;

  constructor() {}

  // 2. Инициализация модели (Singleton паттерн)
  private async getExtractor() {
    if (!this.extractor) {
      const pipe = await pipeline(
        "feature-extraction",
        "Xenova/multilingual-e5-small",
      );

      this.extractor = pipe;
    }
    return this.extractor;
  }

  private async chunking(fullText: string, metadata: Metadata[]) {
    return await this.splitter.createDocuments([fullText], metadata);
  }

  async buildVectorIndex(rawdata: MdFiles[]) {
    this.allChunks = [];
    const extractor = await this.getExtractor();
    for (const { filePath, fileContent } of rawdata) {
      const { data, content } = matter(fileContent);
      const cleanText = this.getCleanText(content);
      const fullText = `${data.title || "Untitled"}. ${cleanText}`;
      const metaData = { source: filePath, title: data.title };
      const chunks = await this.chunking(fullText, [metaData]);
      const chunkTexts = chunks.map((chunk) => chunk.pageContent);
      const output = await extractor(chunkTexts, {
        pooling: "mean",
        normalize: true,
      });
      for (let index = 0; index < chunks.length; index++) {
        const element = chunks[index];
        const start = index * this.embeddingSize;
        const end = start + this.embeddingSize;
        const vector = output.data.slice(start, end);
        element.metadata.vector = Array.from(vector);
        element.metadata.chunkIndex = index;
        this.allChunks.push(element as Document<Metadata>);
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
