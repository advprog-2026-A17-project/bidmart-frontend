import { readFileSync } from 'node:fs';
import test from 'node:test';
import assert from 'node:assert/strict';

test('nginx config proxies /api traffic to gateway', () => {
  const config = readFileSync('./nginx.conf', 'utf-8');
  assert.match(config, /location\s+\/api\s*\{/);
  assert.match(config, /proxy_pass\s+http:\/\/gateway:8000/);
});
