import assert from 'node:assert/strict';
import test from 'node:test';
import { centerHomeHero } from '../lib/editor-site-migrations.js';

test('the home hero drops stale canvas coordinates while keeping edited text styles', () => {
  const style = { position: 'absolute', left: '0px', top: '386px', width: '1340px', height: '109px', color: '#eee' };
  const subtitle = { position: 'absolute', left: '158px', top: '495px', width: '1024px' };
  const otherRule = { selectors: ['#other'], style };
  const mobileRule = { selectors: ['#title'], mediaText: '(max-width: 600px)', style: { color: '#fff' } };
  const doc = {
    pages: [{ id: 'home', slug: 'home' }],
    projectData: {
      pages: [{ id: 'home', component: { components: [{ classes: ['promo'], components: [
        { classes: ['promo__title'], attributes: { id: 'title' } },
        { components: [{ classes: ['promo__slogan'], attributes: { id: 'subtitle' } }] },
      ] }] } }],
      styles: [{ selectors: ['#title'], style }, { selectors: ['#subtitle'], style: subtitle }, otherRule, mobileRule],
    },
  };
  const fixed = centerHomeHero(doc);
  assert.deepEqual(fixed.projectData.styles, [{ selectors: ['#title'], style: { color: '#eee' } }, otherRule, mobileRule]);
  assert.equal(centerHomeHero(fixed), fixed);
  assert.equal(doc.projectData.styles[0].style.position, 'absolute');
});
