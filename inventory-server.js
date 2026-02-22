import http from "http";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const MOVEMENTS_FILE = path.join(DATA_DIR, "movements.json");
const PUBLIC_DIR = path.join(__dirname, "public");

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(MOVEMENTS_FILE)) {
    fs.writeFileSync(MOVEMENTS_FILE, "[]\n", "utf-8");
  }
}

function readMovements() {
  ensureDataFile();
  const raw = fs.readFileSync(MOVEMENTS_FILE, "utf-8");
  return JSON.parse(raw);
}

function writeMovements(movements) {
  fs.writeFileSync(
    MOVEMENTS_FILE,
    JSON.stringify(movements, null, 2) + "\n",
    "utf-8",
  );
}

function parseQrPayload(payload = "") {
  return payload
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, pair) => {
      const [key, value] = pair.split("=");
      if (key && value) acc[key.trim()] = value.trim();
      return acc;
    }, {});
}

function stockFromMovements(movements) {
  const map = new Map();

  for (const m of movements) {
    const key = `${m.sku}__${m.lot || ""}`;
    const sign = m.type === "IN" ? 1 : -1;
    map.set(key, (map.get(key) || 0) + sign * m.qty);
  }

  return [...map.entries()].map(([key, stock]) => {
    const [sku, lot] = key.split("__");
    return { sku, lot, stock };
  });
}

function sendJson(res, code, data) {
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

function serveFile(res, filePath, contentType) {
  if (!fs.existsSync(filePath)) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "Content-Type": contentType });
  res.end(fs.readFileSync(filePath));
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === "GET" && url.pathname === "/") {
    return serveFile(
      res,
      path.join(PUBLIC_DIR, "inventory.html"),
      "text/html; charset=utf-8",
    );
  }

  if (req.method === "GET" && url.pathname === "/api/scan") {
    const parsed = parseQrPayload(url.searchParams.get("payload") || "");
    return sendJson(res, 200, parsed);
  }

  if (req.method === "GET" && url.pathname === "/api/stock") {
    const movements = readMovements();
    return sendJson(res, 200, {
      stock: stockFromMovements(movements),
      movements,
    });
  }

  if (req.method === "POST" && url.pathname === "/api/movement") {
    const raw = await readBody(req);
    let input;

    try {
      input = JSON.parse(raw || "{}");
    } catch {
      return sendJson(res, 400, { error: "JSON non valido" });
    }

    const sku = (input.sku || "").trim();
    const lot = (input.lot || "").trim();
    const type = input.type;
    const qty = Number(input.qty);
    const operator = (input.operator || "").trim();
    const note = (input.note || "").trim();

    if (
      !sku ||
      !["IN", "OUT"].includes(type) ||
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      return sendJson(res, 400, {
        error: "Campi obbligatori: sku, type(IN/OUT), qty>0",
      });
    }

    const movements = readMovements();
    const currentStock =
      stockFromMovements(movements).find((s) => s.sku === sku && s.lot === lot)
        ?.stock || 0;

    if (type === "OUT" && currentStock < qty) {
      return sendJson(res, 400, {
        error: `Stock insufficiente per ${sku}/${lot || "-"}. Disponibile: ${currentStock}`,
      });
    }

    const record = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      sku,
      lot,
      type,
      qty,
      operator,
      note,
    };

    movements.push(record);
    writeMovements(movements);

    return sendJson(res, 201, {
      movement: record,
      stock:
        stockFromMovements(movements).find(
          (s) => s.sku === sku && s.lot === lot,
        )?.stock || 0,
    });
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Inventory server in ascolto su http://localhost:${PORT}`);
  console.log(`Movimenti salvati in ${MOVEMENTS_FILE}`);
});
