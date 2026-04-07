const fs = require('fs');

const target = process.argv[2];

if (!target) {
    throw new Error('Usage: node inject-request-logs.js <target-file>');
}

const source = fs.readFileSync(target, 'utf8');

if (source.includes('[ACCESS]')) {
    console.log('Request logging already present, skipping patch.');
    process.exit(0);
}

const needle = 'var app = (0, express_1.default)();';
const insert = `${needle}\napp.use(function (req, res, next) {\n    var started = Date.now();\n    console.log("[ACCESS] ".concat(req.method, " ").concat(req.originalUrl));\n    res.on('finish', function () {\n        console.log("[ACCESS] ".concat(req.method, " ").concat(req.originalUrl, " ").concat(res.statusCode, " ").concat(Date.now() - started, "ms"));\n    });\n    next();\n});`;

if (!source.includes(needle)) {
    throw new Error(`Could not find injection point in ${target}`);
}

fs.writeFileSync(target, source.replace(needle, insert), 'utf8');
console.log(`Injected request logger into ${target}`);
