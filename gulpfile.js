var gulp = require('gulp')
var gutil = require('gulp-util')
var browserify = require('browserify')
var source = require('vinyl-source-stream')
var buffer = require('vinyl-buffer')
var runSequence = require('run-sequence')
var del = require('del')
var print = require('gulp-print')
var stripNgLog = require('gulp-strip-ng-log')

gutil.log('Building...')

var production = gutil.env.type === 'production'
var sourceDir = './src/'
var distroDir = './dist/'
var browserifyOpts = {
  entries: 'index.js',
  basedir: sourceDir,
  debug: !production
}

gutil.log('Building... in production? %s', production)
gutil.log('Building... source dir %s', sourceDir)
gutil.log('Building... distro dir %s', distroDir)

gulp.task('clean', function () {
  return del(distroDir).then(function log (paths) {
    gutil.log('Deleted:\n', paths.join('\n  '))
  })
})
gulp.task('copy', function copy () {
  return gulp.src([sourceDir + 'index.html', sourceDir + 'background.js', sourceDir + 'manifest.json', sourceDir + 'imgs/**'], {base: sourceDir})
    .pipe(print())
    .pipe(gulp.dest(distroDir))
})
gulp.task('js', function browserifyBundle () {
  var b = browserify(browserifyOpts)
  b.ignore('olm')
  b.on('log', gutil.log)
  b.on('error', gutil.log)

  var bundler = b.bundle().pipe(source('main.js'))
  if (production) {
    bundler = bundler.pipe(stripNgLog())
  }
  return bundler.pipe(print())
    .pipe(buffer())
    .pipe(gulp.dest(distroDir))
})
gulp.task('build', function (cb) {
  runSequence('clean', 'js', 'copy', cb)
})
gulp.task('default', function (cb) {
  runSequence('build', cb)
})
