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

/** 渐变默认起始色 #f0a04a，与图表样式要求一致。 */
const DEFAULT_START_COLOR = { r: 240, g: 160, b: 74, a: 1 };
/** 渐变默认结束色 #e08a16。 */
const DEFAULT_END_COLOR = { r: 224, g: 138, b: 22, a: 1 };

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
                'The measure to rank categories by. A progress-bar rank ' +
                  'chart ranks a single measure.',
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
        [
          {
            name: 'vital_few_threshold',
            config: {
              type: 'TextControl',
              label: t('Vital Few Threshold (%)'),
              default: 80,
              isInt: true,
              renderTrigger: true,
              description: t(
                'Show rows whose cumulative percentage stays at or below ' +
                  'this value. The top-ranked row is always shown.',
              ),
            },
          },
        ],
        [
          {
            name: 'show_rank_prefix',
            config: {
              type: 'CheckboxControl',
              label: t('Rank Prefix'),
              default: true,
              renderTrigger: true,
              description: t(
                'Prefix category labels with their rank, e.g. "1. Fall".',
              ),
            },
          },
        ],
        [
          {
            name: 'progress_start_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Gradient Start Color'),
              description: t(
                'Left-hand colour of the progress-bar gradient.',
              ),
              default: DEFAULT_START_COLOR,
              renderTrigger: true,
            },
          },
        ],
        [
          {
            name: 'progress_end_color',
            config: {
              type: 'ColorPickerControl',
              label: t('Gradient End Color'),
              description: t(
                'Right-hand colour of the progress-bar gradient.',
              ),
              default: DEFAULT_END_COLOR,
              renderTrigger: true,
            },
          },
        ],
      ],
    },
  ],
};

export default config;