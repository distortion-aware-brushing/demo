import { useEffect, useMemo, useState } from "react";
import { BrushingCanvas } from "@dabrush/web/react";
import type { BrushingCanvasController } from "@dabrush/web";
import { buildDabDataset, parseHdLdCsv, parseRawJson } from "@dabrush/preprocess-js";
import type { DabDataset, DabRawInput } from "@dabrush/schema";
import type { BrushingTechnique, BrushStatus } from "@dabrush/engine";

const techniques: BrushingTechnique[] = ["dab", "sb", "mbb", "ddb"];
const techniqueLabels: Record<BrushingTechnique, string> = {
  dab: "Distortion-aware brushing",
  sb: "Similarity brushing",
  mbb: "M-Ball brushing",
  ddb: "Data-driven brushing"
};
const CANVAS_SIZE = 620;
const GUIDE_STORAGE_KEY = "dabrush-demo-guide-dismissed";

async function fileText(file: File): Promise<string> {
  return file.text();
}

function parseJsonMatrix(text: string, fieldName: "hd" | "ld"): number[][] {
  const parsed: unknown = JSON.parse(text);
  if (Array.isArray(parsed)) return parsed as number[][];
  if (parsed !== null && typeof parsed === "object") {
    const value = (parsed as Record<string, unknown>)[fieldName];
    if (Array.isArray(value)) return value as number[][];
  }
  throw new Error(`${fieldName.toUpperCase()} JSON must be a 2D numeric array or an object with a "${fieldName}" field.`);
}

function buildDataset(raw: DabRawInput): DabDataset {
  const k = Math.min(10, Math.max(1, raw.hd.length - 1));
  return buildDabDataset({
    ...raw,
    similarity: { metric: "snn", k },
    maxNeighbors: Math.min(50, Math.max(1, raw.hd.length - 1))
  });
}

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export default function App() {
  const [dataset, setDataset] = useState<DabDataset | null>(null);
  const [technique, setTechnique] = useState<BrushingTechnique>("dab");
  const [brushes, setBrushes] = useState<BrushStatus[]>([]);
  const [error, setError] = useState<string>("");
  const [hdJson, setHdJson] = useState<File | null>(null);
  const [ldJson, setLdJson] = useState<File | null>(null);
  const [hdCsv, setHdCsv] = useState<File | null>(null);
  const [ldCsv, setLdCsv] = useState<File | null>(null);
  const [controller, setController] = useState<BrushingCanvasController | null>(null);
  const [showingOriginal, setShowingOriginal] = useState(false);
  const [showGuide, setShowGuide] = useState(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem(GUIDE_STORAGE_KEY) !== "true";
  });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}samples/fmnist-small-raw.json`)
      .then((response) => response.json())
      .then((raw) => {
        setDataset(buildDataset(parseRawJson(raw)));
      })
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      });
  }, []);

  const stats = useMemo(() => {
    if (!dataset) return "No dataset loaded";
    return `${dataset.hd.length} points, ${dataset.hd[0]?.length ?? 0}D HD, ${dataset.ld[0]?.length ?? 0}D LD`;
  }, [dataset]);
  const imageGlyph = dataset?.hd[0]?.length === 784;

  const loadJsonPair = async () => {
    if (!hdJson || !ldJson) return;
    try {
      setError("");
      const raw = parseRawJson({
        hd: parseJsonMatrix(await fileText(hdJson), "hd"),
        ld: parseJsonMatrix(await fileText(ldJson), "ld")
      });
      setDataset(buildDataset(raw));
      setShowingOriginal(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const loadCsvPair = async () => {
    if (!hdCsv || !ldCsv) return;
    try {
      setError("");
      const raw = parseHdLdCsv(await fileText(hdCsv), await fileText(ldCsv));
      setDataset(buildDataset(raw));
      setShowingOriginal(false);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    }
  };

  const dismissGuide = () => {
    window.localStorage.setItem(GUIDE_STORAGE_KEY, "true");
    setShowGuide(false);
  };

  const removeBrush = (id: number) => {
    controller?.removeBrush(id);
    setShowingOriginal(false);
  };

  const saveGroups = () => {
    if (!dataset) return;
    downloadJson("dabrush-groups.json", {
      schemaVersion: "dabrush-groups-v1",
      generatedAt: new Date().toISOString(),
      dataset: {
        points: dataset.hd.length,
        hdDimensions: dataset.hd[0]?.length ?? 0,
        ldDimensions: dataset.ld[0]?.length ?? 0
      },
      technique,
      groups: brushes.map((brush) => ({
        id: brush.id,
        label: `C${brush.id + 1}`,
        color: brush.color,
        isCurrent: brush.isCurrent,
        count: brush.points.length,
        points: brush.points
      }))
    });
  };

  return (
    <main className="app">
      <header className="appHeader">
        <div className="brand">
          <h1>Distortion-aware brushing demo</h1>
          <p>{stats}</p>
        </div>
      </header>

      {error && <p className="error">{error}</p>}

      {showGuide && (
        <div className="guideOverlay" role="dialog" aria-modal="true" aria-labelledby="guide-title">
          <div className="guideDialog">
            <h2 id="guide-title">How to use Distortion-aware brushing</h2>
            <ol>
              <li>
                Hover over the points you want to brush and wait a moment. The nearby points will relocate to show
                attraction and repulsion in the original high-dimensional space.
              </li>
              <li>
                Press and drag to start brushing. After another short moment, the lens appears and the brushed region
                keeps updating as you move.
              </li>
              <li>
                Use <strong>See Original</strong> to compare the current relocated view with the original projection.
              </li>
            </ol>
            <button type="button" onClick={dismissGuide}>
              Start brushing
            </button>
          </div>
        </div>
      )}

      <section className="workspace">
        <div className="canvasPanel">
          {dataset && (
            <BrushingCanvas
              key={`${technique}-${dataset.hd.length}-${dataset.hd[0]?.length ?? 0}`}
              dataset={dataset}
              implementation="original"
              technique={technique}
              width={CANVAS_SIZE}
              height={CANVAS_SIZE}
              painterRadius={34}
              pointSize={imageGlyph ? 16 : 5}
              pointGlyph={
                imageGlyph
                  ? {
                      type: "image",
                      pixelWidth: 28,
                      pixelHeight: 28,
                      inverted: true,
                      removeBackground: true
                    }
                  : { type: "dot" }
              }
              initialRelocationDelay={500}
              initialRelocationDuration={650}
              brushRelocationDuration={320}
              background="#ffffff"
              onReady={setController}
              onBrushChange={setBrushes}
              style={{ width: CANVAS_SIZE, height: CANVAS_SIZE }}
            />
          )}
        </div>
        <aside className="sidePanel">
          <section className="controlGroup" aria-label="Brushing controls">
            <h2>Controls</h2>
            <label>
              Technique
              <select value={technique} onChange={(event) => setTechnique(event.target.value as BrushingTechnique)}>
                {techniques.map((item) => (
                  <option value={item} key={item}>
                    {techniqueLabels[item]}
                  </option>
                ))}
              </select>
            </label>
            <div className="buttonRow">
              <button
                type="button"
                onClick={() => {
                  controller?.addBrush();
                  setShowingOriginal(false);
                }}
                disabled={!controller}
              >
                Add Brush
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!controller) return;
                  if (showingOriginal) {
                    controller.restoreBrushing?.();
                    setShowingOriginal(false);
                  } else {
                    controller.showOriginal?.();
                    setShowingOriginal(true);
                  }
                }}
                disabled={!controller}
              >
                {showingOriginal ? "Back to Brushing" : "See Original"}
              </button>
            </div>
          </section>

          <section className="controlGroup" aria-label="Dataset controls">
            <h2>Data</h2>
            <label>
              HD JSON
              <input type="file" accept=".json,application/json" onChange={(event) => setHdJson(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              LD JSON
              <input type="file" accept=".json,application/json" onChange={(event) => setLdJson(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={loadJsonPair} disabled={!hdJson || !ldJson}>
              Load JSON Pair
            </button>
            <label>
              HD CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => setHdCsv(event.target.files?.[0] ?? null)} />
            </label>
            <label>
              LD CSV
              <input type="file" accept=".csv,text/csv" onChange={(event) => setLdCsv(event.target.files?.[0] ?? null)} />
            </label>
            <button type="button" onClick={loadCsvPair} disabled={!hdCsv || !ldCsv}>
              Load CSV Pair
            </button>
          </section>

          <div className="brushHeader">
            <h2>Brushes</h2>
            <button type="button" onClick={saveGroups} disabled={!dataset || brushes.length === 0}>
              Download Groups
            </button>
          </div>
          {brushes.length === 0 && <p>No brush activity yet.</p>}
          {brushes.map((brush) => (
            <div className="brushRow" key={brush.id}>
              <span style={{ backgroundColor: brush.color }} />
              <button
                type="button"
                className="trashButton"
                onClick={() => removeBrush(brush.id)}
                disabled={!controller || brushes.length <= 1}
                aria-label={`Remove C${brush.id + 1}`}
                title={`Remove C${brush.id + 1}`}
              >
                Trash
              </button>
              <strong>C{brush.id + 1}</strong>
              <em>{brush.points.length} points</em>
            </div>
          ))}
        </aside>
      </section>
    </main>
  );
}
