diff --git a/README.md b/README.md
new file mode 100644
index 0000000000000000000000000000000000000000..c94af4a09cc6b94231fb7c19597ddac05b5fb64a
--- /dev/null
+++ b/README.md
@@ -0,0 +1,54 @@
+# QR Labels + inventario base

- +Questo progetto genera etichette PDF con QR da `data.xlsx` e include ora un micro-server inventario.
- +## Risposta breve alla domanda
- +- **Lo stock NON rimane sullo smartphone**: l'iPhone è solo interfaccia di scansione/inserimento.
  +- **I dati rimangono sul PC/server** che esegue `inventory-server.js`, nel file `data/movements.json`.
  +- La **struttura minima tabella movimenti** è implementata come record JSON con campi:
- - `timestamp`
- - `sku`
- - `lot`
- - `type` (`IN` / `OUT`)
- - `qty`
- - `operator`
- - `note`
- +## Uso rapido inventario (iPhone o PC)
- +1. Avvia server:
- ```bash

  ```
- npm run start:inventory
- ```
  +2. Apri dal browser del telefono (stessa rete Wi-Fi):
  ```
- `http://IP_DEL_PC:3000`
  +3. Incolla/scansiona payload QR (es. `sku=ABC;lot=L1`), scegli `IN/OUT`, quantità e salva.
  +4. Lo stock viene aggiornato in tempo reale e salvato su `data/movements.json`.
- +## Endpoints API
- +- `GET /api/scan?payload=sku=ABC;lot=L1` → parse payload QR.
  +- `GET /api/stock` → stock aggregato + movimenti.
  +- `POST /api/movement` → registra movimento.
- +Esempio body:
- +```json
  +{
- "sku": "ABC",
- "lot": "L1",
- "type": "IN",
- "qty": 5,
- "operator": "Luca",
- "note": "Carico test"
  +}
  +```
- +## Generazione etichette
- +`bash
+npm start
+`
- +Output PDF: `output/labels.pdf`.
