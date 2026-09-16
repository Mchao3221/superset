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
  getAnalogousColors,
  getCategoricalSchemeRegistry,
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
 * 主轴（鱼脊）的颜色。
 *
 * 固定色值，不跟随主题的文字色：主轴是整幅图的骨架，要和彩色的次级轴拉开
 * 层次；鱼头箭头与它同色，看上去才是同一根骨头。
 */
const SPINE_COLOR = '#22324a';

/**
 * 鱼头文字与其外框的颜色。
 *
 * 用偏暗的砖红，和主轴的深藏青、次级轴的分类色都不同色系：鱼头是被分析的
 * 问题本身，不该和原因们混在一起。
 */
const HEAD_COLOR = '#c0392b';

/**
 * 配色表取不到颜色时的兜底次级轴配色。
 *
 * 正常情况颜色来自 `color_scheme` 选的配色表，但注册表可能为空（例如插件
 * 被单独挂载）。兜底不能让所有骨骼退回同一个颜色 —— 交错排布之后上下相邻
 * 的两根同色，就分不清哪根是哪根了。
 */
const FALLBACK_BONE_COLORS = [
  '#1FA8C9',
  '#FF7F44',
  '#5AC189',
  '#E04355',
  '#A868B7',
  '#FCC700',
  '#3CCCCB',
  '#454E7C',
  '#A38F79',
  '#666666',
];

/**
 * 给每根次级轴（大骨）分配一个互不相同的颜色。
 *
 * 按序号取色，而不是走 `CategoricalColorScale` 的按值映射 —— 那条路在配色
 * 表用尽之后会重复用色，而交错排布下相邻两根同色就分不出彼此了。序号超出
 * 配色表长度时补一批同色系的近似色，保证仍然两两不同。
 */
export function buildBoneColors(
  boneKeys: string[],
  colorScheme?: string,
): Record<string, string> {
  const registry = getCategoricalSchemeRegistry();
  // 传进来的配色表名可能已经不在注册表里，`get` 会自动退回默认配色表。
  const schemeColors = registry.get(colorScheme)?.colors ?? [];
  const palette = schemeColors.length ? schemeColors : FALLBACK_BONE_COLORS;
  const colors =
    palette.length >= boneKeys.length
      ? palette
      : [
          ...palette,
          ...getAnalogousColors(
            palette,
            Math.ceil(boneKeys.length / palette.length),
          ),
        ];

  return boneKeys.reduce<Record<string, string>>((acc, key, index) => {
    acc[key] = colors[index];
    return acc;
  }, {});
}

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
  } = formData as FishboneChartFormData;

  const queryData = queriesData?.[0];
  const rows = queryData?.data ?? [];
  const colnames = queryData?.colnames ?? [];

  const levelColumns = resolveLevelColumns(groupby, colnames);
  const metricColumn = resolveMetricColumn(metric, colnames, levelColumns);
  const bones = buildFishboneBones({ rows, levelColumns, metricColumn });

  // 每根次级轴一个互不相同的颜色。
  const boneColors = buildBoneColors(
    bones.map(bone => bone.key),
    colorScheme,
  );

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
    spineColor: SPINE_COLOR,
    headColor: HEAD_COLOR,
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
