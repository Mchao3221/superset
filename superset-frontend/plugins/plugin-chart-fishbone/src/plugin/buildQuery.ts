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
import { buildQueryContext } from '@superset-ui/core';
import { FishboneQueryFormData } from '../types';

/**
 * `groupby` 与 `metric` 都是标准字段，`buildQueryContext` 已经会把它们
 * 组装成 columns 与 metrics、把 `adhoc_filters` 翻成 WHERE，这里只需要补上
 * 排序。
 *
 * 排序的意义在于配合 `row_limit`：鱼骨图按原因重要性取舍，让数据库先返回
 * 数值最大的行，行数上限截断掉的才是真正的次要原因，而不是随机的一段。
 *
 * 第二条查询读取数据集里的 `EffectTitle`（鱼头问题标题），这样标题由
 * 数据库维护，不需要在图表配置或前端代码里写死；只取一行。
 *
 * 必须保留 `baseQueryObject.filters`：看板原生筛选器（如 dataset_id）是通过
 * extra_form_data 合并进 filters 的，之前把它覆盖成空数组，导致无论选哪个
 * 指标都命中表里主键最小的那行，鱼头标题永远是同一个。
 */
export default function buildQuery(formData: FishboneQueryFormData) {
  const { metric } = formData;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      orderby: metric ? [[metric, false]] : undefined,
    },
    {
      ...baseQueryObject,
      columns: ['EffectTitle'],
      metrics: [],
      orderby: [],
      extras: { having: '', where: '' },
      applied_time_extras: {},
      time_range: 'No filter',
      row_limit: 1,
      series_limit: 0,
      series_columns: [],
      is_timeseries: false,
      post_processing: [],
      annotation_layers: [],
    },
  ]);
}
