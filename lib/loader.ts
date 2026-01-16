import fs from "fs";
import path from "path";

const contentDirectory = path.join(process.cwd(), "content");

export type MdFiles = { filePath: string; fileContent: string };

export function getMarkdown(): MdFiles[] {
  if (!fs.existsSync(contentDirectory)) {
    console.warn("Создайте базу знаний");
    return [];
  }
  const files = fs.readdirSync(contentDirectory);
  const allContent = files
    .filter((file) => file.endsWith(".md"))
    .map((file) => {
      const filePath = path.join(contentDirectory, file);
      const fileContent = fs.readFileSync(filePath, "utf8");
      return { filePath, fileContent };
    });
  return allContent;
}
