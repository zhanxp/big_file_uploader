const router = require('koa-router')();
var api = require('./core').api;
var multer = require('koa-multer');
var fs = require('fs');
const path = require('path');
var core = require('./core');
//var child_process = require('child_process');
var exec = require('child-process-promise').exec;
var md5 = require('./md5');


var chunkDir = path.join(__dirname, "../tmp");
var uploadDir = path.join(__dirname, "../uploads");
var fileSalt = ' ';
const upload = multer({ dest: 'tmp/' });

/**
 * Created by zhanxiaoping 
 * zhanxp@me.com
 */
router.get('/', async function(ctx, next) {
    //ctx.json(api.success());
    await ctx.render('home/index');
});


// router.post('/form_process', upload.array('file'), async function(ctx, next) {
// var query = ctx.req.body;
//     var responseJson = {
//         first_name: query.first_name,
//         last_name: query.last_name,
//         origin_file: ctx.req.files[0] // 上传的文件信息  
//     };

//     var src_path = ctx.req.files[0].path;
//     var des_path = ctx.req.files[0].destination + query.files[0].originalname;

//     fs.rename(src_path, des_path, function(err) {
//         if (err) {
//             throw err;
//         }

//         fs.stat(des_path, function(err, stat) {
//             if (err) {
//                 throw err;
//             }

//             responseJson['upload_file'] = stat;
//             console.log(responseJson);

//             ctx.json(responseJson);
//         });
//     });
// });


router.post('/upload_chunks', upload.array('file'), async function(ctx, next) {
    var query = ctx.req.body;

    var src_path = ctx.req.files[0].path; // 原始片段在临时目录下的路径  
    var des_dir = [chunkDir, query.guid].join('/');
    var des_path = (query.chunk != undefined) ? [des_dir, query.chunk].join('/') : des_dir;


    // 如果没有des_dir目录,则创建des_dir  
    if (!fs.existsSync(des_dir)) {
        fs.mkdirSync(des_dir);
    }
    // 移动分片文件到  
    try {
        // exec(['mv', src_path, des_path].join(' ')).then(function(result) {
        //         // var stdout = result.stdout;
        //         // var stderr = result.stderr;
        //         // console.log('stdout: ', stdout);
        //         // console.log('stderr: ', stderr);
        //         return ctx.json({ 'status': 1, 'msg': query.guid + '_' + query.chunk + '上传成功!' });
        //     })
        //     .catch(function(err) {
        //         return ctx.json({ 'status': 0, 'msg': '移动分片文件错误!' });
        //         //console.error('ERROR: ', err);
        //     });

        await exec(['mv', src_path, des_path].join(' '));
        return ctx.json({ 'status': 1, 'msg': query.guid + '_' + query.chunk + '上传成功!' });

        // , function(err, stdout, stderr) {
        //     if (err) {
        //         console.log(err);
        //         return ctx.json({ 'status': 0, 'msg': '移动分片文件错误!' });
        //     }
        //     return ctx.json({ 'status': 1, 'msg': query.guid + '_' + query.chunk + '上传成功!' });
        // });
    } catch (e) {
        console.log(e);
        return ctx.json({ 'status': 0, 'msg': '移动分片文件错误!' });
    }
});

router.post('/merge_chunks', upload.array('file'), async function(ctx, next) {
    var query = ctx.request.body;
    var src_dir = [chunkDir, query.hash + '/'].join('/');

    // 目标目录  
    var time = new Date();
    var path = [
        time.getFullYear(),
        time.getMonth() + 1 <= 9 ? '0' + (time.getMonth() + 1) : time.getMonth() + 1,
        time.getDate <= 9 ? '0' + time.getDate() : time.getDate()
    ].join('-'); // 文件目录名  

    // 如果没有des_dir目录,则创建des_dir  
    var des_dir = [uploadDir, path].join('/');
    if (!fs.existsSync(des_dir)) {
        fs.mkdirSync(des_dir);
    }

    // 文件名+扩展名  
    var name = decodeURIComponent(query.name);

    // 文件的实际名称和路径  
    var fileName = md5.md5([path, name, query.size, new Date().getTime(), 99999 * Math.random()].join(fileSalt)) + '.' + query.ext;

    // 文件签名  
    var sig = md5.md5([path, name, fileName, query.size].join(fileSalt));

    // 文件的实际路径  
    var des_path = [des_dir, fileName].join('/');

    try {
        var files = fs.readdirSync(src_dir);

        if (files.length == 0) {
            return res.json({ 'status': 0, 'url': '', 'msg': '分片文件不存在!' });
        }

        if (files.length > 1) {
            files.sort(function(x, y) {
                return x - y;
            });
        }

        for (var i = 0, len = files.length; i < len; i++) {
            fs.appendFileSync(des_path, fs.readFileSync(src_dir + files[i]));
        }

        // 删除分片文件夹  
        await exec(['rm', '-rf', src_dir].join(' '));

        return ctx.json({
            'status': 1,
            'url': [
                'http://127.0.0.1:6888',
                'file', fileName,
                'path', path,
                'name', encodeURIComponent(name),
                'sig', sig
            ].join('/')
        });

    } catch (e) {
        // 删除分片文件夹  
        await exec(['rm', '-rf', src_dir].join(' '));
        return ctx.json({ 'status': 0, 'url': '' });
    }
});

router.get('/file', async function(ctx, next) {
    var re_path = ctx.query.path;
    //ctx.body = path;
    var filePath = path.join(uploadDir, re_path);
    // var info = fs.statSync(filePath);
    // core.logger.warn(info);
    var info = path.parse(filePath);
    core.logger.warn(info);
    ctx.set('Content-Type', 'application/octet-stream');
    ctx.set("Content-Disposition", "attachment; filename=" + encodeURI(info.base));
    ctx.body = fs.createReadStream(filePath);
});

router.get('/file/:file/path/:path/name/:name/sig/:sig', async function(ctx, next) {
    try {
        var name = decodeURIComponent(ctx.params.name);
        var stat = fs.statSync([uploadDir, ctx.params.path, ctx.params.file].join('/'));
        var sig = md5.md5([ctx.params.path, name, ctx.params.file, stat.size].join(fileSalt));

        // 签名验证  
        if (sig != ctx.params.sig) {
            return ctx.json({ status: 0, msg: '签名错误!' });
        }

        // res.download([uploadDir, req.params.path, req.params.file].join('/'), name, function(err) {
        //     if (err) {
        //         return res.send('下载错误!');
        //     }
        // });

    } catch (e) {
        return ctx.json({ status: 0, msg: '未知错误!' });
    }
});


module.exports = router;