/**
 * Understand gulp http://code.tutsplus.com/tutorials/managing-your-build-tasks-with-gulpjs--net-36910
 */
/**
 * npm install npm-check-updates -g
 */

/**
 * TODO distinguish in file between CI only tasks
 * because of longer initial times by require statements and clean code
 * gulp --gulpfile mygulpfile.js
 */

module.exports = function (gulp, CONFIG) {

    if (!CONFIG) {
        CONFIG = require(".//Build_Config");
    }

    var plugins = {};
// TODO introduce minify
// plugins.uglify = require("gulp-uglify");

    plugins.template = require("gulp-template");
    plugins.concat = require("gulp-concat");
    plugins.tsc = require("gulp-tsc");

    plugins.plumber = require("gulp-plumber");
    plugins.ngHtml2js = require("gulp-ng-html2js");

    
    plugins.changed = require("gulp-changed");
    plugins.watch = require("gulp-watch");


    var npms = {};
    var gulp_utils = require("./gulp_utils");

    var partials = {};
    partials.errorPipe = gulp_utils.errorPipe;

    // TODO not used atm.
//    plugins.open = require("gulp-open");
//    plugins.connect = require("gulp-connect");

//    plugins.tsd = require("gulp-tsd");
//    plugins.gulpif = require("gulp-if");

    var del = require("del");
    var child_process = require("child_process");
    var _ = require("lodash");

//require("gulp-grunt")(gulp);
    var fs = require("fs");

// TODO CHECK for what?
    //require("shelljs/global"); // TODO needed ?

//var phantomas = require("phantomas");

    // default by convention of gulp
    gulp.task("default", ["dev"]);
    // "prod:jslibs", moved to global-libs
    gulp.task("prod:once", ["prod"]);
    gulp.task("prod", ["prod:tscompile", "templates"]); // use prod only
    gulp.task("dev", ["devFromCommon"]);//"openBrowser" "tscopysrc"
    gulp.task("devFromCommon", ["dev:once", "webserver", "watch"]);
    // "cleanTarget",
    gulp.task("dev:once", ["js-thirdparty", "tscompile", "tscompiletests","templates"], function () {
        // TODO move
        // Obsolete ( and wrong path), instead webserver links to bower_components direct
        gulp.src(CONFIG.SRC.THIRDPARTY.FONTS())
            .pipe(gulp.dest(CONFIG.DIST.FOLDER() + "/css/fonts/"))
        //    .pipe(gulp.dest(CONFIG.DAB_CQ.DEV.CSS.FOLDER() + "/fonts/"));

        console.log("Successful processed.");
    });


    gulp.task("echo", function () {
        console.log("ECHO!!!!!!" + CONFIG.DEV.ABSOLUTE_FOLDER());
    });

    gulp.task("cleanTarget", function(callback){
        del(["target"], callback);
    });

    // for dev: use the intellij watcher.xml to import
    // See explanations: https://github.com/palantir/tslint
    //            ,"check-lowercase"
    gulp.task("tslint", function () {
        plugins.tslint = plugins.tslint || require('gulp-tslint');
        // TODO cache and move
        var tslintConfig = require("./tslint.json");

        gulp.src(["src/**/*.ts"])
            .pipe(partials.errorPipe())
            .pipe(plugins.tslint({configuration : tslintConfig}))
            .pipe(plugins.tslint.report("verbose"));
    });

    // TODO use with repository not linking instead
    //gulp.task("bump", function () {
    //    plugins.bump = plugins.bump ||require("gulp-bump");
    //    gulp.src("bower_export/bower.json")
    //        .pipe(plugins.bump({version: getBowerJson().version + "+" + Math.random()}))
    //        .pipe(gulp.dest("bower_export/"));
    //});

    gulp.task("js-thirdparty", function () {
        gulp.src(CONFIG.SRC.JS.LIBS())
            .pipe(plugins.concat(CONFIG.DIST.JS.FILES.LIBS()))
            .pipe(gulp.dest(CONFIG.DIST.JS.FOLDER()));

        gulp.src(CONFIG.SRC.JS.SINGLE_LIBS())
            .pipe(gulp.dest(CONFIG.DIST.JS.FOLDER()));
    });

    gulp.task("js-app", function () {
        gulp.src(CONFIG.SRC.TS.FILES())
            .pipe(partials.errorPipe())
            .pipe(plugins.concat(CONFIG.DIST.JS.FILES.APP()))
            .pipe(gulp.dest(CONFIG.DIST.JS.FOLDER()));
    });

    gulp.task("templates", function () {
        // Templating at Build Time
        gulp.src(CONFIG.DEV.HTML_MAIN())
            .pipe(partials.errorPipe())
            .pipe(
            plugins.template({
                headFiles: {
                    css: CONFIG.DIST.CSS.HEAD_FILE(),
                    js: CONFIG.DIST.JS.HEAD_FILES()
                },
                content: fs.readFileSync(CONFIG.PARTIALS.MAIN())
            }, {
                interpolate: /<%gulp=([\s\S]+?)%>/g,
                evaluate: /<%gulp([\s\S]+?)%>/g
            })
        )
            .pipe(gulp.dest(CONFIG.DIST.FOLDER()));

	var camelCaseModuleName = CONFIG.DYNAMIC_META.MODULE_NAME().replace(/-([a-z])/g, function(g) {
		return g[1].toUpperCase();});

        // Angular templates, read at runtime
        gulp.src(CONFIG.SRC.ANGULAR_HTMLS())
            .pipe(plugins.ngHtml2js({
                moduleName: camelCaseModuleName + "Templatecache", 
                prefix: "/"
            }))
            .pipe(plugins.concat(CONFIG.DIST.JS.FILES.TEMPLATES()))
            .pipe(gulp.dest(CONFIG.DIST.FOLDER()))
            // TODO distinguish between prod and not
            .pipe(gulp.dest(CONFIG.DAB_CQ.DIST.CURRENT_MODULE()));
    });

    gulp.task("echo", function(){
        console.log("parent");
    });

    gulp.task("watch", function (cb) {
        gulp.watch(CONFIG.SRC.TS.TS_FILES(), ["tscompile"]);
        gulp.watch(CONFIG.SRC.TS.TS_UNIT_TEST_FILES(), ["tscompiletests"]);
        gulp.watch(CONFIG.SRC.ALL_HTML_TEMPLATES(), ["templates"]);
    });

    gulp.task("webserver", function () {
		plugins.browserSync = plugins.browserSync || require("browser-sync");    

		

        var recursive = "**/*.*";
        // TODO reduce to minimum
        var filesToWatch = [
            CONFIG.DIST.FOLDER() + recursive,
            //"../../bower_export/sass/target/**/*",
            CONFIG.SRC.SASS_TARGET_FOLDER() + recursive
        ];

        plugins.browserSync.init(filesToWatch, {
            server: {
                baseDir: CONFIG.DEV.WEBSERVER_BASE_ROOT_DIRS()
                //port : 3000
            }
        });
    });

    // TODO refactor to dev:tscompile
    gulp.task("tscompile", function () {
        console.log(CONFIG.SRC.TS.TS_FILES());
        gulp.src(CONFIG.SRC.TS.TS_FILES())
            .pipe(partials.errorPipe())
            .pipe(plugins.tsc(
                {
                    allowBool: true,
                    out: CONFIG.DIST.JS.FILES.APP(), 
                    // tmpDir : "./ts_tmp",
                    sourcemap: true,
                    sourceRoot: "/",
                    target: "ES5"
                    //noLib: false
                    , tscPath: CONFIG.DEV.CUSTOM_TYPESCRIPT_COMPILER() || null
                }))
            .pipe(gulp.dest(CONFIG.DIST.FOLDER()))
    });

    gulp.task("tscompiletests", function () {
        console.log(CONFIG.SRC.TS.TS_UNIT_TEST_FILES());
        gulp.src(CONFIG.SRC.TS.TS_UNIT_TEST_FILES())
            .pipe(partials.errorPipe())
            .pipe(plugins.tsc(
                {
                    allowBool: true,
                    out: "tests.js",//CONFIG.FOLDER.JS(), //"js",//
                    // tmpDir : "./ts_tmp",
                    sourcemap: true,
                    sourceRoot: "/",
                    target: "ES5",
                    //noLib: false
                    tscPath: CONFIG.DEV.CUSTOM_TYPESCRIPT_COMPILER() || null
                }))
            .pipe(gulp.dest(CONFIG.DEV.UNIT_TESTS_JS_FOLDER()));
    });


    gulp.task("prod:tscompile", function () {
        plugins.ngAnnotate = plugins.ngAnnotate || require("gulp-ng-annotate");

        gulp.src(CONFIG.SRC.TS.TS_FILES())
            .pipe(partials.errorPipe())
            .pipe(plugins.tsc(
                {
                    allowBool: true,
                    out: CONFIG.DIST.JS.FILES.APP(), 
                    // tmpDir : "./ts_tmp",
                    sourcemap: false,
                    sourceRoot: null,
                    target: "ES3"
                    //noLib: false
                    , tscPath: CONFIG.DEV.CUSTOM_TYPESCRIPT_COMPILER() || null
                }))
            .pipe(plugins.ngAnnotate())
            .pipe(gulp.dest(CONFIG.DAB_CQ.DIST.CURRENT_MODULE()));
    });

    /**
     * Run unit test once and exit
     */
    gulp.task("test", function (done) {
        // TODO strategy to run tests separated
        npms.karma = npms.karma || require("karma").server; // TODO move server call to later
        npms.karma.start({
            // "/node_modules/web3-common-build-setup/"+
            configFile: __dirname + "\\karma.conf.js",
            // Override specific config from file
            singleRun: true
            //browsers: ["PhantomJS"]
        }, done);
    });

// If not started in chromeOnly-mode, need to start selenium first
    // TODO switch for non chromeOnly mode
    gulp.task("protractor", function () {
        npms.protractor = npms.protractor || require("gulp-protractor").protractor;

        // TODO must be in sync with specs of protractor
        //var srcNeeededForIntegrTest = "src/**/*.js";
        gulp.src([
//            CONFIG.DEV.UI_TEST_FILES()
             // CONFIG.DEV.ABSOLUTE_FOLDER()+"features/**/*.feature"
        ])
            .pipe(npms.protractor({
                //options : {
                configFile: CONFIG.DEV.PROTRACTOR_CONFIG()
                //args: {
                //    "specs" : ["whoo.js"]
                //}
                //}
            }))
            .on("error", function (e) {
                console.log(JSON.stringify(e));
                throw e;
            });
    });

    // TODO used for CI and other browsers, atm chromeOnly mode is used to be fast
    gulp.task("seleniumServer", function () {
        var webdriverPath = CONFIG.FOLDER.DAB_WEBDEV() + "node_modules\\chromedriver\\lib\\chromedriver\\chromedriver.exe";
        var command = "java -jar " + CONFIG.DEV.ABSOLUTE_FOLDER() + "\\node_modules\\selenium-server-standalone-jar\\jar\\selenium-server-standalone-2.40.0.jar -Dwebdriver.chrome.driver=" + webdriverPath;
        exec(command, function (status, output) {
            console.log("Exit status:", status);
            console.log("Program output:", output);
        });
    });

    gulp.task('ngdocs', [], function () {
        plugins.ngdocs = require("gulp-ngdocs");
        var options = {
//            scripts: ['../app.min.js'],
            html5Mode: true,
            startPage: '/api',
            title: "My Awesome Docs",
            image: "path/to/my/image.png",
            imageLink: "http://my-domain.com",
            titleLink: "/api"
        }
        return gulp.src(CONFIG.DIST.FOLDER() + CONFIG.DIST.JS.FILES.APP())
            .pipe(plugins.ngdocs.process(options))
            .pipe(gulp.dest(CONFIG.CI.DOCS_FOLDER()));
    });


//gulp.task("setup", function (cb) {
//    var bower = require("node_modules/bower/bin/bower");
//    bower();
//});

//    gulp.task("statistics", function (cb) {
//        gulp.run("uncss");
////    gulp.run("grunt-phantomas");
//    });

    //gulp.task("lint", function () {
    //    require("gulp-jshint");
    //    return gulp.src(CONFIG.SRC.TS.FILES())
    //        .pipe(plugins.jshint())
    //        .pipe(plugins.jshint.reporter("default"));
    //});

    //gulp.task("dgeni", function () {
    //    // TODO dgeni not full setup
    //    npms.dgeni = npms.dgeni || require("dgeni");
    //
    //    var dgeniInstance = new dgeni([require("./docs.config.js")]);
    //    dgeniInstance.generate().catch(function(error) {
    //        process.exit(1);
    //    });
    //});

    return gulp;
};



