// generate-labels.js
import fs from "fs";
import path from "path";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import ExcelJS from "exceljs";

const INPUT_XLSX = path.resolve("./data.xlsx"); // <-- qui carica SEMPRE questo file
const OUT_DIR = path.resolve("./output");
const OUT_PDF = path.join(OUT_DIR, "labels.pdf");

// === Layout etichette (A4) ===
// 3 colonne x 8 righe = 24 etichette per pagina
const PAGE = { width: 595.28, height: 841.89 }; // A4 in punti (pt)
const MARGIN = 24; // ~8.5 mm
const COLS = 3;
const ROWS = 8;
const GAP_X = 10; // spazio orizzontale tra etichette
const GAP_Y = 10; // spazio verticale tra etichette

const usableW = PAGE.width - MARGIN * 2;
const usableH = PAGE.height - MARGIN * 2;

const labelW = (usableW - GAP_X * (COLS - 1)) / COLS;
const labelH = (usableH - GAP_Y * (ROWS - 1)) / ROWS;

// contenuti dentro etichetta
const PAD = 8;
const QR_SIZE = Math.min(labelW, labelH) * 0.55; // dimensione QR (55% del lato minore)
const TEXT_LINE_H = 12;

function ensureOutDir() {
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
}

function clean(v) {
  // ExcelJS può restituire: string, number, { richText }, ecc.
  if (v == null) return "";
  if (typeof v === "object") {
    // prova a gestire casi comuni (es. {text: "..."} o richText)
    if (typeof v.text === "string") return v.text.trim();
    if (Array.isArray(v.richText)) {
      return v.richText
        .map((t) => t.text || "")
        .join("")
        .trim();
    }
  }
  return String(v).trim();
}

function qrPayload({ sku, lot, ser }) {
  const parts = [];
  if (sku) parts.push(`sku=${sku}`);
  if (lot) parts.push(`lot=${lot}`);
  if (ser) parts.push(`ser=${ser}`); // non usato ora, ma pronto
  return parts.join(";");
}

async function makeQrPngBuffer(text) {
  return QRCode.toBuffer(text, {
    errorCorrectionLevel: "M", // buon compromesso per etichette reali
    margin: 1,
    type: "png",
    scale: 8,
  });
}

async function readXlsxRows(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(
      `File Excel non trovato: ${filePath}\n` +
        `Metti "data.xlsx" nella cartella del progetto (accanto a generate-labels.js).`,
    );
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);

  const ws = wb.worksheets[0];
  if (!ws) throw new Error("Nessun foglio trovato nel file Excel.");

  // Intestazioni dalla prima riga
  const headerRow = ws.getRow(1);
  const headerMap = {}; // { sku: 1, lot: 2, desc: 3, ... }

  headerRow.eachCell((cell, colNumber) => {
    const key = clean(cell.value).toLowerCase();
    if (key) headerMap[key] = colNumber;
  });

  if (!headerMap.sku) {
    throw new Error(
      "Colonna 'sku' non trovata nella prima riga.\n" +
        "Assicurati che la riga 1 contenga le intestazioni: sku | lot | desc",
    );
  }

  const colSku = headerMap.sku;
  const colLot = headerMap.lot; // può essere undefined
  const colDesc = headerMap.desc; // può essere undefined

  const rows = [];

  ws.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return; // salta intestazioni

    const sku = clean(row.getCell(colSku).value);
    if (!sku) return; // riga vuota

    const lot = colLot ? clean(row.getCell(colLot).value) : "";
    const desc = colDesc ? clean(row.getCell(colDesc).value) : "";

    rows.push({ sku, lot, desc });
  });

  return rows;
}

async function main() {
  ensureOutDir();

  const rows = await readXlsxRows(INPUT_XLSX);
  if (rows.length === 0) {
    console.error(
      "Nessuna riga valida trovata. Serve almeno una riga con 'sku' compilato.",
    );
    process.exit(1);
  }

  const doc = new PDFDocument({
    size: [PAGE.width, PAGE.height],
    margins: { top: MARGIN, left: MARGIN, right: MARGIN, bottom: MARGIN },
  });

  const out = fs.createWriteStream(OUT_PDF);
  doc.pipe(out);

  doc.font("Helvetica");

  const labelsPerPage = COLS * ROWS;
  let index = 0;

  while (index < rows.length) {
    for (let i = 0; i < labelsPerPage && index < rows.length; i++, index++) {
      const r = rows[index];

      const payload = qrPayload(r);
      const qrBuf = await makeQrPngBuffer(payload);

      const col = i % COLS;
      const row = Math.floor(i / COLS);

      const x = MARGIN + col * (labelW + GAP_X);
      const y = MARGIN + row * (labelH + GAP_Y);

      // bordo guida (puoi toglierlo se non lo vuoi)
      /* doc
        .lineWidth(0.5)
        .rect(x, y, labelW, labelH)
        .strokeColor("#CCCCCC")
        .stroke(); */

      // QR
      const qrX = x + PAD;
      const qrY = y + PAD;
      doc.image(qrBuf, qrX, qrY, { width: QR_SIZE, height: QR_SIZE });

      // Testo
      const textX = x + PAD;
      const textY = qrY + QR_SIZE + 6;

      doc.fillColor("black").fontSize(9);
      doc.text(`SKU: ${r.sku}`, textX, textY, { width: labelW - PAD * 2 });

      let line = 1;
      if (r.lot) {
        doc.text(`LOT: ${r.lot}`, textX, textY + TEXT_LINE_H * line, {
          width: labelW - PAD * 2,
        });
        line++;
      }

      if (r.desc) {
        const maxChars = 42;
        const d =
          r.desc.length > maxChars
            ? r.desc.slice(0, maxChars - 1) + "…"
            : r.desc;
        doc.text(d, textX, textY + TEXT_LINE_H * line, {
          width: labelW - PAD * 2,
        });
      }
    }

    if (index < rows.length) doc.addPage();
  }

  doc.end();

  await new Promise((resolve) => out.on("finish", resolve));

  console.log(`✅ Letto Excel: ${INPUT_XLSX}`);
  console.log(`✅ Creato PDF : ${OUT_PDF}`);
  console.log(`✅ Etichette : ${rows.length}`);
}

main().catch((err) => {
  console.error("❌ Errore:", err.message);
  process.exit(1);
});
