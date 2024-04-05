'use strict';

module.exports = {
  configs: {
    eslint: require('./dist/eslint.json'),
    n: require('./dist/n.json'),
    perfectionist: require('./dist/perfectionist.json'),
    security: require('./dist/security.json'),
    ts: require('./dist/ts.json'),
    unicorn: require('./dist/unicorn.json'),
    vue: require('./dist/vue.json'),
    'vue-a11y': require('./dist/vue-a11y.json'),
    wc: require('./dist/wc.json'),
  },
  meta: {
    name: 'eslint-plugin-pebly',
    version: '0.1.0',
  },
};
