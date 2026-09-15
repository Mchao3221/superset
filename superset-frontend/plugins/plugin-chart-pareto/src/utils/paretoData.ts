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

export interface ParetoDatum {
  /** Joined label of the groupby dimension(s). */
  category: string;
  /** The ranked measure for this category. */
  value: number;
  /** Running sum of `value` over the descending-sorted rows. */
  cumulative: number;
  /** `cumulative / total * 100`. 0 when the total is 0. */
  cumulativePct: number;
}

export interface ParetoData {
  rows: ParetoDatum[];
  total: number;
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
 * Shape raw query rows into the series a Pareto chart needs: rows sorted by
 * the metric descending, plus the cumulative sum and cumulative percentage
 * at each row.
 *
 * The cumulative percentage is relative to the total of the rows *returned*.
 * If a row limit truncates the tail, the percentages describe the truncated
 * set rather than the full population -- feed the query enough rows (and an
 * ORDER BY metric DESC, which buildQuery does) for the result to be meaningful.
 *
 * Sorting is by value descending; ties keep their original relative order.
 */
export default function buildParetoData({
  rows,
  groupby = [],
  metricLabel,
}: {
  /**
   * 按列名索引的数据行。这里用 `DataRecord` 而非 `TimeseriesDataRecord`:
   * groupby 查询返回的是普通列字典,只有时间序列查询才会带 `__timestamp`。
   * 本图表既不需要时间列也不需要时间范围 —— 它做的是对类别排序 ——
   * 因此要求 `__timestamp` 只会把它真正要处理的数据行拒之门外。
   */
  rows: DataRecord[];
  groupby?: string[];
  metricLabel: string;
}): ParetoData {
  const collected = rows.map(row => ({
    category: groupby.length
      ? groupby.map(column => String(row[column] ?? '')).join(', ')
      : metricLabel,
    value: toFiniteNumber(row[metricLabel]),
  }));

  collected.sort((a, b) => b.value - a.value);

  const total = collected.reduce((sum, datum) => sum + datum.value, 0);

  let running = 0;
  const paretoRows = collected.map(datum => {
    running += datum.value;
    return {
      ...datum,
      cumulative: running,
      cumulativePct: total > 0 ? (running / total) * 100 : 0,
    };
  });

  return { rows: paretoRows, total };
}
