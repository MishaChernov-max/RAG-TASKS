import markdownToTxt from "markdown-to-txt";
import matter from "gray-matter";
import { newStemmer, Stemmer } from "snowball-stemmers";
import { MdFiles } from "./loader";

const k1 = 1;
const b = 0.75;

interface DocParams {
  id: number;
  title: string;
  content: string;
  originalLength: number;
  stemOriginalLength: number;
  originalContent: string;
  tokensMap: Record<string, number>;
  tokensMapStem: Record<string, number>;
  filePath: string;
}

export type SearchMode = "strict" | "loose";

export type AlghoritmType = "bm25" | "stemming";

export class BM25Search {
  private ruStemmer: Stemmer;
  private enStemmer: Stemmer;
  private stemmerGlobalCount: Record<string, number> = {};
  private docGlobalCount: Record<string, number> = {};
  private corpusSize: number = 0;
  private documents: DocParams[] = [];
  private averageLength: Record<AlghoritmType, number> = {
    bm25: 0,
    stemming: 0,
  };
  constructor(rawdata: MdFiles[]) {
    this.ruStemmer = newStemmer("russian");
    this.enStemmer = newStemmer("english");
    this.buildIndex(rawdata);
  }
  private processToken(word: string): string {
    if (/[а-яё]/i.test(word)) {
      return this.ruStemmer.stem(word);
    }
    if (/[a-z]/i.test(word)) {
      return this.enStemmer.stem(word);
    }
    return word;
  }
  private tokenize(text: string, isStemming?: boolean): string[] {
    const txt = text
      .toLowerCase()
      .split(/[^a-zа-яё0-9]+/i)
      .filter((word) => word.length > 1);
    return isStemming ? txt.map((word) => this.processToken(word)) : txt;
  }
  static loadJSON(jsonString: string): BM25Search {
    const data = JSON.parse(jsonString);

    const instance = new BM25Search([]);

    instance.corpusSize = data.corpusSize;

    instance.averageLength = data.averageLength;

    instance.docGlobalCount = data.docGlobalCount;

    instance.stemmerGlobalCount = data.stemmerGlobalCount;

    instance.documents = data.documents;

    return instance;
  }
  getCleanText(rawContent: string): string {
    let text = rawContent;

    // 1. Удаляем блоки кода (самое тяжелое)
    text = text.replace(/```[\s\S]*?```/g, "");

    // 2. Удаляем YAML frontmatter (если он вдруг просочился)
    text = text.replace(/^---[\s\S]*?---/g, "");

    // 3. Удаляем теги Markdoc {% ... %}
    text = text.replace(/{%[\s\S]*?%}/g, "");

    // 4. Удаляем атрибуты в фигурных скобках {width=...}
    text = text.replace(/{[\s\S]*?}/g, "");

    // 5. Удаляем контейнеры :::
    text = text.replace(/:::[^\s]*/g, "");

    // 6. Очищаем стандартный Markdown (заголовки, списки, ссылки)
    text = markdownToTxt(text);

    // 7. Чистим HTML-сущности типа &nbsp;
    text = text.replace(/&[a-z0-9#]+;/gi, " ");

    // 8. Удаляем обратные слэши и лишние пробелы
    return text.replace(/\\/g, "").replace(/\s+/g, " ").trim();
  }
  private buildIndex(rawdata: MdFiles[]) {
    this.documents = [];
    const totalLengths: Record<AlghoritmType, number> = {
      bm25: 0,
      stemming: 0,
    };
    rawdata.forEach(({ filePath, fileContent }, index) => {
      const dictionary: Record<string, number> = {};
      const stemsDictionary: Record<string, number> = {};
      const { data, content } = matter(fileContent);
      const cleanContent = this.getCleanText(content);
      const fullText = (data.title || "") + " " + cleanContent;
      const tokens = this.tokenize(fullText);
      const stemTokens = this.tokenize(fullText, true);
      totalLengths.bm25 += tokens.length;
      totalLengths.stemming += stemTokens.length;
      tokens.forEach((term) => {
        dictionary[term] = (dictionary[term] || 0) + 1;
        if (dictionary[term] === 1) {
          this.docGlobalCount[term] = (this.docGlobalCount[term] || 0) + 1;
        }
      });
      stemTokens.forEach((term) => {
        stemsDictionary[term] = (stemsDictionary[term] || 0) + 1;
        if (stemsDictionary[term] === 1) {
          this.stemmerGlobalCount[term] =
            (this.stemmerGlobalCount[term] || 0) + 1;
        }
      });
      this.documents.push({
        id: index,
        title: data.title || `Untitled ${index}`,
        content: cleanContent,
        originalLength: tokens.length,
        stemOriginalLength: stemTokens.length,
        originalContent: fileContent,
        tokensMap: dictionary,
        tokensMapStem: stemsDictionary,
        filePath,
      });
    });
    this.corpusSize = this.documents.length;
    if (this.corpusSize > 0) {
      this.averageLength.bm25 = totalLengths.bm25 / this.corpusSize;
      this.averageLength.stemming = totalLengths.stemming / this.corpusSize;
    }
  }
  private calculateIDF(word: string, alghoritm: AlghoritmType) {
    const nq =
      alghoritm === "bm25"
        ? this.docGlobalCount[word] || 0
        : this.stemmerGlobalCount[word] || 0;
    const idf = Math.log((this.corpusSize - nq + 0.5) / (nq + 0.5) + 1);
    return idf;
  }

  private generateSnippet(text: string, queryTokens: string[]): string {
    // Константы для настройки
    const SNIPPET_WINDOW_SIZE = 30; // Количество слов в сниппете (примерно 200-250 символов)

    // 1. Быстрый выход, если запроса нет
    if (!queryTokens.length) {
      return this.trimToWholeWords(text, 200);
    }

    // 2. Разбиваем текст на слова, сохраняя оригинал
    // Регулярка делит по пробелам и переносам строк
    const words = text.split(/(\s+)/);

    // 3. Создаем карту совпадений (где 1 - слово из запроса, 0 - обычное слово)
    // Мы проверяем только "значимые" части (не пробелы)
    const matches: number[] = words.map((word) => {
      if (!word.trim()) return 0; // Пропускаем пробелы
      const processed = word.trim().toLowerCase();

      // Проверяем: точное совпадение ИЛИ начало слова (для подсветки)
      const isMatch =
        queryTokens.includes(processed) ||
        queryTokens.some((qt) => processed.startsWith(qt));
      return isMatch ? 1 : 0;
    });

    // 4. Поиск "Лучшего окна" (Sliding Window)
    // Мы ищем участок из SNIPPET_WINDOW_SIZE слов с максимальным числом совпадений
    let maxScore = 0;
    let bestStartIndex = 0;

    // Проходим окном по массиву слов
    // Шаг 2, так как массив words содержит [слово, пробел, слово, пробел...]
    for (let i = 0; i < words.length; i += 2) {
      // Вычисляем конец текущего окна (учитывая границы массива)
      const windowEnd = Math.min(i + SNIPPET_WINDOW_SIZE * 2, words.length);

      // Считаем сколько ключевых слов попало в это окно
      let currentScore = 0;
      for (let j = i; j < windowEnd; j += 2) {
        currentScore += matches[j];
      }

      // Если нашли окно лучше предыдущего — запоминаем
      if (currentScore > maxScore) {
        maxScore = currentScore;
        bestStartIndex = i;
      }
    }

    // Если вообще ничего не нашли (maxScore === 0), возвращаем начало текста
    if (maxScore === 0) {
      return this.trimToWholeWords(text, 200);
    }

    // 5. Формируем итоговый текст
    // Берем слова из лучшего окна
    const start = bestStartIndex;
    const end = Math.min(start + SNIPPET_WINDOW_SIZE * 2, words.length);

    const snippet = words.slice(start, end).join("");

    // 6. Добавляем многоточия, если обрезали
    const prefix = start > 0 ? "..." : "";
    const suffix = end < words.length ? "..." : "";

    return prefix + snippet.trim() + suffix;
  }

  // Вспомогательный метод для красивой обрезки "заглушки"
  private trimToWholeWords(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    // Обрезаем до лимита
    const sub = text.substring(0, maxLength);

    // Ищем последний пробел, чтобы не резать слово
    const lastSpace = sub.lastIndexOf(" ");

    if (lastSpace === -1) return sub + "..."; // Если пробелов нет вообще (одно длинное слово)
    return sub.substring(0, lastSpace) + "...";
  }

  public search(input: string, mode: SearchMode, alghoritm: AlghoritmType) {
    const isStemming = alghoritm === "bm25" ? false : true;
    const tokensInput = this.tokenize(input, isStemming);
    const snippetTokens = this.tokenize(input, false);
    if (!tokensInput.length) {
      return [];
    }
    const scores = new Map<number, number>();
    this.documents.forEach((doc) => {
      const docTokens =
        alghoritm === "bm25" ? doc.tokensMap : doc.tokensMapStem;
      if (mode === "strict") {
        const check = tokensInput.every((token) => docTokens[token]);
        if (!check) return;
      }
      let score = 0;
      tokensInput.forEach((token) => {
        const idf = this.calculateIDF(token, alghoritm);
        const frequence = docTokens[token] || 0;
        if (frequence === 0) return;
        const avgLength =
          alghoritm === "bm25"
            ? this.averageLength.bm25
            : this.averageLength.stemming;
        const docOriginalLength =
          alghoritm === "bm25" ? doc.originalLength : doc.stemOriginalLength;
        const nominator = frequence * (k1 + 1);
        const denominator =
          frequence + k1 * (1 - b + b * (docOriginalLength / avgLength));
        score += idf * (nominator / denominator);
      });
      if (score > 0) scores.set(doc.id, score);
    });
    return Array.from(scores.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, score]) => {
        const doc = this.documents[id];
        return {
          id: doc.id,
          title: doc.title,
          score,
          snippet: this.generateSnippet(doc.content, snippetTokens),
          originalContent: doc.originalContent,
          filePath: doc.filePath,
        };
      });
  }
}
