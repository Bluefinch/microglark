/* jshint node: true, camelcase: false */
'use strict';

module.exports = function (grunt) {

    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),

        jsfiles: [
            'Gruntfile.js',
            'app.js',
            'public/javascripts/*.js'
        ],

        clean: {
            main: ["www"]
        },

        copy: {
            main: {
                files: [
                    {expand: true, src: ['public/**'], dest: 'www/'},
                ]
            }
        },

        postcss: {
            options: {
                map: true,
                processors: [
                    require('autoprefixer')({browsers: 'last 2 versions'}),
                    require('cssnano')()
                ]
            },
            dist: {
                src: 'www/**/*.css'
            }
        },

        jsbeautifier: {
            files: ['<%= jsfiles %>'],
            options: {
                space_after_anon_function: true
            }
        },

        jshint: {
            options: {
                /* camelcase: true, */
                eqeqeq: true,
                indent: 4,
                latedef: true,
                newcap: true,
                nonew: true,
                undef: true,
                unused: true,
                trailing: true,
                white: true,
                globalstrict: true,
                node: true,
                browser: true,
                jquery: true,
                devel: true,
                globals: {
                    /* Jasmine variables. */
                    jasmine: false,
                    it: false,
                    describe: false,
                    expect: false,
                    beforeEach: false,
                    sleep: false,
                    input: false
                }
            },
            files: ['<%= jsfiles %>']
        },

        watch: {
            files: ['public/**/*'],
            tasks: ['build']
        }
    });

    grunt.loadNpmTasks('grunt-postcss');
    grunt.loadNpmTasks('grunt-jsbeautifier');
    grunt.loadNpmTasks('grunt-contrib-jshint');
    grunt.loadNpmTasks('grunt-contrib-clean');
    grunt.loadNpmTasks('grunt-contrib-copy');
    grunt.loadNpmTasks('grunt-contrib-watch');

    grunt.registerTask('lint', ['jsbeautifier', 'jshint']);
    grunt.registerTask('build', ['clean', 'copy', 'postcss']);
};
