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
  CategoricalColorNamespace,
  ChartProps,
  getColumnLabel,
  getMetricLabel,
  getNumberFormatter,
  QueryFormColumn,
  QueryFormMetric,
} from '@superset-ui/core';
import { t } from '@apache-superset/core/translation';
import {
  BONE_THICKNESS_PX,
  FONT_SIZE_PX,
  FishboneChartFormData,
  FishboneProps,
} from '../types';
import buildFishboneBones from '../utils/fishboneData';
import computeFishboneLayout from '../utils/fishboneLayout';

/**
 * 取出结果里各层级维度对应的列名。
 *
 * `groupby` 里既可能是列名字符串，也可能是 adhoc column 对象（自定义 SQL
 * 表达式），`getColumnLabel` 统一给出它们在查询结果里的列名。列表为空时
 * 退回按位置取结果的前几列 —— 那时查询结果只有维度列。
 */
export function resolveLevelColumns(
  groupby: QueryFormColumn[],
  colnames: string[],
): string[] {
  if (!groupby.length) {
    return [];
  }
  return groupby.map((column, index) => {
    const label = getColumnLabel(column);
    if (!colnames.length || colnames.includes(label)) {
      return label;
    }
    return colnames[index] ?? label;
  });
}

/**
 * 取出度量在结果里的列名。
 *
 * 多数情况下它和 `getMetricLabel` 一致；对不上时退回「结果里除维度列之外
 * 的那一列」—— 控件只允许选一个度量，所以剩下的那一列就是它。
 */
export function resolveMetricColumn(
  metric: QueryFormMetric | undefined,
  colnames: string[],
  levelColumns: string[],
): string | null {
  if (!metric) {
    return null;
  }
  const label = getMetricLabel(metric);
  if (!colnames.length || colnames.includes(label)) {
    return label;
  }
  const remaining = colnames.filter(column => !levelColumns.includes(column));
  return remaining.length ? remaining[0] : null;
}

export default function transformProps(chartProps: ChartProps): FishboneProps {
  const { width, height, formData, queriesData, theme } = chartProps;

  // ChartProps 在把 formData 交给图表前会跑一遍 convertKeysToCamelCase，
  // 所以这里读到的是 headPosition / showValues，而不是控件里的 snake_case。
  const {
    groupby = [],
    metric,
    effectName = '',
    headPosition = 'right',
    showValues = true,
    fontSize = 'm',
    boneThickness = 'medium',
    colorScheme,
    yAxisFormat,
    sliceId,
  } = formData as FishboneChartFormData;

  const queryData = queriesData?.[0];
  const rows = queryData?.data ?? [];
  const colnames = queryData?.colnames ?? [];

  const levelColumns = resolveLevelColumns(groupby, colnames);
  const metricColumn = resolveMetricColumn(metric, colnames, levelColumns);
  const bones = buildFishboneBones({ rows, levelColumns, metricColumn });

  // 每根大骨一个颜色，同一份配色在不同图表间保持稳定（靠 sliceId 定序）。
  const colorScale = CategoricalColorNamespace.getScale(colorScheme);
  const boneColors = bones.reduce<Record<string, string>>((acc, bone) => {
    acc[bone.key] = colorScale.getColor(bone.key, sliceId);
    return acc;
  }, {});

  const numberFormatter = getNumberFormatter(yAxisFormat);

  const layout = computeFishboneLayout({
    width,
    height,
    bones,
    effectName,
    headPosition,
    showValues,
    baseFontSize: FONT_SIZE_PX[fontSize],
    baseThickness: BONE_THICKNESS_PX[boneThickness],
    boneColors,
    formatValue: value => numberFormatter(value),
  });

  return {
    width,
    height,
    layout,
    spineColor: theme.colorText,
    labelColor: theme.colorText,
    valueColor: theme.colorTextSecondary,
    noDataText: t('No data'),
    // 插值放在这里完成，渲染层只负责显示最终文案。
    droppedRowsNotice:
      layout.droppedRows > 0
        ? t('%(count)s cause(s) hidden — enlarge the chart', {
            count: layout.droppedRows,
          })
        : null,
  };
}
