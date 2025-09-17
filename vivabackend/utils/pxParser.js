// utils/pxParser.js
export function parsePX(content) {
  const lines = content.split(/\r?\n/).filter(Boolean);

  const meta = {};
  const variables = {};
  let data = [];

  for (const line of lines) {
    if (line.startsWith("DATA=")) {
      // collect values after DATA=
      const numbers = line
        .replace("DATA=", "")
        .replace(/;/g, "")
        .trim()
        .split(/\s+/)
        .map((v) => parseInt(v, 10));
      data = data.concat(numbers);
      continue;
    }

    // Match VALUES("Dimension")
    const valuesMatch = line.match(/^VALUES\("(.*?)"\)=(.*);$/i);
    if (valuesMatch) {
      const dim = valuesMatch[1];
      const values = valuesMatch[2]
        .split(",")
        .map((v) => v.replace(/"/g, "").trim());
      variables[dim] = values;
      continue;
    }

    // Generic KEY="value";
    const kvMatch = line.match(/^(\w+)=["']?(.*?)["']?;$/);
    if (kvMatch) {
      meta[kvMatch[1]] = kvMatch[2];
    }
  }

  return {
    meta,
    variables, // { Vendbanimi: [...], Viti: [...], Gjinia: [...] }
    data, // flat array of values
  };
}
