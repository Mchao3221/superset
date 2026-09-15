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
              label: t('Hierarchy'),
              description: t(
                'Dimensions that form the bones, in order. The first column ' +
                  'becomes the main bones (cause categories), the second the ' +
                  'sub-bones, and any further columns branch off those.',
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
                'Weighs the causes: it orders the bones, prints the value ' +
                  'next to each cause and scales how thick a main bone is.',
              ),
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
            name: 'effect_name',
            config: {
              type: 'TextControl',
              label: t('Effect'),
              default: '',
              renderTrigger: true,
              description: t(
                'The problem being analysed, written at the fish head, ' +
                  'e.g. "Late delivery".',
              ),
            },
          },
        ],
        [
          {
            name: 'head_position',
            config: {
              type: 'SelectControl',
              label: t('Head Position'),
              default: 'right',
              choices: [
                ['right', t('Right')],
                ['left', t('Left')],
              ],
              renderTrigger: true,
              description: t('Which end of the spine the fish head sits on.'),
            },
          },
        ],
        [
          {
            name: 'show_values',
            config: {
              type: 'CheckboxControl',
              label: t('Show Values'),
              default: true,
              renderTrigger: true,
              description: t('Print the metric value next to each cause.'),
            },
          },
        ],
        [
          {
            name: 'font_size',
            config: {
              type: 'SelectControl',
              label: t('Label Size'),
              default: 'm',
              choices: [
                ['s', t('Small')],
                ['m', t('Medium')],
                ['l', t('Large')],
              ],
              renderTrigger: true,
              description: t(
                'Base size of the cause labels. The chart shrinks it ' +
                  'automatically when space runs out.',
              ),
            },
          },
        ],
        [
          {
            name: 'bone_thickness',
            config: {
              type: 'SelectControl',
              label: t('Bone Thickness'),
              default: 'medium',
              choices: [
                ['thin', t('Thin')],
                ['medium', t('Medium')],
                ['thick', t('Thick')],
              ],
              renderTrigger: true,
              description: t(
                'Thickness of the largest main bone. Smaller bones scale ' +
                  'down from this by their metric value.',
              ),
            },
          },
        ],
        ['color_scheme'],
        ['y_axis_format'],
      ],
    },
  ],
};

export default config;
