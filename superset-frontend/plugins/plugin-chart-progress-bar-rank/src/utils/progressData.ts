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
import { DataRecord } from '@superset-ui/core';

export interface ProgressDatum {
  /** Joined label of the groupby dimension(s). */
  category: string;
  /** The ranked measure for this category. */
  value: number;
  /** Running sum of `value` over the descending-sorted rows. */
  cumulative: number;
  /** `cumulative / total * 100`. 0 when the total is 0. */
  cumulativePct: number;
}

/**
 * Coerce a data value to a finite number. Nulls, undefined, non-numeric
 * strings and NaN all collapse to 0 so a single bad row cannot turn the
 * whole cumulative series into NaN.
 */
export function toFiniteNumber(value: unknown): number {
  const num = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

/**
 * Shape raw query rows into the series the progress-bar rank chart needs:
 * rows sorted by the metric descending, plus the cumulative sum and the
 * cumulative percentage at each row.
 *
 * The cumulative percentage is relative to the total of the rows *returned*,
 * which keeps this chart exactly in step with the Pareto chart fed from the
 * same query. If a row limit truncates the tail, the percentages describe the
 * truncated set rather than the full population -- keep the row limit generous
 * enough for the result to be meaningful.
 *
 * Sorting is by value descending; ties keep their original relative order.
 */
export default function buildProgressData({
  rows,
  groupby = [],
  metricLabel,
}: {
  /** 按列名索引的数据行，与 Pareto 图表共用同一份 groupby 查询结果。 */
  rows: DataRecord[];
  groupby?: string[];
  metricLabel: string;
}): ProgressDatum[] {
  const collected = rows.map(row => ({
    category: groupby.length
      ? groupby.map(column => String(row[column] ?? '')).join(', ')
      : metricLabel,
    value: toFiniteNumber(row[metricLabel]),
  }));

  collected.sort((a, b) => b.value - a.value);

  const total = collected.reduce((sum, datum) => sum + datum.value, 0);

  let running = 0;
  return collected.map(datum => {
    running += datum.value;
    return {
      ...datum,
      cumulative: running,
      cumulativePct: total > 0 ? (running / total) * 100 : 0,
    };
  });
}

/**
 * 只保留「关键少数」：累计占比不超过 `threshold` 的行。
 *
 * 排名第一的行无条件保留 —— 即便它的累计占比已经超过阈值（例如大类独占
 * 九成），也仍然是最关键的少数，画出来比空图有意义。截断发生在第一条
 * 累计占比超过阈值的行上，之后的行全部丢弃。
 */
export function filterVitalFew(
  rows: ProgressDatum[],
  threshold: number,
): ProgressDatum[] {
  if (!rows.length) {
    return [];
  }
  const cut = rows.findIndex(
    (row, index) => index > 0 && row.cumulativePct > threshold,
  );
  return cut < 0 ? rows : rows.slice(0, cut);
}