/**
 * @since 2017-05-31 19:42:13
 * @author vivaxy
 */

/**
 * todo
 * 1. socket to render title
 * 2. socket to live reload
 * 3. socket to role=master
 */

const path = require('path');

const ejs = require('ejs');
const Koa = require('koa');
const log = require('log-util');
const fse = require('fs-extra');
const send = require('koa-send');
const glob = require('glob-promise');

const projectRoot = process.cwd();
const revealRoot = path.join(__dirname, '..');
const templatePath = path.join(revealRoot, './template/index.ejs');

const readFile = async(filePath) => {
    return await fse.readFile(filePath, 'utf8');
};

const renderIndexHtml = async({ theme, highlightTheme, transition }) => {
    const template = await readFile(templatePath);
    const render = ejs.compile(template);
    return render({ theme, highlightTheme, transition });
};

const responses = {
    '/': async({ theme, highlightTheme, transition }) => {
        return {
            body: await renderIndexHtml({ theme, highlightTheme, transition }),
        };
    },
    '/node-reveal/reveal.md': async({ markdown }) => {
        return {
            body: await readFile(markdown),
        };
    },
};

const createServer = ({ markdown, theme, highlightTheme, transition, port }) => {
    const server = new Koa();

    const markdownRelativePath = path.relative(projectRoot, path.dirname(markdown));

    server.use(async(ctx) => {
        const { path } = ctx.request;
        if (responses[path]) {
            const getResponse = responses[path];
            const { body } = await getResponse({ markdown, theme, highlightTheme, transition });
            ctx.response.status = 200;
            ctx.response.body = body;
        } else if (path.startsWith('/reveal.js') || path.startsWith('/highlight.js')) {
            await send(ctx, path, { root: revealRoot });
        } else {
            // to resolve images and links relative to markdown
            await send(ctx, path, { root: markdownRelativePath });
        }
    });
    server.listen(port);
    log.debug('[reveal]', 'server started on', port);
};

const getValidThemes = async(base) => {
    const files = await glob(base + '/*.css');
    return files.map((file) => {
        return path.basename(file, '.css');
    });
};

const checkParameters = async({ markdown, theme, highlightTheme, transition, port }) => {
    const markdownExists = await fse.pathExists(markdown);
    if (!markdownExists) {
        log.error('[reveal]', 'markdown is required');
        process.exit(1);
    }
    const validThemes = await getValidThemes(path.join(revealRoot, 'reveal.js', 'css', 'theme'));
    if (!validThemes.includes(theme)) {
        log.error('[reveal]', 'valid themes:', validThemes.join('/'));
        process.exit(1);
    }
    const validHighlightTheme = await getValidThemes(path.join(revealRoot, 'highlight.js', 'src', 'styles', ''));
    if (!validHighlightTheme.includes(highlightTheme)) {
        log.error('[reveal]', 'valid highlight themes:', validHighlightTheme.join('/'));
        process.exit(1);
    }
    const validTransitions = ['none', 'fade', 'slide', 'convex', 'concave', 'zoom'];
    if (!validTransitions.includes(transition)) {
        log.error('[reveal]', 'valid transitions:', validTransitions.join('/'));
        process.exit(1);
    }
};

exports.command = 'server';
exports.describe = 'Start a nodejs server to display presentation';
exports.builder = {};
exports.handler = async({
                            markdown,
                            theme = 'solarized',
                            highlightTheme = 'solarized-light',
                            transition = 'slide',
                            port = 8080
                        }) => {
    await checkParameters({ markdown, theme, highlightTheme, transition, port });
    createServer({ markdown, theme, highlightTheme, transition, port });
};
