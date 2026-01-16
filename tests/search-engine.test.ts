// tests/search-engine.test.ts
import { describe, it, expect, beforeEach } from "vitest";
import { BM25Search } from "../lib/search-engine";
import { MdFiles } from "@/lib/loader";

const deploymentArticle: MdFiles = {
  filePath: "",
  fileContent: `---
title: Браузерная версия на собственном сервере
---

Вы можете развернуть браузерную версию на собственном сервере...
## Запуск
1. Скачайте готовый файл командой \`curl -LO https://gram.ax/editor-docker-compose.yaml\`.

:::quote:true Подробнее
\`\`\`yaml
version: "3.8"
services:
  editor:
    image: docker.io/gramax/editor:latest
    container_name: editor
    restart: unless-stopped
\`\`\`
:::

:::info Развернуть с помощью Podman
Если вы предпочитаете использовать Podman, выполните следующие шаги...
:::

## Доступ с других устройств
Чтобы браузерная версия была доступна другим сотрудникам... нужен HTTPS.

:::info:true Зачем нужен HTTPS
Это требование браузеров: для работы приложения нужен SharedArrayBuffer, который доступен только по HTTPS.
:::

### Настройка HTTPS
1. Создайте конфигурационный файл для OpenSSL (например, \`openssl.cnf\`) со следующим содержимым:

\`\`\`ini
[dn]
CN = editor.local
\`\`\`

2. Сгенерируйте самоподписанный сертификат...
`,
};

describe("Тестирование статьи: Развертывание (Docker/Podman/HTTPS)", () => {
  let searchEngine: BM25Search;

  beforeEach(() => {
    searchEngine = new BM25Search([deploymentArticle]);
  });

  it("должен полностью вырезать содержимое YAML и INI конфигов", () => {
    const cleaned = searchEngine.getCleanText(deploymentArticle.fileContent);

    // Технические детали из Docker Compose не должны индексироваться
    expect(cleaned).not.toContain("unless-stopped");
    expect(cleaned).not.toContain("container_name");
    expect(cleaned).not.toContain("image: docker.io");

    // Детали из openssl.cnf тоже
    expect(cleaned).not.toContain("CN = editor.local");
    expect(cleaned).not.toContain("[dn]");

    // Человеческий текст должен остаться
    expect(cleaned).toContain(
      "Вы можете развернуть браузерную версию на собственном сервере..."
    );
    expect(cleaned).toContain("Скачайте готовый файл");
  });

  it("должен корректно обрабатывать контейнеры :::info и :::quote", () => {
    const cleaned = searchEngine.getCleanText(deploymentArticle.fileContent);

    // Проверяем, что сами метрики контейнеров удалены
    expect(cleaned).not.toContain(":::info");
    expect(cleaned).not.toContain(":::quote:true");

    // Проверяем, что текст ВНУТРИ контейнеров остался (если это не код)
    expect(cleaned).toContain("предпочитаете использовать Podman");
    expect(cleaned).toContain("Подробнее");
  });

  it("должен находить статью по ключевым технологиям из текста", () => {
    // Проверяем поиск по словам, которые есть в прозе
    const resultsPodman = searchEngine.search("Podman", "loose", "bm25");
    const resultsHttps = searchEngine.search("HTTPS", "strict", "bm25");

    expect(resultsPodman.length).toBe(1);
    expect(resultsHttps.length).toBe(1);
    expect(resultsPodman[0].title).toBe(
      "Браузерная версия на собственном сервере"
    );
  });

  it("не должен находить статью по специфическим ключам Docker-compose", () => {
    // Слово "restart" или "version" есть только внутри блоков кода
    const results = searchEngine.search("restart", "loose", "bm25");
    expect(results.length).toBe(0);
  });

  it("должен генерировать чистый сниппет вокруг слова SharedArrayBuffer", () => {
    // Теперь слово есть в тексте, и тест пройдет
    const results = searchEngine.search("SharedArrayBuffer", "loose", "bm25");

    expect(results.length).toBeGreaterThan(0);

    if (results.length > 0) {
      const snippet = results[0].snippet;
      expect(snippet).toContain("SharedArrayBuffer");
      expect(snippet).not.toContain(":::");
      expect(snippet).not.toContain(":true");
    }
  });
});

const ssoArticle: MdFiles = {
  filePath: "",
  fileContent: `---
title: Подключение SSO
---

{% table header="row" %}

---

* {% colwidth=[183] %}
   Переменная
* {% colwidth=[310] %}
   Описание
* {% colwidth=[203] %}
   Пример значения

---

* {% colwidth=[183] %}
   \`SSO_SERVICE_ENCRYPTION_KEY\`
* {% colwidth=[310] %}
   Ключ, используется для безопасной передачи данных между сервисами. Для генерации можно использовать \`openssl rand -hex 32\`. **Обязателен**.
* {% colwidth=[203] %}
   \`SSO_SERVICE_ENCRYPTION_KEY=7cdf59ed...cccb8489\`

---

* {% colwidth=[183] %}
   \`AUTH_METHOD\`
* {% colwidth=[310] %}
   Метод авторизации в SSO. Необходимо выбрать любой доступный один способ авторизации.
   Варианты:
   - \`azure\`
   - \`adfs\`
   - \`keycloak\`
   - \`openid\`
   - \`ldap\`
   - \`kerberos\`
* {% colwidth=[203] %}
   \`AUTH_METHOD=azure\`

{% /table %}`,
};

describe("Тестирование статьи: SSO (Таблицы и переменные)", () => {
  let searchEngine: BM25Search;

  beforeEach(() => {
    // Инициализируем поиск только этой статьей
    searchEngine = new BM25Search([ssoArticle]);
  });

  it("должен очищать разметку Markdoc, но сохранять технические термины", () => {
    const cleaned = searchEngine.getCleanText(ssoArticle.fileContent);

    // Проверяем, что служебные теги исчезли
    expect(cleaned).not.toContain("{% colwidth");
    expect(cleaned).not.toContain("%}");
    expect(cleaned).not.toContain('header="row"');
    // Проверяем, что важные термины внутри таблицы остались
    expect(cleaned).toContain("SSO_SERVICE_ENCRYPTION_KEY");
    expect(cleaned).toContain("keycloak");
    expect(cleaned).toContain("openssl rand -hex 32");
  });

  it("должен находить статью по названию метода авторизации (например, keycloak)", () => {
    const results = searchEngine.search("keycloak", "loose", "bm25");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Подключение SSO");
    // Проверяем, что в сниппете слово подсвечивается (или просто присутствует)
    expect(results[0].snippet).toContain("keycloak");
  });

  it("должен находить статью по имени переменной", () => {
    const results = searchEngine.search("SSO_URL", "loose", "bm25");

    // В статье SSO_URL упоминается несколько раз
    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Подключение SSO");
  });

  it("не должен индексировать технические атрибуты таблицы (colwidth)", () => {
    // Если пользователь введет "colwidth", он не должен ничего найти.
    // Это подтверждает, что регулярка вырезала теги полностью.
    const results = searchEngine.search("colwidth", "loose", "bm25");
    expect(results.length).toBe(0);
  });

  it("должен находить статью по фрагменту команды (openssl)", () => {
    const results = searchEngine.search("openssl", "loose", "bm25");
    expect(results.length).toBe(1);
    expect(results[0].snippet).toContain("openssl rand -hex 32");
  });
});

export const articles: MdFiles[] = [
  {
    filePath: "browser-version.md",
    fileContent: `---
order: 2
title: Браузерная версия
---

Доступна по ссылке [app.gram.ax](http://app.gram.ax). Несмотря на то, что приложение работает в браузере, все файлы хранятся только в вашем браузере на вашем устройстве. Если вы очистите кэш браузера, то все файлы удалятся и их необходимо будет заново синхронизировать из [хранилища](./../storage/_index).

**Поддерживаемые браузеры**: Google Chrome и все браузеры на Chromium, Yandex, Opera, FireFox, Safari (от 17.4), Edge.

:::note:true CORS-прокси в браузерной версии

Чтобы работать с Git API в браузере, необходимо использовать CORS-прокси, так как браузеры налагают ограничения на запросы к внешним ресурсам, находящимся на других доменах.

Наш CORS-прокси служит для перенаправления запросов в ваше Git-хранилище через наш сервер. Мы **не сохраняем и не можем прочитать** данные, которые проходят через прокси. Все данные передаются в зашифрованном виде, что обеспечивает их безопасность во время обработки и передачи.

Также вы можете [развернуть браузерную версию в своей инфраструктуре](./web-editor-on-own-server).

:::`,
  },
  {
    filePath: "about-ges.md",
    fileContent: `---
order: 0.5
title: О сервере
---

Gramax Enterprise Server (GES) -- это расширенная версия Open Source-версии Gramax. Она отличается наличием промежуточного сервера, который становится прослойкой между приложением и Git-хранилищем.

## Возможности

- **Аутентификация через корпоративный Single Sign-On**. Редакторы при входе в приложение будут получать все настройки пространства. Читатели при входе на портал документации увидят только доступные для них каталоги.

- **Расширеднное управление доступами**. Можно ограничивать права на редактирование и просмотр каталогов как в приложении, так и на портале документации.

- **Встроенные проверки на соответствие стайлгайду компании**. Прямо в интерфейсе редакторы смогут проверять тексты на соответствие правилам. А владелец пространства -- гибко управлять ими.

## Архитектура

![](./about-ges.jpeg)

## Права и роли

В Open Source-версии Gramax есть только 2 роли:

- Редактор -- без ограничений управляет всеми каталогами.

- Читатель -- только читает каталоги на портале документации.

В Gramax Enterprise Server ролей значительно больше. В зависимости от выданной роли появляются доступы на разные каталоги и действия в приложении.

{% table header="row" %}

---

- {% colwidth=[259] %}

  Доступы / Роли

- {% colwidth=[143] %}

  Владелец пространства

- {% colwidth=[113] %}

  Владелец каталога

- {% colwidth=[108] %}

  Редактор

- {% colwidth=[148] %}

  Проверяющий

- {% colwidth=[112] %}

  Читатель

---

- {% colwidth=[259] %}

  **Управление пространством**

  - Изменение настроек пространства

  - Изменение групп в пространстве

  - Управление доступами к каталогу

  - Настройка проверок по стайлгайду

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  -

- {% colwidth=[108] %}

  -

- {% colwidth=[148] %}

  -

- {% colwidth=[112] %}

  -

---

- {% colwidth=[259] %}

  **Просмотр настроек пространства**

  - Чтение групп в пространстве

  - Чтение свойств и доступов в каталогах

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  +

- {% colwidth=[108] %}

  +

- {% colwidth=[148] %}

  -

- {% colwidth=[112] %}

  -

---

- {% colwidth=[259] %}

  **Управление каталогом**

  - Изменение свойств каталога

  - Изменение ветки и синхронизация на портале документации

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  +

- {% colwidth=[108] %}

  -

- {% colwidth=[148] %}

  -

- {% colwidth=[112] %}

  -

---

- {% colwidth=[259] %}

  **Редактирование каталога**

  - Создание каталога

  - Управление ветками

  - Изменение ветки и синхронизация в приложении

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  +

- {% colwidth=[108] %}

  +

- {% colwidth=[148] %}

  -

- {% colwidth=[112] %}

  -

---

- {% colwidth=[259] %}

  **Редактирование статей**

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  +

- {% colwidth=[108] %}

  +

- {% colwidth=[148] %}

  +

- {% colwidth=[112] %}

  -

---

- {% colwidth=[259] %}

  **Просмотр каталога в приложении или на портале документации**

- {% colwidth=[143] %}

  +

- {% colwidth=[113] %}

  +

- {% colwidth=[108] %}

  +

- {% colwidth=[148] %}

  +

- {% colwidth=[112] %}

  Только на портале документации

{% /table %}`,
  },
  {
    filePath: "roles-summary.md",
    fileContent: `---
title: Кратко про роли
---

Здесь находится информация про роли и права доступа.`,
  },
];

describe("Тестирование алгоритма в строгом режиме по запросу Права и Роли", () => {
  let instance: BM25Search;
  beforeEach(() => {
    instance = new BM25Search(articles);
  });
  it("Должен найти статью права и роли", () => {
    const docs = instance.search("Права и Роли", "strict", "bm25");
    expect(docs.length).toBe(1);
    expect(docs[0].title).toBe("О сервере");
    expect(docs[0].snippet.toLowerCase()).toContain("права и роли");
  });
});

const settings: MdFiles = {
  fileContent: `

При создании нового пространства можно задать **настройки**:

-  Название пространства.

-  Иконка.

-  Рабочая директория (доступно только для десктопной версии).

-  Вид главной страницы:

   -  Логотип.

   -  [Группировка каталогов](./sections).

   -  [Стили](./css-styles).

![](./settings.png){width=2880px height=1800px}

:::tip 

## Поделиться настройками с коллегами

Все настройки пространства сохраняются в файл workspace.yaml -- он находится в рабочей директории, которую вы указали при создании пространства.

Чтобы поделиться настройками: отправьте файл workspace.yaml коллеге и предложите ему заменить его в своем рабочем пространстве.

## Опубликовать настройки на портал документации

**Жирный** и _курсив_
~~Зачеркнутый~~
---
*  {% colwidth=[256] %}

   ELASTIC_SEARCH_PASSWORD

*  {% colwidth=[256] %}

:::tip Пример glob-паттернов

*  {% colwidth=[256] %}

   MATOMO_URL

*  {% colwidth=[256] %}

   URL инстанса Matomo.

*  {% colwidth=[212] %}

   https://matomo.gram.ax

   [https://matomo.gram.ax](https://matomo.gram.ax)

   {% /table %}

&nbsp; (спецпробел)
> Цитата

Настройки пространства можно также применить на [портале документации](./../doc-portal/_index). Для этого добавьте файл workspace.yaml в папку, указанную в ROOT_PATH портала.`,
  filePath: "",
};

describe("Должны очищать все виды MarkDown разметки и не только(markDoc,docker)", () => {
  let instance: BM25Search;
  beforeEach(() => {
    instance = new BM25Search([settings]);
  });
  it("Удаление markdown", () => {
    const text = instance.getCleanText(settings.fileContent);
    expect(text).not.toContain("![]");
    expect(text).not.toContain("#");
    expect(text).not.toContain(">");
    expect(text).not.toContain("**");
    expect(text).not.toContain("~~");
    expect(text).not.toContain("---");
    expect(text).not.toContain("{}");
    expect(text).not.toContain("*");
    expect(text).not.toContain("%");
    expect(text).not.toContain("colwidth");
    expect(text).not.toContain(":::");
    expect(text).not.toContain("&nbsp");
    expect(text).toContain("MATOMO_URL");
  });
});

const corpus: MdFiles[] = [
  {
    fileContent: `---
title: Настройка SSO
---
Необходимо настроить безопасное подключение для всех пользователей.
Используйте сертификаты для защиты данных.`,
    filePath: "",
  },
  {
    fileContent: `--- 
title: Server Deployment
---
How to deploy applications to multiple remote servers.
Ensure the server is running correctly.`,
    filePath: "",
  },
];

describe("BM25Search: Stemming & Advanced Logic", () => {
  const engine = new BM25Search(corpus);

  it("RU: должен находить 'настройки' по запросу 'настройку' (Stemming)", () => {
    // В тексте: "подключение"
    // Запрос: "подключать" (другая форма)

    // 1. Без стемминга (bm25) не должен найти
    const strictResults = engine.search("настройку", "loose", "bm25");
    expect(strictResults.length).toBe(0);

    // 2. Со стеммингом должен найти
    const stemResults = engine.search("настройку", "loose", "stemming");
    expect(stemResults.length).toBe(1);
    expect(stemResults[0].title).toBe("Настройка SSO");
  });

  it("RU: должен находить 'защиты' по запросу 'защит' (Stemming)", () => {
    // В тексте: "подключение"
    // Запрос: "подключать" (другая форма)

    // 1. Без стемминга (bm25) не должен найти
    const strictResults = engine.search("сертификатов", "loose", "bm25");
    expect(strictResults.length).toBe(0);

    // 2. Со стеммингом должен найти
    const stemResults = engine.search("сертификатов", "loose", "stemming");
    expect(stemResults.length).toBe(1);
    expect(stemResults[0].title).toBe("Настройка SSO");
  });

  it("EN: должен находить 'servers' по запросу 'server' (Stemming)", () => {
    // В тексте: "servers"
    // Запрос: "server"
    const results = engine.search("server", "loose", "stemming");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Server Deployment");
  });

  it("Strict Mode: должен отсеивать результаты, если хотя бы одного стема нет", () => {
    // Запрос: "настроить" (есть) + "удалить" (нету)
    // В режиме 'loose' он бы нашел документ (так как одно слово совпало)
    // В режиме 'strict' результат должен быть пустым

    const results = engine.search("настроить удалить", "strict", "stemming");
    expect(results.length).toBe(0);
  });

  it("Snippet: должен подсвечивать оригинальные слова, а не корни", () => {
    // Ищем статью про деплой.
    // Запрос: "deploy"
    // В тексте есть слово "deploy" (совпадает) и "Deployment" (корень тот же)

    const results = engine.search("deploy", "loose", "stemming");

    expect(results.length).toBeGreaterThan(0);

    const snippet = results[0].snippet;

    // Проверяем, что сниппет сгенерировался и содержит слово из текста
    // Твой метод generateSnippet использует startsWith по оригинальному запросу
    expect(snippet.toLowerCase()).toContain("deploy");
  });

  it("JSON Persistence: должен сохранять и восстанавливать глобальные счетчики стеммов", () => {
    // 1. Сохраняем индекс в JSON
    const jsonString = JSON.stringify(engine);

    // 2. Восстанавливаем новый инстанс
    const restoredEngine = BM25Search.loadJSON(jsonString);

    // 3. Проверяем, работает ли поиск по стеммам в восстановленном движке
    // Если stemmerGlobalCount потерялся при загрузке, веса (IDF) будут неверными или поиск упадет
    const results = restoredEngine.search("безопасные", "loose", "stemming");

    expect(results.length).toBe(1);
    expect(results[0].title).toBe("Настройка SSO");
  });
});
