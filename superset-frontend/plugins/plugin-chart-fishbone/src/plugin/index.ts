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
import { t } from '@apache-superset/core/translation';
import { ChartMetadata, ChartPlugin } from '@superset-ui/core';
import buildQuery from './buildQuery';
import controlPanel from './controlPanel';
import transformProps from './transformProps';
import thumbnail from '../images/thumbnail.png';

export default class PluginChartFishbone extends ChartPlugin {
  /**
   * 构造函数负责装配四件套（查询、控件、数据转换、渲染）并声明图表元信息。
   *
   * `name` 是图表选择器里显示的名字，同时也是翻译的 msgid；存进元数据库的
   * 标识是 `VizType.Fishbone` 那个字符串，两者不要混用。
   */
  constructor() {
    const metadata = new ChartMetadata({
      // description 是图表选择器卡片上的说明，与 pareto 一样直接用中文字面量。
      description: '这个是鱼骨图',
      name: t('fishbone'),
      thumbnail,
      // 使用内置分类，不自造新分组；鱼骨图是因果关系图，与 Chord、Sankey 同归「流程图」。
      category: t('Flow'),
      tags: [t('Featured'), t('Comparison'), t('Categorical')],
    });

    super({
      buildQuery,
      controlPanel,
      loadChart: () => import('../PluginChartFishbone'),
      metadata,
      transformProps,
    });
  }
}
