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

/**
 * Raw form data, keyed exactly as the control panel declares it. This is the
 * shape `buildQuery` receives, straight from the Explore / dashboard state.
 */
export interface ParetoFormData extends QueryFormData {
  /** Category dimension(s). Multiple columns are joined into one label. */
  groupby?: string[];
  /** The metric being ranked. A Pareto chart ranks exactly one measure. */
  metric: QueryFormMetric;
  /** Overlay the cumulative-percentage line (default: true). */
  show_cumulative_line?: boolean;
  /** Draw the 80% reference line (default: true). */
  show_eighty_line?: boolean;
  /** 画出 80/20 分界线：累计占比首次达到 80% 处的竖直分隔线（默认 true）。 */
  show_eighty_twenty_line?: boolean;
  color_scheme?: string;
  y_axis_format?: string;
}

/**
 * Form data as `transformProps` sees it.
 *
 * `ChartProps` runs `convertKeysToCamelCase` over formData before handing it to
 * the chart, so by the time the option object is built every key is camelCase.
 * Reading the snake_case control names here would quietly yield `undefined`, so
 * each control would fall back to its default and never do anything.
 */
export interface ParetoChartFormData {
  /** Category dimension(s). Multiple columns are joined into one label. */
  groupby?: string[];
  /** The metric being ranked. A Pareto chart ranks exactly one measure. */
  metric: QueryFormMetric;
  /** Overlay the cumulative-percentage line (default: true). */
  showCumulativeLine?: boolean;
  /** Draw the 80% reference line (default: true). */
  showEightyLine?: boolean;
  /** 画出 80/20 分界线（默认 true）。 */
  showEightyTwentyLine?: boolean;
  colorScheme?: string;
  yAxisFormat?: string;
  /** Id of the slice, used to keep colours stable across charts. */
  sliceId?: number;
}

export interface ParetoTransformedProps {
  width: number;
  height: number;
  echartOptions: EChartsCoreOption;
}

/** @deprecated kept as an alias so older imports keep compiling */
export type ParetoProps = ParetoTransformedProps;
