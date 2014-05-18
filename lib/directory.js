var debug = require('debug')('download-counter')
  , _ = require('lodash')
  , path = require('path')
  , counter = require("./counter")
  , normalize = path.normalize
  , resolve = path.resolve
  , join = path.join
  , sep = path.sep
  , basename = path.basename
  , extname = path.extname
  , url = require('url')
  , parseurl = require('parseurl')
  , send = require('send')
  , Batch = require('batch')
  , fs = require('fs');


function removeHidden(files) {
    return files.filter(function(file){
        return '.' != file[0];
    });
}

module.exports = function(root, options) {
    if (!root) throw new TypeError('root path required');
    root = normalize(resolve(root) + sep);
    options = options || {};

    return function middleware(req, res, next) {
        if ('GET' != req.method && 'HEAD' != req.method) {
            return next();
        }

        var localpath = decodeURIComponent(url.parse(req.url).pathname)
          , path = normalize(join(root, localpath))
          , originalUrl = url.parse(req.originalUrl)
          , originalDir = decodeURIComponent(originalUrl.pathname)
          , showUp = path != root;

        // null byte(s), bad request
        if (~path.indexOf('\0')) return next(createError(400));

        // malicious path, forbidden
        if (0 != path.indexOf(root)) return next(createError(403));

        function on_directory() {
            var target;
            originalUrl.pathname += '/';
            target = url.format(originalUrl);
            res.statusCode = 303;
            res.setHeader('Location', target);
            res.end('Redirecting to ' + escape(target));
        }

        function on_file() {
            counter.increase(normalize(localpath));
        }

        function on_error(err) {
            if (404 == err.status) return next();
            next(err);
        }

        fs.stat(path, function(err, statResult) {
            if (err) return 'ENOENT' == err.code ? next() : next(err);

            if (statResult.isDirectory()) {
                if (path != '/' && originalUrl.pathname[originalUrl.pathname.length - 1] != '/') {
                    return on_directory();
                }

                function count(path, files, cb) {
                    var batch = new Batch();
                    batch.concurrency(10);

                    files.forEach(function(file){
                        batch.push(function(done){
                            counter.count(normalize(join(path, file)), done);
                        });
                    });

                    batch.end(cb);
                }

                function stat(dir, files, cb) {
                    var batch = new Batch();
                    batch.concurrency(10);

                    files.forEach(function(file){
                        batch.push(function(done){
                            fs.stat(join(dir, file), done);
                        });
                    });

                    batch.end(cb);
                }


                fs.readdir(path, function(err, files) {
                    if (err) return next(err);
                    files = removeHidden(files);

                    stat(path, files, function(err, stats) {
                        if (err) return next(err);
                        count(localpath, files, function(err, counters) {
                            if (err) return next(err);
                            result = files.map(function(file, i) {
                                return {
                                    name: file,
                                    size: stats[i].size,
                                    count: counters[i],
                                    date: stats[i].mtime.toDateString()+' '+stats[i].mtime.toLocaleTimeString(),
                                    path: encodeURIComponent(file),
                                    isDir: stats[i].isDirectory(),
                                    icon: stats[i].isDirectory() ? icons.folder : icons[extname(file)] || icons.default
                                };
                            });

                            result.sort(function(a, b) {
                                  return Number(b.isDir) - Number(a.isDir) ||
                                    String(a.name).toLocaleLowerCase().localeCompare(String(b.name).toLocaleLowerCase());
                            });

                            if (showUp) {
                                result.unshift({
                                    name: "..",
                                    path: "..",
                                    size: 0,
                                    date: "",
                                    isDir: true,
                                    icon: icons.folder,
                                    count: 0
                                });
                            }

                            res.render('directory', { path: localpath, files: result });
                        });
                    });
                });
            } else {
                send(req, localpath, {root: root})
                    .on('error', on_error)
                    .on('directory', on_directory)
                    .on('file', on_file)
                    .pipe(res)
            }
        });
    }
}

function escape(html) {
    return String(html)
        .replace(/&(?!\w+;)/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
};

/**
 * Icon map.
 */

var icons = {
    '.js': 'page_white_code_red.png'
  , '.json': 'page_white_code.png'
  , '.c': 'page_white_c.png'
  , '.h': 'page_white_h.png'
  , '.cc': 'page_white_cplusplus.png'
  , '.php': 'page_white_php.png'
  , '.rb': 'page_white_ruby.png'
  , '.erb': 'page_white_ruby.png'
  , '.cpp': 'page_white_cplusplus.png'
  , '.as': 'page_white_actionscript.png'
  , '.cfm': 'page_white_coldfusion.png'
  , '.cs': 'page_white_csharp.png'
  , '.java': 'page_white_cup.png'
  , '.jsp': 'page_white_cup.png'
  , '.dll': 'page_white_gear.png'
  , '.ini': 'page_white_gear.png'
  , '.asp': 'page_white_code.png'
  , '.aspx': 'page_white_code.png'
  , '.clj': 'page_white_code.png'
  , '.css': 'page_white_code.png'
  , '.sass': 'page_white_code.png'
  , '.scss': 'page_white_code.png'
  , '.less': 'page_white_code.png'
  , '.htm': 'page_white_code.png'
  , '.html': 'page_white_code.png'
  , '.xhtml': 'page_white_code.png'
  , '.lua': 'page_white_code.png'
  , '.m': 'page_white_code.png'
  , '.pl': 'page_white_code.png'
  , '.py': 'page_white_code.png'
  , '.vb': 'page_white_code.png'
  , '.vbs': 'page_white_code.png'
  , '.xml': 'page_white_code.png'
  , '.yaws': 'page_white_code.png'
  , '.map': 'map.png'

  , '.app': 'application_xp.png'
  , '.exe': 'application_xp.png'
  , '.bat': 'application_xp_terminal.png'
  , '.cgi': 'application_xp_terminal.png'
  , '.sh': 'application_xp_terminal.png'

  , '.avi': 'film.png'
  , '.flv': 'film.png'
  , '.mv4': 'film.png'
  , '.mov': 'film.png'
  , '.mp4': 'film.png'
  , '.mpeg': 'film.png'
  , '.mpg': 'film.png'
  , '.ogv': 'film.png'
  , '.rm': 'film.png'
  , '.webm': 'film.png'
  , '.wmv': 'film.png'
  , '.fnt': 'font.png'
  , '.otf': 'font.png'
  , '.ttf': 'font.png'
  , '.woff': 'font.png'
  , '.bmp': 'image.png'
  , '.gif': 'image.png'
  , '.ico': 'image.png'
  , '.jpeg': 'image.png'
  , '.jpg': 'image.png'
  , '.png': 'image.png'
  , '.psd': 'page_white_picture.png'
  , '.xcf': 'page_white_picture.png'
  , '.pdf': 'page_white_acrobat.png'
  , '.swf': 'page_white_flash.png'
  , '.ai': 'page_white_vector.png'
  , '.eps': 'page_white_vector.png'
  , '.ps': 'page_white_vector.png'
  , '.svg': 'page_white_vector.png'

  , '.ods': 'page_white_excel.png'
  , '.xls': 'page_white_excel.png'
  , '.xlsx': 'page_white_excel.png'
  , '.odp': 'page_white_powerpoint.png'
  , '.ppt': 'page_white_powerpoint.png'
  , '.pptx': 'page_white_powerpoint.png'
  , '.md': 'page_white_text.png'
  , '.srt': 'page_white_text.png'
  , '.txt': 'page_white_text.png'
  , '.doc': 'page_white_word.png'
  , '.docx': 'page_white_word.png'
  , '.odt': 'page_white_word.png'
  , '.rtf': 'page_white_word.png'

  , '.dmg': 'drive.png'
  , '.iso': 'cd.png'
  , '.7z': 'box.png'
  , '.apk': 'box.png'
  , '.bz2': 'box.png'
  , '.cab': 'box.png'
  , '.deb': 'box.png'
  , '.gz': 'box.png'
  , '.jar': 'box.png'
  , '.lz': 'box.png'
  , '.lzma': 'box.png'
  , '.msi': 'box.png'
  , '.pkg': 'box.png'
  , '.rar': 'box.png'
  , '.rpm': 'box.png'
  , '.tar': 'box.png'
  , '.tbz2': 'box.png'
  , '.tgz': 'box.png'
  , '.tlz': 'box.png'
  , '.xz': 'box.png'
  , '.zip': 'box.png'

  , '.accdb': 'page_white_database.png'
  , '.db': 'page_white_database.png'
  , '.dbf': 'page_white_database.png'
  , '.mdb': 'page_white_database.png'
  , '.pdb': 'page_white_database.png'
  , '.sql': 'page_white_database.png'

  , '.gam': 'controller.png'
  , '.rom': 'controller.png'
  , '.sav': 'controller.png'

  , 'folder': 'folder.png'
  , 'default': 'page_white.png'
};

