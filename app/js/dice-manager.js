(function (name, definition) {
	if (typeof module != 'undefined' && module.exports) module.exports = definition()
	else if (typeof define == 'function' && define.amd) define(definition)
	else this[name] = definition()
})('diceManager', function(require) {
	var UUID = require('./uuid'),
		sides = {
			attack: [],
			defence: []
		},
		callbacks = {
			add: {},
			remove: {}
		};

	return {
		setUUIDGenerator: function(custom) {
			UUID = custom || UUID;
		},
		reset: function() {
			sides = {
				attack: [],
				defence: []
			};
		},
		add: function(side, id, colour, die) {
			sides[side].push({
				uuid: id,
				colour: colour,
				die: die
			});

			for (var uuid in callbacks.add) {
				callbacks.add[uuid](this);
			}
		},
		remove: function(side, id) {
			var _this = this;

			sides[side].filter(function(el, i, arr) {
				if (el.uuid === id) {
					arr.splice(i, 1);

					for (var uuid in callbacks.remove) {
						callbacks.remove[uuid](_this);
					}
				}

				return;
			});
		},
		list: function() {
			return JSON.parse(JSON.stringify(sides));
		},
		addCallback: function(on, fn) {
			if (/function/i.test(typeof(fn))) {
				var uuid = UUID.generate();

				if (/both/i.test(on)) {
					callbacks.add[uuid] = fn;
					callbacks.remove[uuid] = fn;
				} else {
					callbacks[on][uuid] = fn;
				}

				return uuid;
			}
		},
		removeCallback: function(uuid) {
			if (callbacks.add.hasOwnProperty[uuid]) {
				delete callbacks.add[uuid];
			}

			if (callbacks.remove.hasOwnProperty[uuid]) {
				delete callbacks.remove[uuid];
			}
		}
	};
});