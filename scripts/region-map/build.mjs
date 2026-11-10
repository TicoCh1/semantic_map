// Package the independent map from data already scored on RunPod.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const input = path.resolve(process.argv[2] || 'outputs/stpauls500m_rome_pca8_20261001/intensity-map');
const output = path.resolve(process.argv[3] || path.join(input, 'stpauls-rome-pca8-intensity.html'));
const root = path.resolve(here, '../..');
const read = name => fs.readFileSync(path.join(here, name), 'utf8');
const library = path.join(root, 'frontend/node_modules/maplibre-gl/dist');
const escapeScript = value => value.replace(/<\/script/gi, '<\\/script');
const metadata = JSON.parse(fs.readFileSync(path.join(input, 'intensity-manifest.json'), 'utf8'));
if (metadata.format !== 'region-intensity-masks-v1') throw new Error('Unsupported map data format');
const city = id => ({rome:'Rome',london:'London'}[id?.split('_')[0]] || id?.split('_')[0] || 'Rome');
const sourceCity = city(metadata.source_dataset_id || 'london');
const targetCity = city(metadata.target_dataset_id || 'rome');
const sourceName = metadata.source_label.replace(new RegExp(`, ${sourceCity}$`),'');
const html = value => String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const retained = (metadata.explained_variance_fraction*100).toFixed(1);
const matched = (metadata.subsets['255'].matched_points/metadata.point_count*100).toFixed(1);
const product = metadata.aggregation === 'axis_product';
let template = read('map.html');
const slots = {
  SOURCE_NAME: html(sourceName), SOURCE_CITY: html(sourceCity), TARGET_CITY: html(targetCity),
  SOURCE_RADIUS: html(metadata.source_radius_m), SOURCE_POINTS: html(metadata.source_points),
  RETAINED_VARIANCE: retained, MATCHED_PERCENT: matched,
  HALF_LABEL: product ? 'Intensity · 0.50' : 'Envelope · 0.50',
  AGGREGATION_EXPLANATION: product ? 'Selected axes multiply their fixed single-axis intensities, with exponent 1 per axis. No averaging, root scaling, or selection-specific rescaling is applied to the raw product. Adding an axis cannot increase raw intensity. Each individual axis retains its 90% source envelope; the joint product does not promise 90% source coverage. Colour stretching is a separate display setting.' : 'Selected weights are equal and normalized. Each selection is calibrated on the source samples to approximately 90% source coverage; 0.50 is its envelope boundary.',
  CREATED_DATE: html(metadata.created_at?.slice(0,10) || '2026-10-01'),
  LIBRARY_CSS: fs.readFileSync(path.join(library, 'maplibre-gl.css'), 'utf8'),
  LIBRARY_JS: escapeScript(fs.readFileSync(path.join(library, 'maplibre-gl.js'), 'utf8').replace(/\/\/# sourceMappingURL=.*$/gm, '')),
  CSS: read('map.css'), JS: escapeScript(read('map.js')),
  METADATA: JSON.stringify(metadata).replace(/</g, '\\u003c'),
  PAYLOAD: fs.readFileSync(path.join(input, 'intensity.bin.gz')).toString('base64'),
};
for (const [key, value] of Object.entries(slots)) template = template.replaceAll(`@@${key}@@`, () => value);
if (/@@[A-Z_]+@@/.test(template)) throw new Error('Unfilled template slot');
fs.mkdirSync(path.dirname(output), {recursive: true});
fs.writeFileSync(output, template);
fs.copyFileSync(path.join(root, 'frontend/node_modules/maplibre-gl/LICENSE.txt'), path.join(path.dirname(output), 'MAPLIBRE-LICENSE.txt'));
console.log(JSON.stringify({output, bytes: fs.statSync(output).size, points: metadata.point_count}));
