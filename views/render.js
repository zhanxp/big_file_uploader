const path = require('path');
const nunjucks = require('nunjucks');
const views = require('koa-views');
const config = require('../config')

nunjucks.configure(path.join(__dirname), { autoescape: true, noCache: config.debug });
module.exports = views(path.join(__dirname), {
    map: { html: 'nunjucks' },
    extension: 'html'
});