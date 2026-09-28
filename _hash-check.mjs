import { TODO_TREE_CORE } from './src/web/assets.js';
let h = 0x811c9dc5;
for (let i = 0; i < TODO_TREE_CORE.length; i++) {
  h ^= TODO_TREE_CORE.charCodeAt(i);
  h = Math.imul(h, 0x01000193);
}
console.log('带探针 core 的新 v =', (h >>> 0).toString(36));
