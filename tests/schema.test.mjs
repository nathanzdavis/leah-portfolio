import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { validateSiteDocument } from '../lib/site-schema.js';
test('published site document is valid', async()=>{const doc=JSON.parse(await fs.readFile(new URL('../content/site.json',import.meta.url),'utf8'));assert.equal(validateSiteDocument(doc).pages.length,5)});
test('duplicate slugs are rejected', async()=>{const doc=JSON.parse(await fs.readFile(new URL('../content/site.json',import.meta.url),'utf8'));doc.pages[1].slug=doc.pages[0].slug;assert.throws(()=>validateSiteDocument(doc))});
