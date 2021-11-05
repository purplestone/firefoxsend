// TODO: when node supports 'for await' we can remove babel-polyfill
// and use 'fluent' instead of 'fluent/compat' (also below near line 42)
require('babel-polyfill');
const { MessageContext } = require('fluent/compat');
const fs = require('fs');

function toJSON(map) {
  return JSON.stringify(Array.from(map)).replace(/\\r"/g,'"');
}

function merge(m1, m2) {
  const result = new Map(m1);
  for (const [k, v] of m2) {
    result.set(k, v);
  }
  return result;
}

module.exports = function(source) {
  this.resourcePath = this.resourcePath.replace(/\\/g, '/');
  const localeExp = this.options.locale || /([^/]+)\/[^/]+\.ftl$/;
  const result = localeExp.exec(this.resourcePath);
  const locale = result && result[1];
  if (!locale) {
    throw new Error(`couldn't find locale in: ${this.resourcePath}\n--> ${localeExp}`);
  }
  // load default language and "merge" contexts
  // TODO: make this configurable
  const en_ftl = fs.readFileSync(
    require.resolve('../public/locales/en-US/send.ftl'),
    'utf8'
  );
  const en = new MessageContext('en-US');
  en.addMessages(en_ftl);
  // pre-parse the ftl
  const context = new MessageContext(locale);
  context.addMessages(source);

  const merged = merge(en._messages, context._messages);
  return  `
module.exports = \`
if (typeof window === 'undefined') {
  require('babel-polyfill');
  var fluent = require('fluent/compat');
}
(function () {
  var ctx = new fluent.MessageContext('${locale}', {useIsolating: false});
  ctx._messages = new Map(${toJSON(merged)});
  function translate(id, data) {
    var msg = ctx.getMessage(id);
    if (typeof(msg) !== 'string' && !msg.val && msg.attrs) {
      msg = msg.attrs.title || msg.attrs.alt
    }
    return ctx.format(msg, data);
  }
  if (typeof window === 'undefined') {
    module.exports = translate;
  }
  else {
    window.translate = translate;
  }
})();
\``;

};
