/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
module.exports = function() {
  // Project configuration
  this.initConfig({
    pkg: this.file.readJSON('package.json'),

    // Browser build
    noflo_browser: {
      options: {
        baseDir: './'
      },
      build: {
        files: {
          'browser/fbp-graph.js': ['webpack.entry.js']
        }
      }
    },

    // BDD tests on Node.js
    mochaTest: {
      nodejs: {
        src: ['spec/*.js'],
        options: {
          reporter: 'spec',
          grep: process.env.TESTS
        }
      }
    },

    // BDD tests on browser
    karma: {
      unit: {
        configFile: 'karma.config.js'
      }
    },
  });

  // Grunt plugins used for building
  this.loadNpmTasks('grunt-noflo-browser');

  // Grunt plugins used for testing
  this.loadNpmTasks('grunt-mocha-test');
  this.loadNpmTasks('grunt-karma');

  // Our local tasks
  this.registerTask('build', 'Build for the chosen target platform', target => {
    if (target == null) { target = 'all'; }
    if ((target === 'all') || (target === 'browser')) {
      return this.task.run('noflo_browser');
    }
  });

  this.registerTask('test', 'Build and run automated tests', target => {
    if (target == null) { target = 'all'; }
    this.task.run(`build:${target}`);
    if ((target === 'all') || (target === 'nodejs')) {
      this.task.run('mochaTest');
    }
    if ((target === 'all') || (target === 'browser')) {
      return this.task.run('karma');
    }
  });

  return this.registerTask('default', ['test']);
};
