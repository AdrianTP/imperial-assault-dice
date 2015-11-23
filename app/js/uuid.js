/*
 UUID Utility
 Provides a method of generating UUIDs, storing a historical list,
 checking for collisions against previously-generated UUIDs, and resetting the historical list and collision counter
 */

(function (name, definition) {
	if (typeof module != 'undefined' && module.exports) module.exports = definition()
	else if (typeof define == 'function' && define.amd) define(definition)
	else this[name] = definition()
})('UUID', function() {
	var list = [],
		collisions = 0,
		random = Math.random;

	return {
		setRNG: function(rng) {
			random = rng || random;
		},
		generate: function() {
			var d = new Date().getTime(),
				col = collisions,
				uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
					var r = (d + random() * 16) % 16 | 0;
					d = Math.floor(d / 16);
					return (c == 'x' ? r : (r & 0x7 | 0x8)).toString(16);
				});

			for (var i = 0; i < list.length; i ++) {
				if (uuid === list[i]) {
					collisions ++;
				}
			}

			if (col === collisions) {
				list.push(uuid);
				return uuid;
			} else {
				this.generate();
			}
		},
		reset: function() {
			list = [];
			collisions = 0;
		}
	};
});