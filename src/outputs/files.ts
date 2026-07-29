import fs from "node:fs/promises";
import path from "node:path";

export async function saveJson(folder: string, name: string, data: unknown) {
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, `${name}.json`);
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf-8");
  return file;
}

export function jsonToCsv(data: Record<string, any>[]): string {
  if (data.length === 0) return "";
  const headers = Object.keys(data[0]);
  const csvRows = [headers.join(",")];
  
  for (const row of data) {
    const values = headers.map(header => {
      const val = row[header];
      const escaped = ('' + (val ?? '')).replace(/"/g, '""');
      return `"${escaped}"`;
    });
    csvRows.push(values.join(","));
  }
  
  return csvRows.join("\n");
}

export async function saveCsv(folder: string, name: string, data: Record<string, any>[]) {
  await fs.mkdir(folder, { recursive: true });
  const file = path.join(folder, `${name}.csv`);
  const csvContent = jsonToCsv(data);
  await fs.writeFile(file, csvContent, "utf-8");
  return file;
}
