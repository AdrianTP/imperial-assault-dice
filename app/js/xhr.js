/*
 UUID Utility
 Provides a method of generating UUIDs, storing a historical list,
 checking for collisions against previously-generated UUIDs, and resetting the historical list and collision counter
 */

(function (name, definition) {
	if (typeof module != 'undefined' && module.exports) module.exports = definition()
	else if (typeof define == 'function' && define.amd) define(definition)
	else this[name] = definition()
})('XHR', function(require) {
	var q = require('q/q');
	return {
		get: function(url) {
			var deferred = q.defer(),
				req = new XMLHttpRequest();

			req.open('GET', url, true);

			req.addEventListener('load', function() {
				if (req.status == 200) {
					deferred.resolve(req.response);
				} else {
					deferred.reject(Error(req.statusText));
				}
			});

			req.addEventListener('progress', function(e) {
				if (e.lengthComputable) {
					deferred.notify(e.loaded / e.total);
				};
			});

			req.addEventListener('error', function() {
				deferred.reject(Error('Cannot GET ' + url));
			});

			req.send(null);

			return deferred.promise;
		}
	};
});