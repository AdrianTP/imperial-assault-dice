//	Imperial Assault Dice Probability Calculator
//	By AdrianTP
//	Version 1.0 finished 2015-11-23
//	Last Update 2015-11-23
//	========================================================================================
//	TODO:
//			Get or make dice images
//				Images of each die isometric
//	DONE		Images of each side flat
//	DONE	Make recursive calculation function and probability table builder
//	DONE		Exact
//	NOPE		Greater than
//			Two modes:
//	DONE		normal -- only attack or only defence
//	DONE			calculate raw probabilities of each feature
//				versus -- attack and defence
//					calculate raw probabilities of each feature
//					calculate outcome probabilities
//	DONE	Dice Roller

(function (name, definition) {
	if (typeof module != 'undefined' && module.exports) module.exports = definition()
	else if (typeof define == 'function' && define.amd) define(definition)
	else this[name] = definition()
})('index', function(require) {
	var Alea = require('./Alea'),
		UUID = require('./uuid'),
		gameId = UUID.generate(), // Generate Game Identifier which can be used to repeat identical game circumstances
		aleaInstance = Alea.getInstance(gameId),
		xhr = require('./xhr'),
		startTime = Date.now(),
		currentGame = null,
		dice = null,
		dir = null,
		games = null,
		elements = {},
		manager = require('./dice-manager.js'),
		toggleListDisplayUUID = null,
		clearResultsContainer = null;

	UUID.setRNG(aleaInstance);
	manager.setUUIDGenerator(UUID);

	var displayProgress = function (progress) {
		console.log(Math.round(progress * 100));
	};

	var displayError = function(error) {
		console.error(error)
	};

	var setupListDisplay = function() {
		elements.modal.classList.add('hidden');
		elements.statsButton.classList.add('hidden');
		elements.rollButton.classList.add('hidden');
		elements.selectedAttackLi.classList.add('hidden');
		elements.selectedDefenceLi.classList.add('hidden');

		toggleListDisplayUUID = manager.addCallback('both', function(sel) {
			var list = sel.list(),
				attack = Object.keys(list.attack).length > 0,
				defence = Object.keys(list.defence).length > 0;

			elements.wrapper.classList.toggle('button-shown', (attack || defence));
			elements.noDice.classList.toggle('hidden', (attack || defence));
			elements.statsButton.classList.toggle('hidden', !(attack || defence));
			elements.rollButton.classList.toggle('hidden', !(attack || defence));
			elements.selectedAttackLi.classList.toggle('hidden', !attack);
			elements.selectedDefenceLi.classList.toggle('hidden', !defence);

			if (attack || defence) {
				elements.statsButton.removeAttribute('disabled');
				elements.rollButton.removeAttribute('disabled');
			} else {
				elements.statsButton.setAttribute('disabled', 'disabled');
				elements.rollButton.setAttribute('disabled', 'disabled');
			}
		});

		clearResultsContainer = manager.addCallback('both', function(sel) {
			elements.resultsContainer.innerHTML = '';
		});

		elements.statsButton.addEventListener('click', calculate);
		elements.rollButton.addEventListener('click', roll);

		// Add event listeners to lists
		elements.availableUl.addEventListener('click', addDie);

		elements.selectedAttackUl.addEventListener('click', removeDie('attack'));
		elements.selectedDefenceUl.addEventListener('click', removeDie('defence'));
	};

	var recursiveDice = function(remainingDice, dieIndex, previousDieCurrentFace) {
		var results = [],
			currentDie;

		if (typeof(dieIndex) === 'undefined') {
			dieIndex = 0;
		}

		currentDie = remainingDice[dieIndex];

		for (var i = 0; i < currentDie.die.faces.length; ++ i) {
			var currentDieCurrentFace = currentDie.die.faces[i],
				sums = {};

			for (var effect in currentDieCurrentFace) {
				if (typeof(previousDieCurrentFace) === 'undefined') {
					previousDieCurrentFace = {};
				}

				if (typeof(previousDieCurrentFace[effect]) === 'undefined') {
					previousDieCurrentFace[effect] = 0;
				}

				var sum = previousDieCurrentFace[effect] + currentDieCurrentFace[effect];
				if (!sums.hasOwnProperty(effect)) {
					sums[effect] = sum;
				} else {
					sums[effect] += sum;
				}
			}

			if (typeof(remainingDice[dieIndex + 1]) === 'undefined') {
				results.push(sums);
			} else {
				results = results.concat(recursiveDice(remainingDice, (dieIndex + 1), sums));
			}
		}

		return results;
	};

	var processResults = function(rolls) { // sorted ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		var sorted = sortResults(rolls),
			totals = totalSortedResults(sorted),
			processed = calculateStats(sorted, totals, rolls);

		processed.sorted = sorted;
		processed.totals = totals;

		return processed;
	};

	var calculateStats = function(sorted, totals, rolls) {
		var means = {},
			maximums = {},
			medians = {},
			minimums = {},
			modes = {},
			probabilities = {};

		for (var effect in sorted) {
			// Calculate Means
			var total = 0;

			for (var i = 0; i < sorted[effect].length; ++ i) {
				total += sorted[effect][i];
			}

			means[effect] = total / sorted[effect].length;

			// Calculate Maximums
			maximums[effect] = sorted[effect][sorted[effect].length - 1];

			// Calculate Medians
			if (sorted[effect].length === 0) { // No values; no median
				medians[effect] = null;
			} else if (sorted[effect].length === 1) { // Only one value; that value becomes the median
				medians[effect] = sorted[effect][0];
			} else if (sorted[effect].length % 2 > 0) { // Odd number of values; just get the middle value
				var indexToGet = Math.floor(sorted[effect].length / 2);
				medians[effect] = sorted[effect][indexToGet];
			} else { // even number of values; need to find the average between the two values surrounding the middle
				var indexToGet = sorted[effect].length / 2,
					median = (sorted[effect][indexToGet] + sorted[effect][indexToGet - 1]) / 2;

				medians[effect] = median;
			}

			// Calculate Minimums
			for (var effect in sorted) {
				minimums[effect] = sorted[effect][0];
			}
		}

		// Too bad these have to go in its own loop :(
		for (var effect in totals) {
			// Calculate Modes
			var mode = [],
				max = 0

			for (var i = 0; i < totals[effect].length; ++ i) {
				if (totals[effect][i] > max) {
					mode = [i];
					max = totals[effect][i];
				} else if (totals[effect][i] === max) {
					mode.push(i);
				}
			}

			modes[effect] = mode;

			// Calculate Probabilities
			for (var i = 0; i < totals[effect].length; ++i) {
				if (!probabilities.hasOwnProperty(effect)) {
					probabilities[effect] = [];
				}

				if (typeof(totals[effect][i]) === 'undefined') {
					probabilities[effect][i] = 0;
				} else {
					probabilities[effect][i] = totals[effect][i] / rolls.length;
				}
			}
		}

		return {
			means: means,
			maximums: maximums,
			medians: medians,
			minimums: minimums,
			modes: modes,
			probabilities: probabilities
		};
	};

	// Bucket-sort the roll results values by effect in numerical order for easier analysis
	var sortResults = function(results) { // results ~= [{damage: <int>, range: <int>, surge: <int>}];
		var sorted = {};

		for (var i = 0; i < results.length; ++ i) {
			for (var effect in results[i]) {
				if (!sorted.hasOwnProperty(effect)) {
					sorted[effect] = [];
				}

				sorted[effect].push(results[i][effect]);
			}
		}

		// TODO: See about optimising this so sorting is included in the above loops
		for (var effect in sorted) {
			sorted[effect].sort();
		}

		return sorted;
	};

	// Count the number of instances of each value among all rolls
	var totalSortedResults = function(sorted) { // sorted ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		var totals = {};

		for (var effect in sorted) {
			// count the number of instances of each value among all rolls
			if (!totals.hasOwnProperty(effect)) {
				totals[effect] = [];
			}

			// Place the total count of each value at the index equivalent to that value
			for (var i = 0; i < sorted[effect].length; ++ i) {
				if (typeof(totals[effect][sorted[effect][i]]) === 'undefined') {
					totals[effect][sorted[effect][i]] = 0;
				}

				++ totals[effect][sorted[effect][i]];
			}
		}

		return totals;
	};

	var calculate = function(e) {
		elements.message.innerText = 'Calculating...';
		elements.modal.classList.remove('hidden');
		elements.statsButton.classList.add('hidden');
		elements.rollButton.classList.add('hidden');
		elements.wrapper.classList.remove('button-shown');

		setTimeout(calculationTimeoutCallback, 100);
	};

	var roll = function(e) {
		var list = manager.list(),
			html = '<ul id="rolled" class="dice">',
			ul = document.createElement('ul');

		elements.statsButton.classList.add('hidden');
		elements.rollButton.classList.add('hidden');
		elements.wrapper.classList.remove('button-shown');

		for (var role in list) {
			if (list[role].length > 0) {
				html	+=	'<li class="' + role + '">'
						+		'<h3>' + capitaliseString(role) + '</h3>'
						+		'<ul>'

				for (var i = 0; i < list[role].length; ++ i) {
					var face = '-' + getRandomInt(0, list[role][i].die.faces.length - 1),
						uuid = UUID.generate(),
						colour = list[role][i].colour;

					html	+=	'<li class="die">'
							+		'<a href="#">'
							+			'<img '
							+				'alt="' + colour + '" '
							+				'data-colour="' + colour + '" '
							+				'data-uuid="' + uuid + '" '
							+				'src="games/' + currentGame.key + '/dice.svg#' + colour + face + '" '
							+			'/>'
							+		'</a>'
							+	'</li>'
					;
				}

				html += '</ul></li>';
			}
		}

		html += '</ul>';
		elements.resultsContainer.innerHTML = html;

	};

	var getRandomInt = function(min, max) {
		return Math.floor(aleaInstance() * (max - min + 1)) + min;
	}

	var calculationTimeoutCallback = function() {
		var list = manager.list(),
			html = '';

		for (var role in list) {
			if (list[role].length > 0) {
				var rolls = recursiveDice(list[role]),
					processed = processResults(rolls);

				html += buildResultsTable(role, processed);
			}
		}

		elements.resultsContainer.innerHTML = html;

		elements.modal.classList.add('hidden');
	};

	var capitaliseString = function(string) {
		return string && string[0].toUpperCase() + string.slice(1)
	};

	var roundFloat = function(float, digits) {
		return parseFloat(float.toFixed(digits));
	};

	var buildResultsTable = function(title, processed) {
		var capitalisedTitleString = capitaliseString(title),
			probabilitiesTable = buildProbabilitiesTable(processed.probabilities),
			statsTable = buildStatsTable(processed);

		html	=	'<div class="role-wrapper">'
				+		'<h3>' + capitalisedTitleString + '</h3>'
				+		'<div class="table-wrapper">'
				+			probabilitiesTable
				+		'</div>'
				+		'<div class="table-wrapper">'
				+			statsTable
				+		'</div>'
		;

		return html;
	};

	var buildProbabilitiesTable = function(probabilities) { // probabilities ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		//		damage	surge	range
		//	0	0%		83.3%	100%
		//	1	16.7%	16.7%	0%
		//	2	50%		0%		0%
		//	3	33.3%	0%		0%

		var columns = [{ title: 'Values', key: 'value', type: 'text' }],
			rows = [];

		for (var effect in probabilities) {
			columns.push({ title: effect, key: effect, type: 'icon' });

			for (var i = 0; i < probabilities[effect].length; ++ i) {
				if (typeof(rows[i]) === 'undefined') {
					rows[i] = {};
				}

				rows[i].value = i;

				if (!rows[i].hasOwnProperty(effect)) {
					rows[i][effect] = roundFloat(probabilities[effect][i] * 100, 2) + '%';
				}
			}
		}

		return buildHTMLTable(columns, rows, '0%', true);
	};

	var buildStatsTable = function(processed) {
		//			damage		surge		range
		//	max		3			1			0
		//	min		1			0			0
		//	median	2			0			0
		//	mode	2			0			0
		//	mean	2.167		0.167		0

		var columns = [{ title: 'Statistic', key: 'statistic', type: 'text'}],
			rows = [],
			reports = [
				{ name: 'maximum', key: 'maximums', type: 'text' },
				{ name: 'minimum', key: 'minimums', type: 'text'  },
				{ name: 'median', key: 'medians', type: 'text'  },
				{ name: 'mode', key: 'modes', type: 'text'  },
				{ name: 'average', key: 'means', type: 'text'  }
			];

		for (var i = 0; i < reports.length; ++ i) {
			rows[i] = { statistic: capitaliseString(reports[i].name) };
			for (var effect in processed[reports[i].key]) {
				var filteredCols = columns.filter(function(el, i, arr) {
					return el.key === effect;
				});

				if (filteredCols.length === 0) {
					columns.push({ title: effect, key: effect, type: 'icon' });
				}

				if (/array]$/i.test(Object.prototype.toString.call(processed[reports[i].key][effect]))) {
					rows[i][effect] = processed[reports[i].key][effect].join(', ');
				} else if (processed[reports[i].key][effect] === null) {
					rows[i][effect] = 'none';
				} else {
					rows[i][effect] = roundFloat(processed[reports[i].key][effect], 2);
				}
			}
		}

		return buildHTMLTable(columns, rows, '', true);
	};

	var buildHTMLTable = function(columns, rows, defaultValue, firstColTh) { // columns ~= [{title: <string>, key: <string>}]; rows ~= [{<string:key>: <mixed>}];

		var html = '<table><thead>';

		for (var i = 0; i < columns.length; ++ i) {
			var title = columns[i].type === 'icon' ? '<img '
										+				'alt="' + columns[i].title + '" '
										+				'data-colour="' + columns[i].title + '" '
										+				'data-side="attack" '
										+				'src="games/' + currentGame.key + '/effects.svg#' + columns[i].title + '" '
										+			'/>' : columns[i].title;

			console.log(columns[i].type);

			html += '<th>' + title + '</th>';
		}

		html += '</thead><tbody>';

		for (var i = 0; i < rows.length; ++i) {
			var tr = document.createElement('tr');
			html += '<tr>';

			for (var j = 0; j < columns.length; ++ j) {
				var cell, valueText;

				if (!!firstColTh && j === 0) {
					cell = 'th';
				} else {
					cell = 'td';
				}

				if (rows[i].hasOwnProperty(columns[j].key)) {
					valueText = rows[i][columns[j].key];
				} else {
					valueText = defaultValue;
				}

				html += '<' + cell + '>' + valueText + '</' + cell + '>';
			}

			html += '</tr>';
		}

		html += '</table>';

		return html;
	};

	var getElements = function() {
		elements.tabs = document.querySelector('.tabs');
		elements.gameName = document.querySelector('.game-name');
		elements.wrapper = document.querySelector('#wrapper');
		elements.modal = document.querySelector('#modal');
		elements.message = document.querySelector('#message');
		elements.availableUl = document.querySelector('#available.dice');
		elements.selectedUl = document.querySelector('#selected.dice');
		elements.selectedAttackLi = document.querySelector('#selected.dice .attack');
		elements.selectedAttackUl = document.querySelector('#selected.dice .attack ul');
		elements.selectedDefenceLi = document.querySelector('#selected.dice .defence');
		elements.selectedDefenceUl = document.querySelector('#selected.dice .defence ul');
		elements.statsButton = document.querySelector('button.stats');
		elements.rollButton = document.querySelector('button.roll');
		elements.noDice = document.querySelector('.no-dice');
		elements.resultsContainer = document.querySelector('#results .results');
	};

	var buildDiceList = function(d) {
		var html = '',
		width = d.hasOwnProperty('attack') && Object.keys(d.attack).length > 0 && d.hasOwnProperty('defence') && Object.keys(d.defence).length > 0 ? ' style="width:50%;"' : '';

		elements.selectedAttackUl.innerHTML = '';
		elements.selectedDefenceUl.innerHTML = '';
		elements.resultsContainer.innerHTML = '';
		elements.noDice.classList.remove('hidden');
		elements.selectedAttackLi.classList.add('hidden');
		elements.selectedDefenceLi.classList.add('hidden');
		manager.reset();

		if (d.hasOwnProperty('attack') && Object.keys(d.attack).length > 0) {
			html += '<li class="attack"' + width + '><h3>Attack</h3><ul>';

			// Build Available Dice, Attack list
			for (var colour in d.attack) {
				html	+=	'<li class="die">'
						+		'<a href="#">'
						+			'<img '
						+				'alt="' + colour + '" '
						+				'data-colour="' + colour + '" '
						+				'data-side="attack" '
						+				'src="games/' + currentGame.key + '/dice.svg#' + colour + '" '
						+			'/>'
						+		'</a>'
						+	'</li>'
				;
			}

			html += '</ul></li>';
		}

		if (d.hasOwnProperty('defence') && Object.keys(d.defence).length > 0) {
			html += '<li class="defence"' + width + '><h3>Defence</h3><ul>';

			// Build Available Dice, Defence list
			for (var colour in d.defence) {
				html	+=	'<li class="die">'
						+		'<a href="#">'
						+			'<img '
						+				'alt="' + colour + '" '
						+				'data-colour="' + colour + '" '
						+				'data-side="defence" '
						+				'src="games/' + currentGame.key + '/dice.svg#' + colour + '" '
						+			'/>'
						+		'</a>'
						+	'</li>'
				;
			}

			html += '</ul></li>';
		}

		elements.availableUl.innerHTML = html;
	};

	var buildDieHTML = function(colour, uuid, face) {
		var li = document.createElement('li'),
			img = document.createElement('img'),
			a = document.createElement('a'),
			faceString = typeof(face) === 'undefined' ? '' : '-' + face;

		img.setAttribute('src', 'games/' + currentGame.key + '/dice.svg#' + colour + faceString);
		img.setAttribute('alt', colour);
		img.setAttribute('data-colour', colour);
		img.setAttribute('data-uuid', uuid);
		a.setAttribute('href', '#');
		a.appendChild(img);
		li.className = 'die';
		li.appendChild(a);

		return li;
	};

	var addDieHTML = function(side, colour) {
		var parent = document.body,
			uuid = UUID.generate(),
			li = buildDieHTML(colour, uuid);

		if (side === 'attack') {
			parent = elements.selectedAttackUl;
		} else if (side === 'defence') {
			parent = elements.selectedDefenceUl;
		}

		parent.appendChild(li);

		manager.add(side, uuid, colour, dice[side][colour]);
	};

	var addDie = function(e) {
		e.preventDefault();
		e.stopPropagation();

		if (/^img$/i.test(e.target.nodeName)) {
			addDieHTML(e.target.getAttribute('data-side'), e.target.getAttribute('data-colour'));
		}
	};

	var removeDie = function(side) {
		return function(e) {
			e.preventDefault();
			e.stopPropagation();

			if (/^img$/i.test(e.target.nodeName)) {
				var imgEl = e.target,
					aEl = imgEl.parentNode,
					liEl = aEl.parentNode,
					ulEl = liEl.parentNode,
					colour = e.target.getAttribute('data-colour'),
					uuid = e.target.getAttribute('data-uuid');

				e.preventDefault();
				e.stopPropagation();

				ulEl.removeChild(liEl);

				manager.remove(side, uuid);
			}
		};
	};

	xhr.get('games/games.json').then(JSON.parse, displayError, displayProgress).then(function(res) {
		games = res;
		getElements();
		elements.tabs.innerHTML = Template.build(games);
		setupEventHandlers();
		switchGame(games[0].key);
	}).done();

	var Template = (function() {
		return {
			build: function(items) {
				var html = '',
					width = Math.floor(100 / items.length);

				for (var i = 0; i < items.length; ++ i) {
					var active = i === 0 ? ' active' : '',
						icoff = 'games/' + items[i].key + '/icon.svg#off',
						icon = 'games/' + items[i].key + '/icon.svg#on';

					html	+=	'<li class="tab' + active + '" style="width: ' + width + '%;">'
							+		'<a href="#" data-game="' + items[i].key + '">'
							+			'<img class="on" src="' + icon + '" />'
							+			'<img class="off" src="' + icoff + '" />'
							+		'</a>'
							+	'</li>'
					;
				}

				return html;
			}
		};
	})();

	var switchGame = function(gameKey) {
		if (currentGame === null || currentGame.key !== gameKey) {
			for (var i = 0; i < games.length; ++ i) {
				if (games[i].key === gameKey) {
					currentGame = games[i];
					xhr.get('games/' + currentGame.key + '/data.json').then(JSON.parse, displayError, displayProgress).then(function(res) {
						if (dice === null) {
							setupListDisplay();
						} else {
							elements.statsButton.classList.add('hidden');
							elements.rollButton.classList.add('hidden');
						}
						dice = res;
						elements.gameName.innerText = currentGame.name;
						buildDiceList(dice);
					});
				}
			}
		}
	};

	var findAncestorNodeOfType = function(node, type) {
		var re = new RegExp('\^' + type + '\$', 'i');

		if (re.test(node.parentNode.nodeName) || /^body$/.test(node.parentNode.nodeName)) {
			return node.parentNode;
		} else if (!!node.parentNode) {
			return findAncestorNodeOfType(node.parentNode, type);
		} else {
			return node;
		}
	};

	var setupEventHandlers = function() {
		elements.tabs.addEventListener('click', function(e) {
			var node;

			e.preventDefault();
			e.stopPropagation();

			if (/^img$/i.test(e.target.nodeName)) {
				node = findAncestorNodeOfType(e.target, 'a');
			} else if (/^a$/i.test(e.target.nodeName)) {
				node = e.target;
			}

			switchGame(node.getAttribute('data-game'));
			document.querySelector('.tab.active').classList.remove('active');
			findAncestorNodeOfType(e.target, 'li').classList.add('active');
		});
	};
});
