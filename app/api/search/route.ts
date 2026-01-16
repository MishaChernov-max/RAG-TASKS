import { AlghoritmType, BM25Search, SearchMode } from "@/lib/search-engine";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";

export type SearchResult = {
  id: number;
  title: string;
  score: number;
  snippet: string;
  originalContent: string;
  filePath: string;
};

let searchEngine: BM25Search | null = null;

export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q") || "";
    const mode =
      (request.nextUrl.searchParams.get("mode") as SearchMode) || "strict";
    const alghoritm =
      (request.nextUrl.searchParams.get("alghoritm") as AlghoritmType) ||
      "bm25";
    if (!searchEngine) {
      const pathToData = path.join(process.cwd(), "search-index.json");
      if (!fs.existsSync(pathToData))
        return NextResponse.json(
          { error: "Index file not found" },
          { status: 500 }
        );
      const jsonString = fs.readFileSync(pathToData, "utf8");
      searchEngine = BM25Search.loadJSON(jsonString);
    }
    if (!q) {
      return NextResponse.json([]);
    }
    const docs = searchEngine.search(q, mode, alghoritm);
    return NextResponse.json<SearchResult[]>(docs);
  } catch (e) {
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
