/**
 * Created by zaccary.price on 22/06/2015.
 */

var gulp			= require('gulp');
var uglify			= require('gulp-uglify');
var minifyHtml	= require('gulp-minify-html');
var minifyCss		= require('gulp-minify-css');
var autoprefixer	= require('gulp-autoprefixer');
var connect		= require('gulp-connect');
var sass			= require('gulp-sass');
var inject			= require('gulp-inject');
var rev			= require('gulp-rev');
var useref			= require('gulp-useref');
var gulpif			= require('gulp-if');
var runSequence	= require('gulp-run-sequence');
var imagemin		= require('gulp-imagemin');
var path			= require('path');
var del			= require('del');
var vinylPaths		= require('vinyl-paths');
var wiredep		= require('wiredep').stream;
var cp				= require('child_process');
var pngquant		= require('imagemin-pngquant');


// configuration
var ports = {
	dev: 9090,
	dist: 9091
};

var paths = {
	src: 'src',
	dist: 'dist',
	jekyll: 'jekyll',
	tmp: '.tmp'
};

// clean <tmp> directory
gulp.task('clean:tmp', function(done) {
	return gulp.src(path.join(paths.tmp, '*'))
		.pipe(vinylPaths(del));
});

// clean <dist> directory
gulp.task('clean:dist', function() {
	return gulp.src(path.join(paths.dist, '*'))
		.pipe(vinylPaths(del));
});

// clean <dist> directory
gulp.task('clean:jekyll', function() {
	return gulp.src(path.join(paths.jekyll, '*'))
		.pipe(vinylPaths(del));
});

// compile sass/scss files and run autoprefixer on processed css
gulp.task('sass', function() {
	console.log(path.join(paths.src, 'assets/stylesheets/app.scss'));
	gulp.src([path.join(paths.src, 'assets/stylesheets/app.scss'), '!node_modules/**/*.scss'])
		.pipe(sass().on('error', sass.logError))
		.pipe(autoprefixer())
		.pipe(gulp.dest(path.join(paths.tmp, 'assets/stylesheets/')));
});


// inject javascript files into inject:js
// block in index.html
gulp.task('inject:js', function() {
	var target = gulp.src(path.join(paths.src, "/_layouts/default.html"));
	var sources = [path.join(paths.src, "assets/scripts/**/*.js")];

	var opts = {
		read: false,
		transform: function(filePath) {
			filePath = filePath.replace('/' + paths.src + '/', '/');
			filePath = filePath.replace('/.tmp/', '/');
			return '<script src="' + filePath + '"></script>';
		}
	};

	target
		.pipe(inject(gulp.src(sources), opts))
		.pipe(gulp.dest(path.join(paths.src, '/_layouts/')));
});

// inject scss files into `// inject:scss` block in main.scss
gulp.task('inject:sass', function() {
	var target = gulp.src([path.join(paths.src, "assets/stylesheets/app.scss")]);
	var sources = [
		path.join(paths.src, "assets/stylesheets/**/*.scss"),
		"!" + path.join(paths.src, "assets/stylesheets/app.scss")
	];

	var opts = {
		read: false,
		starttag: '// inject:{{ext}}',
		endtag: '// endinject',
		transform: function (filePath) {
			filePath = filePath.replace('/' + paths.src + '/assets/stylesheets/', '');
			filePath = filePath.replace(/([\w\/]*?)_?([\w\.\-]+?)\.(sass|scss)/, "$1$2");
			return '@import "' + filePath + '";';
		}
	};

	target
		.pipe(inject(gulp.src(sources), opts))
		.pipe(gulp.dest(path.join(paths.src, 'assets/stylesheets/')));
});

gulp.task('bower:html', function () {
	gulp.src(path.join(paths.src, '_layouts/default.html'))
		.pipe(wiredep())
		.pipe(gulp.dest(path.join(paths.src, '_layouts/')));
});
gulp.task('bower:sass', function () {
	gulp.src(path.join(paths.src, 'assets/stylesheets/app.scss'))
		.pipe(wiredep())
		.pipe(gulp.dest(path.join(paths.src, 'assets/stylesheets/')));
});

// watch for file changes and run injection and processing
gulp.task('watch', function() {
	gulp.watch('bower.json', ['bower:html', 'bower:sass']);
	gulp.watch(path.join(paths.src, '**/*.html'), ['jekyll']);
	gulp.watch(path.join(paths.src, '**/*.js'), ['inject:js']);
	gulp.watch(path.join(paths.src, '**/*.scss'), ['inject:sass', 'sass']);
});


// run concatenation, minification and reving
// using build blocks in *.html
// outputting resulting files to <dist>
gulp.task('useref', function() {
	"use strict";
	var assets = useref.assets();

	gulp.src(path.join(paths.jekyll, '**/*.html'))
		.pipe(assets)
		.pipe(gulpif('*.js', uglify(), rev()))
		.pipe(gulpif('*.css', minifyCss(), rev()))
		.pipe(assets.restore())
		.pipe(useref())
		.pipe(gulp.dest(paths.dist + '/'));

});




gulp.task('jekyll', function(done) {
	"use strict";

	var jekyllExec = process.platform === "win32" ? "jekyll.bat" : "jekyll";

	return cp
		.spawn(jekyllExec, ['build'], {stdio: 'inherit'})
		.on('close', done);
});

// run local server, connecting the <.tmp> routes
// to allow loading compiled files from <.tmp>
gulp.task('connect', function() {
	connect.server({
		root: [paths.jekyll, paths.tmp],
		port: ports.dev
	});
});

// run local server with root at <dist>
// to emulate production server
gulp.task('connect:dist', function() {
	connect.server({
		root: paths.dist,
		port: ports.dist
	});
});

gulp.task('imagemin', function() {
	"use strict";
	return gulp.src(path.join(paths.jekyll, 'assets/images/**/*'))
		.pipe(imagemin({
			progressive: true,
			svgoPlugins: [{removeViewBox: false}],
			use: [pngquant()]
		}))
		.pipe(gulp.dest(path.join(paths.dist, 'images')));
});

gulp.task('build', function(done) {
	"use strict";
	runSequence(
		['clean:tmp', 'clean:jekyll', 'clean:dist'],
		['inject:sass', 'inject:js', 'bower:html', 'bower:sass'],
		'sass',
		'jekyll',
		'imagemin',
		'useref',
		done
	);
});

gulp.task('serve', function(done) {
	"use strict";
	runSequence(
		['clean:tmp', 'clean:jekyll'],
		['inject:js', 'inject:sass', 'bower:html', 'bower:sass'],
		'sass',
		'jekyll',
		'connect',
		'watch',
		done
	)
});
gulp.task('serve:dist', ['build', 'connect:dist']);
