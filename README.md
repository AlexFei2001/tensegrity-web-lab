# Tensegrity Web Lab · 张拉整体结构实验

This repository documents my work during my internship at the Politecnico di Milano.

A single project combining the existing Grasshopper tensegrity model, a native Kangaroo perturbation experiment and a trilingual web teaching lab.

**[Live website / 在线网站](https://tensegrity-web-lab.grand-swift-1773.chatgpt.site)** · 中文 / English / Italiano

## 项目内容 / Contents

| Path | Purpose |
|---|---|
| tensegritydemo 3prism_2026.ghx | Current saved design, retaining the existing Kangaroo / Opossum / Karamba workflow |
| tensegrity_perturbation_lab.ghx | Saved version with the added ±0.1 mm perturbation lab |
| grasshopper/ | Embedded script sources, installer and GH sample export helpers |
| web/ | Three-language 3D teaching site, real recorded GH samples and GA/PSO/SA interactions |
| data/ | Historical audit, recorded numerical evidence and optimization archive |
| docs/ | Model mapping, mechanics, export and teaching notes |
| tests/ | Browser DOM, dataset and numerical regression checks |

These are two saved versions of the same project, not synchronized files. Changes to one GH document do not automatically update the other or the website. Historical sample hashes and the 725-object audit refer to the earlier model snapshot; the current saved design may contain later edits.

## 网页运行 / Run the website

Node.js 22.12+ or a supported newer version:

```sh
npm ci
npm test
npm run dev
# http://127.0.0.1:5173/
npm run build
```

Deploy web/dist to a static hosting provider. The existing public site is hosted separately on Sites; pushing to GitHub does not automatically deploy it. No Rhino installation is needed to browse the website.

## Grasshopper 使用

1. Use Rhino 8 + Grasshopper with Kangaroo 2. The original design also contains Opossum and Karamba components; install matching plugins where those branches are needed. Plugins are not bundled. Historical versions are documented in docs/model_audit.md.
2. Open tensegrity_perturbation_lab.ghx to inspect the added experiment, or the original-named GHX for the current saved design. Units are meters; Amplitude is entered in millimeters.
3. In the perturbation group set Amplitude=0.1, Steps=300000, Run=True. Inspect Report, LambdaMin, GainMinus/Plus and the optional Chart preview. Run=False pauses computation; changed inputs hide obsolete results.
4. The experiment reads the actual model's equilibrium nodes and clones its Spring/Anchor/Unary goals into independent control and ±perturbation systems. It does not overwrite the original solver or optimize automatically.

See [小扰动实验说明](docs/perturbation_lab.md) and [导出指南](docs/export_guide.md). The standalone installer should only be used on a document without that group; its code is already embedded in the supplied lab GHX. Create data/stability if installing into a newly reorganized checkout.

## 数值结果与限制 / Interpretation

The web Physics section contains 11 exported GH samples, not a live cloud Kangaroo service. GA/PSO/SA demonstrate the Rastrigin objective; those mathematical runs are not new structural evaluations. The historical Opossum archive remains unverified.

At the historical angle 185.748°, the axial-spring model first lost lateral tangent stability near P=0.563476, u=0.302587 m, before the visible flip near P=0.672. These are model-specific results, not universal load limits or calibrated steel-rope capacities. A later on-canvas check at 178.453° showed decay at P=0.55 and amplification at P=0.58. The distinction matters when reproducing results.

The perturbation tool assumes the existing 87-node topology, straight taut cables and native axial springs with finite anchors. It does not include rod flexural buckling, material fracture, imperfections or physical-time dynamics. Force units/material EA remain uncalibrated. Decay over a finite solver budget is not proof of global stability.

## License / 许可

This repository retains the original MIT license selected by AlexFei2001. Third-party plugins, dependencies and upstream contributions retain their respective licenses and attribution. No private photos, lecture documents, credentials, logs or backup models are included.

## Verification

Verified on 2026-11-02: **36/36 tests passed**, production web build passed, and both original GHX files were uploaded without line-ending conversion. This publication session did not run a new Rhino/Grasshopper solve or browser visual review.

Existing regression checks cover 36 cases: trilingual DOM behavior, real sample geometry/schema, deterministic algorithms, stiffness/eigenpair checks and recorded native perturbation evidence. Running npm test rechecks saved evidence; it does not launch Rhino. A fresh clone's GH document must be solved and inspected in Rhino separately.
