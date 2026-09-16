/**
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 *   http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */
import {
  ChartProps,
  getMetricLabel,
  getNumberFormatter,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import { ParetoChartFormData, ParetoTransformedProps } from '../types';
import buildParetoData from '../utils/paretoData';

/** Threshold that a healthy Pareto distribution crosses for most categories. */
const EIGHTY_PERCENT = 80;

// 三档柱子配色：第一根柱子单独高亮，累计占比 ≤ 80% 的「关键少数」用橙色，
// 其余「次要多数」用蓝色。固定色值而不是走分类调色板，保证 80/20 的语义
// 在任何数据集下都能一眼认出来（与 EIGHTY_LINE_COLOR 同理）。
const FIRST_BAR_COLOR = '#df4343';
const KEY_BARS_COLOR = '#e08a16';
const OTHER_BARS_COLOR = '#2e7dd1';

/**
 * 累计曲线的颜色。
 *
 * 同样取固定色值而不是走分类调色板：这条线是叠加在柱子之上的第二套读数，
 * 走调色板会被分配成某根柱子的同色，两条线就分不开了。
 *
 * 注意它与 KEY_BARS_COLOR 是同一个值：曲线和「关键少数」那批柱子同色，
 * 靠线宽与空心拐点标记区分两者。
 */
const CUMULATIVE_LINE_COLOR = '#e08a16';
/** 累计曲线的线宽。 */
const CUMULATIVE_LINE_WIDTH = 4;
/** 累计曲线拐点标记的直径。空心圈比实心点显瘦，跟着线宽一起放大。 */
const CUMULATIVE_SYMBOL_SIZE = 9;

/**
 * 柱子的最大宽度：原先 56px，再放宽 15%。
 *
 * 类目多到把绘图区挤满时，柱宽由类目宽度决定，这个值不起作用；类目少时
 * 它才是实际柱宽。
 */
const BAR_MAX_WIDTH = 64;

/**
 * 坐标轴刻度与轴名的字号。
 *
 * ECharts 默认 12px，在仪表盘里偏小；横纵坐标统一抬到 16px，两侧保持一致。
 */
const AXIS_LABEL_FONT_SIZE = 16;

const formatPercent = (value: number) => `${value.toFixed(1)}%`;

/**
 * 80% 阈值线的颜色。
 *
 * 用固定的状态色，而不是分类调色板色：这是一条阈值标注，不是数据系列。
 * 走调色板的话，它的颜色会被分配成某根柱子的同色，标注就淹没在数据里了。
 * `#d03b3b` 在浅色表面 (#ffffff) 与深色表面 (#141414) 上的对比度分别为
 * 4.80 与 3.83，都满足 3:1。因此这条线不叠加透明度 —— 0.6 透明度会把
 * 对比度压到 2.56 / 2.09，跌破可读下限。
 */
const EIGHTY_LINE_COLOR = '#d03b3b';

/** 80/20 分界线的标签。80/20 与语言无关，无需翻译。 */
const EIGHTY_TWENTY_LABEL = '';

/**
 * 累计曲线与 80% 水平线交点所在的横坐标（类别下标，可能是小数）。
 * 这是「关键少数」与「次要多数」的分界位置。
 *
 * 交点通常落在两个类别之间，所以要对相邻两点做线性插值，而不是直接取
 * 「首个达到 80%」的那个类别 —— 那样线会画在那个类别的正中间，和真实
 * 交点错开小半格，看起来就是两条线各交各的。
 *
 * 整条曲线都没到 80% 时返回 -1（例如总量为 0，累计占比恒为 0），
 * 调用方据此跳过绘制，避免画出一条没有意义的线。
 */
function findEightyTwentyPosition(cumulativePct: number[]): number {
  const upper = cumulativePct.findIndex(pct => pct >= EIGHTY_PERCENT);
  if (upper < 0) {
    return -1;
  }
  if (upper === 0) {
    // 第一个类别就到 80% 了，交点在绘图区左边界之外，贴着左边界画。
    return 0;
  }
  const lower = upper - 1;
  const span = cumulativePct[upper] - cumulativePct[lower];
  if (span <= 0) {
    // 相邻两点相等时无从插值，退化为落在后一个类别上。
    return upper;
  }
  return lower + (EIGHTY_PERCENT - cumulativePct[lower]) / span;
}

export default function transformProps(
  chartProps: ChartProps,
): ParetoTransformedProps {
  const { width, height, formData, queriesData } = chartProps;
  // ChartProps camelCases formData before the chart sees it, so the control
  // names arrive here as showCumulativeLine / yAxisFormat / ..., not in the
  // snake_case the control panel declares them with.
  const {
    groupby = [],
    metric,
    showCumulativeLine = true,
    showEightyLine = true,
    showEightyTwentyLine = true,
    yAxisFormat,
  } = formData as ParetoChartFormData;

  const metricLabel = getMetricLabel(metric);
  const rawRows = queriesData?.[0]?.data ?? [];
  const { rows } = buildParetoData({ rows: rawRows, groupby, metricLabel });

  if (!rows.length) {
    return {
      width,
      height,
      echartOptions: {
        title: {
          text: t('No data'),
          left: 'center',
          top: 'middle',
          textStyle: { fontSize: 14, fontWeight: 'normal' },
        },
      },
    };
  }

  const categories = rows.map(datum => datum.category);
  const values = rows.map(datum => datum.value);
  const cumulativePct = rows.map(datum => datum.cumulativePct);
  const eightyTwentyPosition = findEightyTwentyPosition(cumulativePct);

  const numberFormatter = getNumberFormatter(yAxisFormat);
  const cumulativeName = t('Cumulative %');

  // 每根柱子按 80/20 规则取固定色：第一根永远高亮，累计占比 ≤ 80% 的
  // 归属「关键少数」，其余是「次要多数」。
  const barData = values.map((value, index) => {
    let color = OTHER_BARS_COLOR;
    if (index === 0) {
      color = FIRST_BAR_COLOR;
    } else if (cumulativePct[index] <= EIGHTY_PERCENT) {
      color = KEY_BARS_COLOR;
    }
    return { value, itemStyle: { color } };
  });

  const echartOptions: EChartsCoreOption = {
    // Re-lays out on container resize; Echart also calls resize() explicitly.
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
    },
    legend: {
      top: 4,
      data: showCumulativeLine ? [metricLabel, cumulativeName] : [metricLabel],
    },
    grid: {
      left: 12,
      right: 12,
      top: 48,
      bottom: 8,
      containLabel: true,
    },
    xAxis: [
      {
        type: 'category',
        data: categories,
        axisTick: { alignWithLabel: true },
        axisLabel: {
          interval: 0,
          hideOverlap: true,
          rotate: categories.length > 8 ? 45 : 0,
          fontSize: AXIS_LABEL_FONT_SIZE,
        },
      },
      // 只为 80/20 分界线服务的隐藏数值轴。
      // ECharts 的类目轴会把小数下标四舍五入到整数（见 Ordinal.js 的
      // getRawOrdinalNumber），画不出落在两格之间的线，而 80% 的位置通常
      // 正在两格之间。数值轴的 min/max 取 -0.5 ~ n-0.5 时，值 v 的像素位置
      // 是 (v + 0.5) / n，与类目轴第 v 个类目的中心完全重合。
      {
        type: 'value' as const,
        show: false,
        min: -0.5,
        max: categories.length - 0.5,
        // 与类目轴共用同一个网格，不关掉的话悬停时会多出一条指示线。
        axisPointer: { show: false },
      },
    ],
    yAxis: [
      {
        type: 'value',
        name: metricLabel,
        nameTextStyle: { align: 'left', fontSize: AXIS_LABEL_FONT_SIZE },
        axisLabel: {
          formatter: (value: number) => numberFormatter(value),
          fontSize: AXIS_LABEL_FONT_SIZE,
        },
        splitLine: { lineStyle: { type: 'dashed' } },
      },
      ...(showCumulativeLine
        ? [
            {
              type: 'value' as const,
              name: cumulativeName,
              nameTextStyle: { align: 'right', fontSize: AXIS_LABEL_FONT_SIZE },
              min: 0,
              max: 100,
              // A right-hand percentage axis needs no gridlines of its own.
              splitLine: { show: false },
              axisLabel: {
                formatter: (value: number) => `${value}%`,
                fontSize: AXIS_LABEL_FONT_SIZE,
              },
            },
          ]
        : []),
    ],
    series: [
      {
        name: metricLabel,
        type: 'bar',
        yAxisIndex: 0,
        // 每根柱子自带颜色（80/20 三档规则），series 层不再另设 itemStyle.color。
        data: barData,
        barMaxWidth: BAR_MAX_WIDTH,
        itemStyle: { borderRadius: [3, 3, 0, 0] },
        tooltip: { valueFormatter: (value: number) => numberFormatter(value) },
      },
      ...(showCumulativeLine
        ? [
            {
              name: cumulativeName,
              type: 'line' as const,
              yAxisIndex: 1,
              data: cumulativePct,
              // 空心圈：ECharts 的 empty* 记号只描边不填充，描边色取自
              // itemStyle.color，图例里也会跟着显示成同一条线的颜色。
              symbol: 'emptyCircle',
              symbolSize: CUMULATIVE_SYMBOL_SIZE,
              // Above the bars so the vertex markers are never clipped.
              z: 3,
              lineStyle: { width: CUMULATIVE_LINE_WIDTH, color: CUMULATIVE_LINE_COLOR },
              itemStyle: { color: CUMULATIVE_LINE_COLOR },
              tooltip: { valueFormatter: (value: number) => formatPercent(value) },
              ...(showEightyLine
                ? {
                    markLine: {
                      silent: true,
                      symbol: 'none',
                      lineStyle: {
                        type: 'dashed' as const,
                        color: EIGHTY_LINE_COLOR,
                        width: 2,
                      },
                      label: {
                        formatter: `${EIGHTY_PERCENT}%`,
                        position: 'insideEndTop' as const,
                      },
                      data: [{ yAxis: EIGHTY_PERCENT }],
                    },
                  }
                : {}),
            },
          ]
        : []),
      // 80/20 分界线。走隐藏的数值轴，才能落在「累计曲线穿过 80% 水平线」
      // 的那个交点上；挂在类目轴上会被四舍五入到最近的类别。
      // 右轴固定 0~100，所以同一横坐标上的这两个点正好贯穿整个绘图区。
      ...(showEightyTwentyLine && showCumulativeLine && eightyTwentyPosition >= 0
        ? [
            {
              name: EIGHTY_TWENTY_LABEL,
              type: 'line' as const,
              xAxisIndex: 1,
              yAxisIndex: 1,
              data: [
                [eightyTwentyPosition, 0],
                [eightyTwentyPosition, 100],
              ],
              showSymbol: false,
              silent: true,
              lineStyle: {
                type: 'dashed' as const,
                color: EIGHTY_LINE_COLOR,
                width: 2,
              },
              tooltip: { show: false },
            },
          ]
        : []),
    ],
  };

  return { width, height, echartOptions };
}
