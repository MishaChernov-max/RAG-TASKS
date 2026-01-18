import { MdFiles } from "@/lib/loader";
import { BM25Search } from "@/lib/search-engine"; // Укажи свой путь
import { describe, it, expect } from "vitest";

describe("Тесты на  текущую логику (Супплетивизм)", () => {
  // КЕЙС 1: Разные корни у глаголов (Идти -> Шёл)
  // Стеммер: "шёл" -> "шел", "идти" -> "ид". Корни разные.
  // Лемматизатор: "шёл" -> "идти". Совпадение.
  it("должен найти 'шёл' по запросу 'идти' (разные корни)", () => {
    const corpus: MdFiles[] = [
      {
        fileContent: `---
title: Прогулка
---
Вчера я шёл по лесу.`,
        filePath: "walk.md",
      },
    ];

    const engine = new BM25Search(corpus);
    const results = engine.search("идти", "strict", "lemmatization");

    // ЭТОТ ТЕСТ УПАДЕТ: Сейчас results.length === 0
    expect(results.length).toBeGreaterThan(0);
  });

  // КЕЙС 2: Разные корни у существительных (Люди -> Человек)
  // Стеммер: "люди" -> "люд", "человек" -> "человек".
  // Лемматизатор: "люди" -> "человек".
  it("должен найти 'люди' по запросу 'человек' (супплетивизм)", () => {
    const corpus: MdFiles[] = [
      {
        fileContent: `---
title: Социум
---
Многие люди любят музыку.`,
        filePath: "society.md",
      },
    ];

    const engine = new BM25Search(corpus);
    const results = engine.search("человек", "strict", "lemmatization");

    // ЭТОТ ТЕСТ УПАДЕТ: Сейчас results.length === 0
    expect(results.length).toBeGreaterThan(0);
  });

  // КЕЙС 3: Сравнительные степени прилагательных (Лучше -> Хороший)
  // Стеммер: "лучше" -> "лучш", "хороший" -> "хорош".
  // Лемматизатор: "лучше" -> "хороший".
  it("должен найти 'лучше' по запросу 'хорошо' (степени сравнения)", () => {
    const corpus: MdFiles[] = [
      {
        fileContent: `---
title: Качество
---
Этот вариант намного лучше.`,
        filePath: "quality.md",
      },
    ];

    const engine = new BM25Search(corpus);
    const results = engine.search("хорошо", "strict", "lemmatization");

    // ЭТОТ ТЕСТ УПАДЕТ: Сейчас results.length === 0
    expect(results.length).toBeGreaterThan(0);
  });
});
