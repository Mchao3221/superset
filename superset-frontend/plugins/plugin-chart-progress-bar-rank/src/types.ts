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
import { QueryFormData, QueryFormMetric } from '@superset-ui/core';
import type { EChartsCoreOption } from 'echarts/core';

/** RGB 颜色对象，形式与 ColorPickerControl 控件吐出的值一致。 */
export interface RgbaColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/**
 * Raw form data, keyed exactly as the control panel declares it. This is the
 * shape `buildQuery` receives, straight from the Explore / dashboard state.
 */
export interface ProgressBarRankFormData extends QueryFormData {
  /** Category dimension(s). Multiple columns are joined into one label. */
  groupby?: string[];
  /** The metric being ranked. A rank chart ranks exactly one measure. */
  metric: QueryFormMetric;
  /** 关键少数阈值（百分比）：累计占比不超过它的行才会显示（默认 80）。 */
  vital_few_threshold?: number;
  /** 类目标签是否带排名前缀「1. 2. 3. …」（默认 true）。 */
  show_rank_prefix?: boolean;
  /** 进度条渐变起始色（默认橙 #f0a04a）。 */
  progress_start_color?: RgbaColor;
  /** 进度条渐变结束色（默认橙 #e08a16）。 */
  progress_end_color?: RgbaColor;
}

/**
 * Form data as `transformProps` sees it.
 *
 * `ChartProps` runs `convertKeysToCamelCase` over formData before handing it to
 * the chart, so by the time the option object is built every key is camelCase.
 * Reading the snake_case control names here would quietly yield `undefined`, so
 * each control would fall back to its default and never do anything.
 */
export interface ProgressBarRankChartFormData {
  /** Category dimension(s). Multiple columns are joined into one label. */
  groupby?: string[];
  /** The metric being ranked. */
  metric: QueryFormMetric;
  /** 关键少数阈值（百分比），默认 80。 */
  vitalFewThreshold?: number;
  /** 类目标签是否带排名前缀，默认 true。 */
  showRankPrefix?: boolean;
  /** 进度条渐变起始色。 */
  progressStartColor?: RgbaColor;
  /** 进度条渐变结束色。 */
  progressEndColor?: RgbaColor;
  /** Id of the slice, used to keep colours stable across charts. */
  sliceId?: number;
}

export interface ProgressBarRankTransformedProps {
  width: number;
  height: number;
  /** 已经组装好的 ECharts 配置，直接交给 Echart 渲染。 */
  echartOptions: EChartsCoreOption;
  /**
   * 实际绘制图表区的高度：按「行数 × 行高」估算，行数少时压缩高度，
   * 避免图表区域内留下一大片空白。
   */
  chartAreaHeight: number;
}