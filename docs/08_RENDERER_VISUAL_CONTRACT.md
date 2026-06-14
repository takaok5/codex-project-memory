# Codex Project Memory Plugin — contratto renderer visuale v0.1

**Stato:** contratto renderer raffinato global-pass5 autonomous-ready, allineato a SQLite, CLI e MCP.  
**Output primario:** SVG deterministico.  
**Output interrogabile:** sidecar `*.map.json`.  
**Output opzionale:** PNG best-effort, sempre nullable nei contratti pubblici.

---

## 0. Decisioni vincolanti renderer

1. `current.svg` e `current.map.json` sono obbligatori per considerare riuscito un render.
2. `current.png` e `frames/*.png` sono opzionali; assenza PNG non invalida la memoria.
3. Tutti i render devono usare atomic write: temp file + rename.
4. SVG, map JSON e generated JSON devono essere deterministici a parità di input strutturale.
5. `sourceHash` non include `generatedAt`, timestamp, durata run, path assoluti o warning non strutturali.
6. Il renderer non legge codice sorgente: legge solo config, SQLite e graph normalizzato.
7. Il renderer non usa immagini AI, asset remoti, font incorporati o layout random.
8. Ogni path scritto in DB/map/output CLI/MCP è relativo POSIX.

---

## 1. Pipeline

```text
SQLite + config
  -> NormalizedGraph
  -> canonical graph JSON
  -> generated/*.json
  -> LayoutResult deterministic
  -> SVG frame
  -> map JSON sidecar
  -> optional PNG export
  -> frames table update
```

Scrittura sicura:

```text
build in memory
  -> validate JSON/SVG/map
  -> write temp files under .codex/memory/cache or target dir
  -> atomic rename to final path
  -> update frames table inside DB transaction
```

Se PNG export fallisce dopo SVG/map validi:

```text
render success
png_path = NULL
warning = png_export_failed
```

---

## 2. Output minimo

Output obbligatori dopo `pmem render --frame current` o `pmem render`:

```text
.codex/memory/current.svg
.codex/memory/current.map.json
.codex/memory/generated/project.json
.codex/memory/generated/files.json
.codex/memory/generated/symbols.json
.codex/memory/generated/modules.json
```

Output opzionali:

```text
.codex/memory/current.png
.codex/memory/frames/*.png
```

Frame v0.1:

```text
current
overview
modules
duplicates
risks
```

`current` può coincidere con `overview` o essere una composizione compatta dei frame principali.

---

## 3. NormalizedGraph

Schema minimo:

```ts
interface NormalizedGraph {
  version: 1;
  project: {
    name: string;
    status: MemoryStatus;
    generatedAt?: string;
  };
  modules: GraphModule[];
  files: GraphFile[];
  symbols: GraphSymbol[];
  routes: GraphRoute[];
  warnings: GraphWarning[];
  duplicateCandidates: GraphDuplicateCandidate[];
  edges: GraphEdge[];
  criticalRules: string[];
}
```

Regole canoniche:

- array ordinati stabilmente per `id`, `path`, `fqName` o chiave documentata;
- nessun dato random;
- nessun path assoluto;
- nessun dump codice;
- generated files visualizzati solo se utili o rischiosi;
- `generatedAt` ammesso nel JSON leggibile, ma escluso da `sourceHash` e da SVG deterministico se rompe byte-stability.

---

## 4. Generated JSON

File minimi:

```text
generated/project.json
generated/files.json
generated/symbols.json
generated/modules.json
```

Invarianti:

1. JSON compatto o pretty deterministico, ma formato scelto deve restare stabile.
2. Chiavi ordinate in modo canonico se il valore viene usato per hashing.
3. Nessun path assoluto.
4. Nessun codice sorgente esteso.
5. Nessun timestamp volatile in file usati per test byte-for-byte.
6. Ogni file è scritto atomicamente.

---

## 5. SVG deterministico

Invarianti SVG:

1. `viewBox` presente.
2. Stesso `NormalizedGraph` canonico -> stesso SVG byte-for-byte.
3. Testo XML-escaped.
4. Nessun asset remoto.
5. Nessun font file incorporato.
6. Layout semplice a griglia; niente algoritmo random/force-directed.
7. Elementi visibili con `data-pmem-id` coerente con map JSON.
8. SVG valido anche con 0 moduli o 0 simboli.
9. Label abbreviate in modo deterministico.

Struttura consigliata:

```xml
<svg viewBox="0 0 1600 1000" xmlns="http://www.w3.org/2000/svg" role="img">
  <title>Codex Project Memory</title>
  <g id="frame-header">...</g>
  <g id="modules">...</g>
  <g id="warnings">...</g>
  <g id="legend">...</g>
</svg>
```

---

## 6. Map JSON

Schema minimo:

```json
{
  "version": 1,
  "frame": "overview",
  "svg": ".codex/memory/frames/overview.svg",
  "png": null,
  "sourceHash": "sha256:...",
  "items": [
    {
      "id": "module:access",
      "kind": "module",
      "label": "Access",
      "bbox": { "x": 120, "y": 180, "width": 220, "height": 90 },
      "paths": ["src/access/access.service.ts"],
      "symbols": ["AccessService"],
      "commands": ["pmem query \"access\" --json"]
    }
  ]
}
```

Invarianti map:

- ogni item visibile ha `id`, `kind`, `bbox`;
- `bbox` usa numeri finiti non negativi;
- `paths` sono relativi POSIX;
- `commands` sono sicuri e read-only, salvo comandi memoria (`pmem query`, `pmem frame`, `pmem render`, `pmem refresh --changed-only`);
- nessun path assoluto locale;
- `png` può essere `null`;
- map JSON valido anche se PNG non esiste;
- map e SVG devono riferirsi agli stessi `data-pmem-id`.

---

## 6.1 Algoritmo layout canonico v0.1

Per evitare interpretazioni libere, il layout `overview/current` usa questo algoritmo base:

```text
canvasWidth = 1600
headerHeight = 96
margin = 40
moduleCardWidth = 280
moduleCardHeight = 120
gapX = 32
gapY = 32
columns = max(1, floor((canvasWidth - 2*margin + gapX) / (moduleCardWidth + gapX)))

sort modules by id asc
for each module at index i:
  col = i % columns
  row = floor(i / columns)
  x = margin + col * (moduleCardWidth + gapX)
  y = headerHeight + margin + row * (moduleCardHeight + gapY)
  id = "module:" + module.id

inside each module card:
  show module.name
  show up to 4 files/symbols sorted by path/fqName asc
  if more items exist, show deterministic "+N more" label

warnings panel:
  below module grid
  sort severity critical > warning > info, then file path asc, message asc
  show maxWarnings from config.render.maxWarnings
```

Frame variants:

| Frame | Data emphasis | Layout difference |
|---|---|---|
| `current` | compact overview | may equal `overview` in v0.1 |
| `overview` | modules + warnings | canonical grid |
| `modules` | module dependencies | same grid + edge lines sorted |
| `duplicates` | duplicate candidates | list/card layout sorted similarity desc |
| `risks` | critical warnings/rules | warning/rule panels first |

Map id grammar:

```text
module:<moduleId>
file:<relative-posix-path>
symbol:<fqName>
route:<METHOD>:<path>
warning:<warningId>
duplicate:<candidateId>
```

Every visible SVG group must use the same id in `data-pmem-id` and map `items[].id`.

---

## 7. PNG fallback

PNG export:

- è best-effort;
- è disattivabile con `--no-png` o config `render.png=false`;
- non deve bloccare `pmem render` se SVG/map sono validi;
- non deve cancellare SVG/map se fallisce;
- deve salvare warning `png_export_failed` in DB o output comando;
- deve registrare `pngPath=null` / `frames.png_path=NULL` quando fallisce o è disabilitato.

Output CLI coerente:

```json
{
  "ok": true,
  "data": {
    "frame": {
      "frame": "current",
      "svg": ".codex/memory/current.svg",
      "png": null,
      "map": ".codex/memory/current.map.json"
    },
    "pngRequested": true,
    "pngExported": false
  },
  "warnings": ["png_export_failed: sharp native dependency unavailable"]
}
```

---

## 8. Frames registry

Ogni frame registrato in DB deve avere:

```text
id           current|overview|modules|duplicates|risks
frame_type   current|overview|module_map|duplicate_map|risk_map
title        non-empty
svg_path     relative POSIX, not null
png_path     relative POSIX oppure NULL
map_path     relative POSIX, not null
source_hash  sha256:...
generated_at ISO UTC
```

Regole:

- `svg_path` e `map_path` devono puntare a file esistenti al momento della registrazione;
- `png_path` può essere `NULL`;
- update frame è idempotente su `id`;
- path e hash sono aggiornati nella stessa transazione dopo file write riuscita.

---

## 9. Test renderer

| Test | Aspettativa |
|---|---|
| stesso graph due volte | SVG identico byte-for-byte |
| label con `<>&"'` | testo escaped |
| 0 moduli | frame empty-state valido |
| 20 moduli | layout leggibile senza overflow grave |
| PNG disabilitato | `png=null`, nessun warning fatal |
| PNG export fail | warning, exit code successo se SVG/map ok |
| map JSON | ogni item ha id/bbox/path/commands |
| map/SVG id match | ogni `data-pmem-id` visibile ha item map |
| generated JSON | file presenti, validi, senza path assoluti |
| frame registry | `png_path=NULL` accettato |
| atomic write failure | nessun file finale corrotto |

---

## 10. Acceptance renderer v0.1

Renderer accettabile solo se:

1. `pmem render --json` produce `current.svg` e `current.map.json`;
2. `current.png` è opzionale e rappresentato come `null` quando manca;
3. due render su input identico producono SVG identico;
4. map JSON è interrogabile e coerente con SVG;
5. generated JSON non contiene codice sorgente esteso;
6. nessun output pubblico contiene path assoluti;
7. warning PNG non causa exit code errore;
8. renderer non usa AI image generation o layout random;
9. ogni write JSON/SVG/map è atomica;
10. test P4 coprono successo, empty-state, PNG fail e determinismo.

---

## 11. Limiti estetici v0.1

Non cercare estetica premium nella v0.1. Prima affidabilità:

```text
leggibile > bello
stabile > sofisticato
sidecar corretto > rendering complesso
```
