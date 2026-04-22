# dab-demo

Vite React demo for the DAB library split.

The demo shows the intended end-to-end workflow:

```txt
preloaded or uploaded HD/LD data
  -> @dabrush/preprocess-js
  -> @dabrush/web
  -> interactive Canvas brushing
```

## Run

```bash
yarn install
yarn dev
```

Open the printed Vite URL.

## Included Data

The default sample is a 300-point Fashion-MNIST subset:

- `hd`: `300 x 784`
- `ld`: `300 x 2`
- labels: balanced across four source labels
- glyph rendering: `28 x 28` monochrome image glyphs

The low-dimensional coordinates are loaded from the existing source data. The demo does not compute PCA, UMAP, or t-SNE.

## Upload Your Own Data

The demo accepts HD and LD as separate files.

JSON:

- `HD JSON`: a `number[][]` matrix, or an object with an `hd` field
- `LD JSON`: a `number[][]` matrix, or an object with an `ld` field

CSV:

- `HD CSV`: `n x m` numeric matrix
- `LD CSV`: `n x 2` numeric matrix

Rows must align. `hd[i]` and `ld[i]` are the same point.

## Techniques

- Distortion-aware brushing
- Similarity brushing
- M-Ball brushing
- Data-driven brushing

## Build

```bash
yarn build
```
