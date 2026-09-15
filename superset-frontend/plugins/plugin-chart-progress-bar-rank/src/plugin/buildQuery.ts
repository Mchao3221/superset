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
import { ProgressBarRankFormData } from '../types';

/**
 * `groupby` and `metric` are standard formData fields, so buildQueryContext
 * already turns them into columns/metrics and `adhoc_filters` into a WHERE
 * clause. The only thing this chart needs to add is the ORDER BY -- see below.
 */
export default function buildQuery(formData: ProgressBarRankFormData) {
  const { metric } = formData;

  return buildQueryContext(formData, baseQueryObject => [
    {
      ...baseQueryObject,
      // 让数据库先按度量降序返回最大类别，排名与累计占比因此对原始数据
      // 而言是确定的；否则 row_limit 会截断任意一片结果。
      orderby: metric ? [[metric, false]] : undefined,
    },
  ]);
}