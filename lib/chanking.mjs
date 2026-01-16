const text =
  "Настройка рабочего пространства. Чтобы начать работу, необходимо создать рабочую директорию. В этой директории будут храниться все ваши Markdown-файлы и конфигурации. После выбора папки вы сможете задать название и иконку. Это поможет коллегам быстрее ориентироваться. Помните, что все настройки сохраняются в файл workspace.yaml. Этот файл нельзя удалять вручную, так как это приведет к потере структуры и стилей оформления портала.";

function chanking(text) {
  const chunks = [];
  let chunk = [];
  const LIMIT = 20;
  const OVERLAP = 5;
  const array = text.split(/\s+/);
  for (let index = 0; index < array.length; index++) {
    const word = array[index];
    if (chunk.length >= LIMIT) {
      const start = chunk.length - OVERLAP;
      const endOfChunk = chunk.slice(start, chunk.length);
      chunks.push(chunk.join(" "));
      chunk = [...endOfChunk, word];
    } else {
      chunk.push(word);
    }
  }
  if (chunk.length > 0) chunks.push(chunk.join(" "));
  return chunks;
}
console.log(chanking(text));
