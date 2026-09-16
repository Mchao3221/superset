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
import { validateNonEmpty } from '@superset-ui/core';
import {
  ControlPanelConfig,
  sharedControls,
} from '@superset-ui/chart-controls';

const config: ControlPanelConfig = {
  controlPanelSections: [
    {
      label: t('Query'),
      expanded: true,
      controlSetRows: [
        [
          {
            name: 'groupby',
            config: {
              ...sharedControls.groupby,
              label: t('Category'),
              description: t(
                'Dimension(s) to rank. Selecting more than one column ' +
                  'produces one combined category per unique combination.',
              ),
              validators: [validateNonEmpty],
            },
          },
        ],
        [
          {
            name: 'metric',
            config: {
              ...sharedControls.metric,
              label: t('Metric'),
              description: t(
                'The measure to rank categories by. A Pareto chart ranks a ' +
                  'single measure.',
              ),
              validators: [validateNonEmpty],
            },
          },
        ],
        ['adhoc_filters'],
        ['row_limit'],
      ],
    },
    {
      label: t('Chart Options'),
      expanded: true,
      controlSetRows: [
        // 没有 color_scheme：柱子的三档颜色与累计曲线都是固定语义色
        // （见 transformProps 里的 80/20 配色），换配色表不会改变任何东西。
        ['y_axis_format'],
        [
          {
            name: 'show_cumulative_line',
            config: {
              type: 'CheckboxControl',
              label: t('Cumulative Line'),
              default: true,
              renderTrigger: true,
              description: t(
                'Overlay the cumulative percentage of the total on a ' +
                  'secondary axis.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_eighty_line',
            config: {
              type: 'CheckboxControl',
              label: t('80% Reference Line'),
              default: true,
              renderTrigger: true,
              description: t(
                'Mark where the cumulative percentage reaches 80%. ' +
                  'Requires the cumulative line.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_eighty_twenty_line',
            config: {
              type: 'CheckboxControl',
              label: t('80/20 Dividing Line'),
              default: true,
              renderTrigger: true,
              description: t(
                'Draw a vertical divider where the cumulative percentage ' +
                  'first reaches 80%, separating the vital few categories ' +
                  'from the rest. Requires the cumulative line.',
              ),
            },
          },
        ],
      ],
    },
  ],
};

export default config;
