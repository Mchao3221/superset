# @superset-ui/plugin-chart-progress-bar-rank

进度条排名表（Progress Bar Rank）—— 一个 Apache Superset 图表插件。

用于展示一组分类项的**累计构成比排行**，典型场景是「柏拉图关键少数（前 80%）」：
每行一根横向进度条，左侧类目标签（带排名前缀），中间渐变进度条（带浅灰底槽），
右侧为该分类的累计占比数值。数据口径与 `@superset-ui/plugin-chart-pareto` 完全
一致：按度量降序排列，进度条长度即累计占比，同一份数据两个图数字可对得上。

This plugin lives inside the Superset monorepo as a workspace package. It is
registered in `superset-frontend/src/visualizations/presets/MainPreset.ts` under
the `VizType.ProgressBarRank` (`progress_bar_rank`) key, which is what makes it
selectable in the Explore view.

### Usage

Build the plugin from its own directory:

```
npm run build
```

This compiles the CommonJS bundle to `lib/`, the ESM bundle to `esm/`, emits type
declarations, and runs the plugin's tests. To rebuild the ESM bundle whenever the
sources change, run:

```
npm run dev
```

To run only the tests:

```
npm run test
```

### Controls

- **Vital Few Threshold (%)** — 只显示累计占比不超过该值的行（默认 80）。
  排名第一的行始终保留。
- **Rank Prefix** — 类目标签是否带排名前缀（`1. 跌倒`），默认开启。
- **Gradient Start / End Color** — 进度条渐变两端颜色，默认橙色
  `#f0a04a → #e08a16`。