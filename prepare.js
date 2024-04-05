'use strict';

const AJV = require('ajv');
const fs = require('node:fs');

const ajv = new AJV({ logger: false, strict: false });

const configExt = (docs, plugin, rule) => {
  if (!docs) {
    return;
  }

  if (plugin === '@typescript-eslint' && docs.extendsBaseRule) {
    if (typeof docs.extendsBaseRule === 'string') {
      return docs.extendsBaseRule;
    }

    return rule;
  }

  if (plugin === 'eslint-plugin-vue' && docs.extensionSource) {
    return docs.extensionSource.url.split('/rules/', 2)[1];
  }
};

const configNs = (plugin, rule) => {
  if (plugin === 'eslint') {
    return rule;
  }

  if (plugin.startsWith('eslint-plugin-')) {
    return `${plugin.slice(14)}/${rule}`;
  }

  return `${plugin}/${rule}`;
};

const configSchema = (plugin, schema) => {
  if (
    !schema ||
    (Array.isArray(schema) && schema.length === 0) ||
    (typeof schema === 'object' && Object.keys(schema).length === 0)
  ) {
    return;
  }

  if (plugin === '@typescript-eslint') {
    return JSON.parse(JSON.stringify(schema).replaceAll('#/items/0/', '#/'));
  }

  if (plugin === 'eslint-plugin-perfectionist') {
    return JSON.parse(
      JSON.stringify(schema)
        .replaceAll('"exclusiveMinimum"', '"_exclusiveMinimum"')
        .replaceAll('"id"', '"_id"')
    );
  }

  return schema;
};

const configValid = (configRule, schema) => {
  const options = JSON.parse(
    JSON.stringify(Array.isArray(configRule) ? configRule : [configRule])
  );

  if (
    !['error', 'off', 'warn'].includes(options[0]) ||
    (options.length > 1 && !schema)
  ) {
    return false;
  }

  if (options[0] === 'off' || (options.length === 1 && !schema)) {
    return true;
  }

  options.shift();

  if (!Array.isArray(schema)) {
    return ajv.validate(schema, options);
  }

  for (let i = 0; i < options.length; i++) {
    if (!ajv.validate(schema[i], options[i])) {
      return false;
    }
  }

  return true;
};

const config = (name, path, plugin) => {
  const configMod = require(`./configs/${name}.json`);

  const configRules = configMod.rules;

  const eslintMod = require(`./node_modules/eslint/lib/rules/index.js`);

  const eslintRules = Object.fromEntries(eslintMod);

  const pluginMod = require(`./node_modules/${plugin}/${path}/index.js`);

  const pluginRules =
    plugin === 'eslint' ? Object.fromEntries(pluginMod) : pluginMod.rules;

  /* --- */

  for (const ns in configRules) {
    const key = Object.keys(pluginRules).find(
      (rule) => configNs(plugin, rule) === ns
    );

    if (!key) {
      throw new Error(`unknown rule: ${ns}`);
    }
  }

  /* --- */

  const rules = {};

  for (const key in pluginRules) {
    const ns = configNs(plugin, key);

    const ruleConfig = configRules[ns];

    const rulePlugin = pluginRules[key];

    const ext = configExt(rulePlugin.meta.docs, plugin, key);

    const schema = configSchema(plugin, rulePlugin.meta.schema);

    if (eslintRules[key] && !ext && plugin !== 'eslint') {
      if (eslintRules[key].meta.deprecated) {
        console.log(`[warn] similar core rule: ${ns} <-> ${key} (deprecated)`);
      } else {
        console.log(`[warn] similar core rule: ${ns} <-> ${key}`);
      }
    }

    if (ruleConfig) {
      if (ruleConfig === 'off') {
        console.log(`[warn] disabled rule: ${ns}`);
      }

      if (rulePlugin.meta.deprecated) {
        throw new Error(`deprecated rule: ${ns}`);
      }

      if (ext) {
        throw new Error(`core rule: ${ns} <-> ${ext}`);
      }

      if (rulePlugin.meta.type === 'layout') {
        console.log(`[warn] layout rule: ${ns}`);
      }

      if (ruleConfig !== 'off' && !schema) {
        throw new Error(`unnecessary options: ${ns}`);
      }

      if (!configValid(ruleConfig, schema)) {
        throw new Error(`invalid options: ${ns}`);
      }

      rules[ns] = ruleConfig;
    } else if (!rulePlugin.meta.deprecated) {
      if (ext) {
        if (plugin === '@typescript-eslint') {
          rules[ext] = 'off';
        }

        rules[ns] = configEslint.rules[ext] ?? 'off';
      } else if (rulePlugin.meta.type === 'layout') {
        rules[ns] = 'off';
      } else {
        if (schema) {
          throw new Error(`undefined options: ${ns}`);
        }

        rules[ns] = 'error';
      }
    }
  }

  /* --- */

  const output = { ...configMod, rules };

  if (plugin !== 'eslint') {
    output.plugins ??= [];
    output.plugins.push(plugin);
  }

  if (plugin === '@typescript-eslint') {
    const exMod = require(`./node_modules/${plugin}/${path}/configs/eslint-recommended.js`);

    const exRules = Object.fromEntries(
      Object.entries(exMod.overrides.at(0).rules).filter(
        ([key, value]) => rules[key] === undefined && value === 'off'
      )
    );

    output.overrides ??= [];
    output.overrides.push({ files: '*', rules: exRules });
  }

  /* --- */

  fs.mkdirSync(`${__dirname}/dist`, { recursive: true });

  fs.writeFileSync(`${__dirname}/dist/${name}.json`, JSON.stringify(output));

  console.log(`[done] ${plugin}\n`);

  /* --- */

  return output;
};

/* --- */

const configEslint = config('eslint', 'lib/rules', 'eslint');
config('n', 'lib', 'eslint-plugin-n');
config('perfectionist', 'dist', 'eslint-plugin-perfectionist');
config('security', '.', 'eslint-plugin-security');
config('ts', 'eslint-plugin/dist', '@typescript-eslint');
config('unicorn', '.', 'eslint-plugin-unicorn');
config('vue', 'lib', 'eslint-plugin-vue');
config('vue-a11y', 'dist', 'eslint-plugin-vuejs-accessibility');
config('wc', 'lib', 'eslint-plugin-wc');
