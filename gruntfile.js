module.exports = function (grunt) {
	grunt.initConfig({
		watch: {
			options: { livereload: true },
			less: {
				files: "less/*",
				tasks: ["less"]
			}
		},
		less: {
			dist: {
				files: {
					'css/style.css': ['less/main.less']
				},
				options: {
					sourceMap: true,
					sourceMapFilename: 'css/style.css.map',
					sourceMapBasepath: '/',
					sourceMapRootpath: '/'
				}
			}
		}

	});
	grunt.loadNpmTasks('grunt-contrib-watch');
	grunt.loadNpmTasks('grunt-contrib-less');

	grunt.registerTask('all', [
		'less',
		'watch'
	]);

	grunt.registerTask('default', [
		'all'
	]);
};
