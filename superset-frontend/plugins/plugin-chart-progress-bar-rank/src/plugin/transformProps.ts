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
import { ChartProps, getMetricLabel } from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import type { EChartsCoreOption } from 'echarts/core';
import type { CallbackDataParams } from 'echarts/types/src/util/types';
import {
  ProgressBarRankChartFormData,
  ProgressBarRankTransformedProps,
  RgbaColor,
} from '../types';
import buildProgressData, { filterVitalFew } from '../utils/progressData';

/** 每根进度条的高度（px），与图表的 barWidth 一致。 */
const BAR_HEIGHT = 18;
/** 行间距：barCategoryGap 为 40%，即行高的 40%。 */
const BAR_GAP = BAR_HEIGHT * 0.4;
/** 绘图区上下留白（grid.top + grid.bottom）。 */
const VERTICAL_PADDING = 20;
/** 只有一两行时也要保证的最小绘图区高度。 */
const MIN_AREA_HEIGHT = 44;

/** 渐变起始色默认值 #f0a04a。 */
const START_COLOR_FALLBACK: RgbaColor = { r: 240, g: 160, b: 74, a: 1 };
/** 渐变结束色默认值 #e08a16。 */
const END_COLOR_FALLBACK: RgbaColor = { r: 224, g: 138, b: 22, a: 1 };

/** 底槽颜色（进度条背后的浅色轨道）。 */
const TRACK_COLOR = '#edf2f8';
/** 类目标签颜色。 */
const CATEGORY_LABEL_COLOR = '#40536e';
/** 进度条右侧数值标签颜色。 */
const VALUE_LABEL_COLOR = '#22324a';

/**
 * 把控件吐出的颜色对象转成 ECharts 渐变可用的 CSS 颜色字符串。
 * 两个控件都用 {r,g,b,a}；缺失字段时回退到对应默认值。
 */
function toRgb(color: RgbaColor | undefined, fallback: RgbaColor): string {
  const { r, g, b } = { ...fallback, ...(color ?? {}) };
  return `rgb(${r}, ${g}, ${b})`;
}

/** 保留一位小数的百分比文本，如 76.4 -> "76.4"；非数值原样返回。 */
function toPercent(value: unknown): string {
  return typeof value === 'number' ? value.toFixed(1) : String(value ?? '');
}

/** ECharts series data 的元素：数值 + 供 tooltip 使用的原始类目名。 */
interface RankItem {
  value: number;
  category: string;
}

export default function transformProps(
  chartProps: ChartProps,
): ProgressBarRankTransformedProps {
  const { width, height, formData, queriesData } = chartProps;
  // ChartProps camelCases formData before the chart sees it, so the control
  // names arrive here as vitalFewThreshold / showRankPrefix / ..., not in the
  // snake_case the control panel declares them with.
  const {
    groupby = [],
    metric,
    vitalFewThreshold = 80,
    showRankPrefix = true,
    progressStartColor,
    progressEndColor,
  } = formData as ProgressBarRankChartFormData;

  const metricLabel = getMetricLabel(metric);
  const rawRows = queriesData?.[0]?.data ?? [];
  const progressRows = buildProgressData({
    rows: rawRows,
    groupby,
    metricLabel,
  });
  const visibleRows = filterVitalFew(progressRows, vitalFewThreshold);

  if (!visibleRows.length) {
    return {
      width,
      height,
      chartAreaHeight: height,
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

  const startColor = toRgb(progressStartColor, START_COLOR_FALLBACK);
  const endColor = toRgb(progressEndColor, END_COLOR_FALLBACK);

  const items: RankItem[] = visibleRows.map((row, index) => ({
    value: row.cumulativePct,
    category: showRankPrefix ? `${index + 1}. ${row.category}` : row.category,
  }));

  // 行数少时压缩绘图区高度，避免大面积留白；行数多时不超过容器高度。
  const n = items.length;
  const chartAreaHeight = Math.min(
    Math.max(
      VERTICAL_PADDING + n * BAR_HEIGHT + (n - 1) * BAR_GAP,
      MIN_AREA_HEIGHT,
    ),
    height,
  );

  const percentValue = (params: CallbackDataParams) => `${toPercent(params.value)}%`;

  const echartOptions: EChartsCoreOption = {
    tooltip: {
      trigger: 'item',
      axisPointer: { type: 'shadow' },
      formatter: (params: CallbackDataParams) => {
        const item = params.data as RankItem;
        return `${params.marker}${item.category}: ${toPercent(item.value)}%`;
      },
    },
    // 左侧 90px 预留给类目标签，右侧 60px 预留给数值标签；
    // 采用包含标签的布局，保证标签不被裁切。
    grid: {
      left: 90,
      right: 60,
      top: 10,
      bottom: 10,
      containLabel: false,
    },
    xAxis: {
      type: 'value' as const,
      max: 100,
      show: false,
    },
    yAxis: {
      type: 'category' as const,
      data: items.map(item => item.category),
      // 排名第一行显示在顶部。
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: {
        show: true,
        color: CATEGORY_LABEL_COLOR,
        fontSize: 12,
        // 类目名过长时截断加省略号，避免把标签画到绘图区外面。
        overflow: 'truncate',
      },
    },
    series: [
      {
        type: 'bar' as const,
        data: items,
        barWidth: BAR_HEIGHT,
        barCategoryGap: '40%',
        showBackground: true,
        backgroundStyle: {
          color: TRACK_COLOR,
          borderRadius: 7,
        },
        itemStyle: {
          color: {
            type: 'linear' as const,
            x: 0,
            y: 0,
            x2: 1,
            y2: 0,
            colorStops: [
              { offset: 0, color: startColor },
              { offset: 1, color: endColor },
            ],
          },
          borderRadius: [0, 7, 7, 0],
        },
        label: {
          show: true,
          position: 'right',
          formatter: percentValue,
          color: VALUE_LABEL_COLOR,
          fontWeight: 700,
          fontSize: 12,
        },
        tooltip: {
          formatter: (params: CallbackDataParams) => {
            const item = params.data as RankItem;
            return `${params.marker}${item.category}: ${toPercent(item.value)}%`;
          },
        },
      },
    ],
  };

  return { width, height, echartOptions, chartAreaHeight };
}