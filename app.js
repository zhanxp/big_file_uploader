var koa = require('koa');
var app = new koa();
const logger = require('koa-logger');
var core = require('./service/core');
var config = require('./config');
const serve = require('koa-static');
const path = require('path');
const render = require('./views/render');
const koaBody = require('koa-body');
var range = require('koa-range');

app.use(logger());
app.use(range);
app.use(koaBody());
app.use(serve('public'));
app.use(render);

//prefix
app.use(async function(ctx, next) {
    //ctx.state.moment = require('moment');
    ctx.json = function(obj) {
        ctx.set("Content-Type", "application/json;charset=utf-8");
        ctx.body = JSON.stringify(obj);
    }

    if (ctx.url.match(/favicon\.ico$/)) {
        ctx.body = "";
        return;
    }

    await next();
});

//routes
app.use(require('./service').routes());

//404
app.use(async function pageNotFound(ctx, next) {
    ctx.status = 404;
    ctx.json(core.api.error('Not Found！', 404));
});

//500
app.use(async function(ctx, next) {
    try {
        await next();
    } catch (err) {
        ctx.status = err.status || 500;
        ctx.json(core.api.error('Server Error！', ctx.status));
        ctx.app.emit('error', err, ctx);
    }
});

app.on('error', function(err) {
    core.logger.error(err);
});

var server = app.listen(config.port, function() {
    core.logger.info("http://localhost:" + server.address().port);
});

module.exports = app;