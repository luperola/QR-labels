# QR Labels + inventario base

Questo progetto genera etichette PDF con QR da `data.xlsx` e include un micro-server inventario.

## Problemi comuni (iPhone/Safari)

- **Se usi `https://IP:3000` non funziona**: il server avvia solo HTTP locale.
  Usa **`http://IP_DEL_PC:3000`** (senza `s`).
- Se vuoi evitare il flusso “scatta foto”, genera QR che puntano direttamente al server
  (vedi sezione “QR apribili direttamente dalla fotocamera iPhone”).

## Uso rapido inventario (iPhone o PC)

1. Avvia il server:

```bash
npm run start:inventory
```

2. Apri dal telefono (stessa rete Wi-Fi):

```txt
http://IP_DEL_PC:3000
```

3. Leggi o incolla il payload QR (es. `sku=ABC;lot=L1`), scegli `IN/OUT`, quantità e salva.
4. Lo stock viene aggiornato in tempo reale e salvato su `data/movements.json`.

## QR apribili direttamente dalla fotocamera iPhone (senza foto)

Puoi generare etichette con QR contenente un URL già pronto, così iPhone apre Safari
con SKU/LOT precompilati.

Esempio:

```bash
QR_BASE_URL="http://192.168.1.50:3000" npm run start:labels
```

Con questa opzione, ogni QR conterrà URL tipo:

```txt
http://192.168.1.50:3000/?sku=ABC&lot=L1&payload=sku%3DABC%3Blot%3DL1
```

## Endpoints API

- `GET /api/scan?payload=sku=ABC;lot=L1` → parse payload QR.
- `GET /api/stock` → stock aggregato + movimenti.
- `POST /api/movement` → registra movimento.

Esempio body:

```json
{
  "sku": "ABC",
  "lot": "L1",
  "type": "IN",
  "qty": 5,
  "operator": "Luca",
  "note": "Carico test"
}
```

## Generazione etichette

```bash
npm start
```

Output PDF: `output/labels.pdf`.
