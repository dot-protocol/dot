# USER_MANUAL — variance-detection

Cancer-variance detection toolkit: proves that cancer cells (defectors from cellular cooperation) have measurably higher gene expression variance than healthy cells, enabling cancer detection from stability alone using a single feature.

---

## What It Is

Two Python scripts implement a mathematical proof of one hypothesis: **variance is the defection signal**. No neural net, no feature engineering — just per-cell variance across gene expression programs compared between healthy (cooperator) and cancerous (defector) cells.

- **Stage 1–2 (synthetic):** `variance_detection_proof.py` — full self-contained simulation. No external datasets required.
- **Stage 3 (real data):** `real_data_connector.py` — plug-and-play adapter for TCGA, Human Cell Atlas, GEO, and Tabula Sapiens.

---

## Install

```bash
# Stage 1 + 2 only (synthetic proof)
pip install numpy scipy matplotlib scikit-learn

# Stage 3 (real scRNA-seq data)
pip install scanpy anndata pandas numpy scipy scikit-learn
```

Python 3.9+ required. No CUDA required. Runs on CPU.

---

## Run

### Synthetic proof (stages 1 + 2) — no data download needed

```bash
python variance_detection_proof.py
```

Expected output:

```
STAGE 1: COOPERATIVE NETWORK SIMULATION
  Cooperator variance:  0.0025 ± ...
  Defector variance:    0.0060 ± ...
  Separation ratio:     2.4x
  Cohen's d:            5.31
  F1 score:             1.000
  AUC:                  1.000
  p-value:              <1e-165

STAGE 2: GENE EXPRESSION SIMULATION
  Separation ratio:     1853x-1868x
  F1 score:             1.000
  AUC:                  1.000
```

The script also writes a publication-quality figure (`figure1.png`) via matplotlib.

### Real data (stage 3)

```bash
python real_data_connector.py
```

The connector auto-downloads public datasets from TCGA / HCA / GEO and runs the same variance test on real cells. Internet connection required on first run. Subsequent runs use cached data.

---

## Core API (Python import)

`real_data_connector.py` exports one function intended for reuse:

```python
from real_data_connector import run_variance_test
import numpy as np

# healthy_expr: (n_healthy_cells, n_genes) log-normalized float32
# cancer_expr:  (n_cancer_cells, n_genes)  log-normalized float32
results = run_variance_test(healthy_expr, cancer_expr, dataset_name="My Dataset")

# Returns dict:
# {
#   'separation': float,    # cancer_variance / healthy_variance ratio
#   'cohens_d': float,      # effect size
#   'f1': float,            # F1 at midpoint threshold
#   'auc': float,           # ROC-AUC
#   'p_value': float,       # Mann-Whitney U one-sided p
#   'healthy_mean_var': float,
#   'cancer_mean_var': float,
# }
print(results['separation'], results['f1'])
```

**Input contract:**
- Both matrices must be log-normalized (log1p recommended, matching scRNA-seq convention)
- Genes must be aligned across matrices (same columns)
- Cells are rows; genes are columns
- No NaN/Inf values

---

## Inputs / Outputs

| Script | Inputs | Outputs |
|---|---|---|
| `variance_detection_proof.py` | None (synthetic) | stdout metrics + `figure1.png` |
| `real_data_connector.py` | Internet (auto-downloads datasets) | stdout metrics per dataset |
| `run_variance_test()` | two float32 numpy arrays | dict of 7 metric fields |

---

## Observe State

The scripts are stateless and print all results to stdout. There is no daemon, no server, no database.

```bash
# Check if proof ran successfully
python variance_detection_proof.py | grep "F1 score"
# Expected: F1 score: 1.000 (both stages)

# Check real-data connector dependency graph
python -c "import scanpy, anndata, sklearn; print('deps OK')"
```

---

## Troubleshooting

**`ModuleNotFoundError: No module named 'scanpy'`**
→ Run `pip install scanpy anndata`. Only needed for stage 3.

**`ModuleNotFoundError: No module named 'matplotlib'`**
→ Run `pip install matplotlib`. Needed for the figure in stage 1+2.

**Stage 3 hangs on download**
→ TCGA/HCA datasets are large (GBs). First run can take 10–30 min depending on connection. `real_data_connector.py` prints progress via `scanpy`'s logging.

**Stage 2 separation ratio differs from paper**
→ Expected. `np.random.seed(42)` is set but cell counts and gene counts vary slightly between numpy versions. The hypothesis holds: separation >> 1 and F1 = 1.000 regardless.

**`figure1.png` not written**
→ The backend is forced to `Agg` (non-interactive). The file writes to the working directory. Check write permissions.

---

## Dataset Sources

| Source | What | URL |
|---|---|---|
| TCGA | 20,000+ tumor bulk RNA-seq | tcga-data.nci.nih.gov |
| Human Cell Atlas | 50M+ single cells | humancellatlas.org |
| GEO | General Expression Omnibus | ncbi.nlm.nih.gov/geo |
| Tabula Sapiens | Multi-tissue human cell atlas | tabula-sapiens.ds.czbiohub.org |

---

## Files

| File | What |
|---|---|
| `variance_detection_proof.py` | Full synthetic simulation (stages 1–2). Standalone. |
| `real_data_connector.py` | Real-data adapter (stage 3). Exports `run_variance_test()`. |
| `arxiv/main.tex` | LaTeX source for the arXiv paper |
| `arxiv/main.pdf` | Compiled 9-page paper |
| `arxiv/figure1.png` | Publication figure |

## License

CC BY 4.0. Cite as: Merchant, S.M.S.B. (2026). "Variance as a Universal Defection Signal." DOT Protocol / Council of Minds.

