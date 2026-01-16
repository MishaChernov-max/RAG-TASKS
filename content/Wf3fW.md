// tests/search-engine.test.ts

// ... импорты

const complexArticle = `---
title: Логирование Gramax Enterprise Server

---

{% table header="row" %}

---

- {% colwidth=[183] %}

  Переменная

- {% colwidth=[311] %}

  Описание

- {% colwidth=[226] %}

  Пример значения

---

- {% colwidth=[183] %}

  \`LOG_TYPE\`

- {% colwidth=[311] %}

  Формат логов.

  Варианты:

  - \`default\`

  - \`cef\`

- {% colwidth=[226] %}

  По умолчанию: \`default\`

---

- {% colwidth=[183] %}

  \`LOG_LEVEL\`

- {% colwidth=[311] %}

  Минимальный уровень логирования.

  Варианты:

  - \`debug\`

  - \`info\`

  - \`warn\`

  - \`error\`

  - \`fatal\`

- {% colwidth=[226] %}

  По умолчанию: \`info\`

---

- {% colwidth=[183] %}

  \`LOG_TRANSPORTER\`

- {% colwidth=[311] %}

  Канал вывода логов.

  Варианты:

  - \`console\`

  - \`syslog\`

- {% colwidth=[226] %}

  По умолчанию: \`console\`

{% /table %}`;

describe('Сложный кейс: Таблицы Markdoc (Логирование)', () => {
let searchEngine: BM25Search;

beforeEach(() => {
searchEngine = new BM25Search([complexArticle]);
});

it('должен вычищать ВСЕ теги таблицы и ширины колонок', () => {
const raw = complexArticle.split('---').slice(2).join('---'); // берем контент без frontmatter
const cleaned = searchEngine.getCleanText(raw);

    // Проверяем, что служебные цифры и теги исчезли
    expect(cleaned).not.toContain('colwidth');
    expect(cleaned).not.toContain('183');
    expect(cleaned).not.toContain('311');
    expect(cleaned).not.toContain('{%');
    expect(cleaned).not.toContain('%}');

    // Проверяем, что полезный текст остался
    expect(cleaned).toContain('LOG_LEVEL');
    expect(cleaned).toContain('Минимальный уровень логирования');
    expect(cleaned).toContain('fatal');

});

it('должен находить статью по переменной окружения', () => {
// Ищем конкретную переменную из таблицы
const results = searchEngine.search('LOG_TRANSPORTER', 'strict');

    expect(results.length).toBe(1);
    expect(results[0].title).toBe('Логирование Gramax Enterprise Server');

});

it('должен находить значения внутри списка вариантов', () => {
// Ищем слово "syslog", которое является одним из вариантов значения
const results = searchEngine.search('syslog', 'loose');

    expect(results.length).toBe(1);

});

it('не должен находить статью по техническим атрибутам Markdoc', () => {
// Если мы ищем "row" (из header="row") или цифру ширины колонки,
// поиск должен быть пуст. Это значит, что мусор не проиндексирован.
const results1 = searchEngine.search('colwidth', 'loose');
const results2 = searchEngine.search('183', 'loose');

    expect(results1.length).toBe(0);
    expect(results2.length).toBe(0);

});

it('должен генерировать красивый сниппет без мусора', () => {
// Эмулируем поиск по уровню логов
const results = searchEngine.search('LOG_LEVEL', 'loose');
const snippet = results[0].snippet;

    // Сниппет должен выглядеть примерно так: "... LOG_LEVEL Минимальный уровень логирования ..."
    // А НЕ так: "... colwidth LOG_LEVEL colwidth Минимальный ..."

    console.log('Сгенерированный сниппет:', snippet); // Полезно глянуть в консоли при отладке

    expect(snippet).toContain('LOG_LEVEL');
    expect(snippet).toContain('Минимальный уровень');
    expect(snippet).not.toContain('colwidth');
    expect(snippet).not.toContain('{%');

});
});
