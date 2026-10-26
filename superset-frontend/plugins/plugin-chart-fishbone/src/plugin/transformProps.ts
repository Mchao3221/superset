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
 * 整条鱼的主色。
 *
 * 主干、四根主骨、鱼头鱼尾与胶囊标签统一用这一种深蓝：参考图就是单色系，
 * 分类靠位置区分而不是靠颜色，画面更干净，深蓝对白底也有足够的对比度。
 */
/** 鱼身渐变：鱼尾用亮一点的蓝，鱼头用更深的藏青。 */
const TAIL_COLOR = '#1860c2';
const HEAD_COLOR = '#17418a';
/** 四根主骨胶囊与问题气泡的底色。 */
const BADGE_COLOR = '#1860c2';

/** 四根大骨各自的颜色，按固定槽位索引。 */
const BONE_COLORS: Record<string, string> = {
  人: '#007893',
  物: '#e3995c',
  环: '#329f66',
  法: '#6f3ead',
};

/**
 * 深色底上的文字颜色。
 */
const PILL_TEXT_COLOR = '#ffffff';

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
    yAxisFormat,
  } = formData as FishboneChartFormData;

  const queryData = queriesData?.[0];
  const rows = queryData?.data ?? [];
  const colnames = queryData?.colnames ?? [];

  // 第二条查询读取数据集里的 EffectTitle；读不到时回退到图表控件里的值。
  const configRow = queriesData?.[1]?.data?.[0];
  const dbEffectTitle =
    configRow &&
    configRow.EffectTitle !== null &&
    configRow.EffectTitle !== undefined
      ? String(configRow.EffectTitle).trim()
      : '';
  const effectTitle = dbEffectTitle || effectName;

  const levelColumns = resolveLevelColumns(groupby, colnames);
  const metricColumn = resolveMetricColumn(metric, colnames, levelColumns);
  const { bones, unmatchedRows } = buildFishboneBones({
    rows,
    levelColumns,
    metricColumn,
  });

  const numberFormatter = getNumberFormatter(yAxisFormat);

  const layout = computeFishboneLayout({
    width,
    height,
    bones,
    effectName: effectTitle,
    headPosition,
    showValues,
    baseFontSize: FONT_SIZE_PX[fontSize],
    baseThickness: BONE_THICKNESS_PX[boneThickness],
    formatValue: value => numberFormatter(value),
  });

  // 有数据但第一层维度一个都没归入固定分类时，直接说清原因，别只提示「无数据」。
  const hasCauses = bones.some(bone => bone.rows.length > 0);

  return {
    width,
    height,
    layout,
    tailColor: TAIL_COLOR,
    headColor: HEAD_COLOR,
    badgeColor: BADGE_COLOR,
    boneColors: BONE_COLORS,
    pillTextColor: PILL_TEXT_COLOR,
    labelColor: theme.colorText,
    valueColor: theme.colorTextSecondary,
    noDataText:
      !hasCauses && unmatchedRows > 0
        ? t('No causes mapped to 人 / 物 / 法 / 环')
        : t('No data'),
  };
}
