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
import { FishboneProps } from './types';
import Fishbone from './Fishbone';

/**
 * 图表组件本身只做透传，布局与配色都在 `transformProps` 里算好。
 * 这样渲染层没有取数逻辑，也能脱离 Superset 单独测试。
 */
export default function PluginChartFishbone(props: FishboneProps) {
  return <Fishbone {...props} />;
}
