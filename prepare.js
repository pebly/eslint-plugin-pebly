const AJV = require('ajv');
const fs = require('fs');

const ajv = new AJV({ logger: false, strict: false });

const config = (name, path, plugin) => {
  const configMod = require(`./configs/${name}.json`);

  const configRules = configMod.rules;

  const eslintMod = require(`./node_modules/eslint/lib/rules/index.js`);

  const eslintRules = Object.fromEntries(eslintMod);

  const pluginMod = require(`./node_modules/${plugin}/${path}/index.js`);

  const pluginRules =
    plugin === 'eslint' ? Object.fromEntries(pluginMod) : pluginMod.rules;

  let rules = {};

  for (const ns in configRules) {
    const key = Object.keys(pluginRules).find(
      (key) => configNs(plugin, key) === ns
    );

    if (!key) {
      throw new Error(`unknown rule: ${ns}`);
    }
  }

  for (const key in pluginRules) {
    const ns = configNs(plugin, key);

    const ruleConfig = configRules[ns];

    const rulePlugin = pluginRules[key];

    const ext = configExt(rulePlugin.meta.docs, plugin, key);

    const schema = configSchema(plugin, rulePlugin.meta.schema);

    // if (eslintRules[key] && !ext && plugin !== 'eslint') {
    //   console.log(`[warn] similar core rule: ${ns} <-> ${key}`);
    // }

    if (ruleConfig) {
      // if (ruleConfig === 'off') {
      //   console.log(`[warn] disabled rule: ${ns}`);
      // }

      if (rulePlugin.meta.deprecated) {
        throw new Error(`deprecated rule: ${ns}`);
      }

      if (ext) {
        throw new Error(`forbidden core rule: ${ns} <-> ${ext}`);
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
      } else {
        if (schema) {
          throw new Error(`undefined options: ${ns}`);
        }

        rules[ns] = 'error';
      }
    }
  }

  const output = { ...configMod, rules };

  if (plugin !== 'eslint') {
    output.plugins ??= [plugin];
  }

  fs.writeFileSync(`${__dirname}/dist/${name}.json`, JSON.stringify(output));

  return output;
};

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

  return schema;
};

const configValid = (configRule, configSchema) => {
  const options = JSON.parse(
    JSON.stringify(Array.isArray(configRule) ? configRule : [configRule])
  );

  if (
    !['error', 'off', 'warn'].includes(options[0]) ||
    (options.length > 1 && !configSchema)
  ) {
    return false;
  }

  if (options[0] === 'off' || (options.length === 1 && !configSchema)) {
    return true;
  }

  options.shift();

  if (!Array.isArray(configSchema)) {
    return ajv.validate(configSchema, options);
  }

  for (let i = 0; i < options.length; i++) {
    if (!ajv.validate(configSchema[i], options[i])) {
      return false;
    }
  }

  return true;
};

/* --- */

fs.mkdirSync(`${__dirname}/dist`, { recursive: true });

const configEslint = config('eslint', 'lib/rules', 'eslint');
const configN = config('n', 'lib', 'eslint-plugin-n');
const configSecurity = config('security', '.', 'eslint-plugin-security');
const configTs = config('ts', 'eslint-plugin/dist', '@typescript-eslint');
const configUnicorn = config('unicorn', '.', 'eslint-plugin-unicorn');
const configVue = config('vue', 'lib', 'eslint-plugin-vue');
const configVueA11y = config('vue-a11y', 'dist', 'eslint-plugin-vuejs-accessibility'); // prettier-ignore
const configWc = config('wc', 'lib', 'eslint-plugin-wc');
