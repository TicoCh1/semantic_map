import assert from "node:assert/strict";
import {test} from "node:test";
import {previewData, validateBoundary} from "./boundary-preview.mjs";

const fixture = previewData();
const boundary = {city:"london", points:[[-.126,51.505],[-.118,51.505],[-.121,51.512]]};

test("analyzes only the polygon and recomputes the chosen class from its samples", () => {
  const {samples, themes} = fixture.analyze(boundary);
  const count = themes.reduce((total,t) => total+t.count,0);
  assert.equal(count,samples.length);
  assert.ok(themes.length > 1);
  assert.ok(!fixture.rows.london.every(r => samples.includes(r)));
  const whole = fixture.search(boundary);
  const selected = fixture.search({...boundary,theme:themes[0].label});
  assert.equal(whole.nodes,count);
  assert.equal(selected.nodes,themes[0].count);
  assert.notDeepEqual(fixture.queries.get(whole.id).bytes,fixture.queries.get(selected.id).bytes);
  assert.throws(() => fixture.search({...boundary,theme:"Unavailable"}));
  const moved = {...boundary,points:[[-.128,51.504],[-.117,51.504],[-.12,51.516]]};
  const revised = fixture.search({...moved,theme:themes[0].label});
  assert.notDeepEqual(fixture.queries.get(selected.id).bytes,fixture.queries.get(revised.id).bytes);
});

test("rejects duplicate, crossed and degenerate boundaries; an empty selection cannot submit", () => {
  for(const points of [[],[[0,0],[1,0],[0,0]],[[0,0],[1,0],[2,0]],[[0,0],[2,2],[0,2],[1,0]]]) {
    assert.throws(()=>validateBoundary("rome",points));
  }
  const empty={city:"london",points:[[0,0],[1,0],[0,1]]};
  assert.equal(fixture.analyze(empty).samples.length,0);
  assert.throws(()=>fixture.search(empty));
});
