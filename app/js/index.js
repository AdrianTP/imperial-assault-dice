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
//			Dice Roller

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
		dice = null,
		elements = {},
		selected = (function() {
			var sides = {
					attack: [],
					defence: []
				},
				callbacks = {
					add: {},
					remove: {}
				};

			return {
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
		})(),
		toggleListDisplayUUID = null,
		clearResultsContainer = null;

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

		toggleListDisplayUUID = selected.addCallback('both', function(sel) {
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

		clearResultsContainer = selected.addCallback('both', function(sel) {
			elements.resultsContainer.innerHTML = '<h2>Results</h2>';
		});

		elements.statsButton.addEventListener('click', calculate);
		elements.rollButton.addEventListener('click', roll);
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
		elements.resultsContainer.innerHTML = '<h2>Results</h2>';
		elements.statsButton.classList.add('hidden');
		elements.rollButton.classList.add('hidden');

		setTimeout(calculationTimeoutCallback, 1000);
	};

	var roll = function(e) {
		var list = selected.list(),
			ul = document.createElement('ul');

		ul.className = 'dice';
		ul.id = 'rolled';

		elements.statsButton.classList.add('hidden');
		elements.rollButton.classList.add('hidden');

		for (var role in list) {
			if (list[role].length > 0) {
				var li = document.createElement('li'),
					h3 = document.createElement('h3'),
					h3Text = document.createTextNode(capitaliseString(role)),
					subUl = document.createElement('ul');

				li.className = role;
				h3.appendChild(h3Text);
				li.appendChild(h3);

				for (var i = 0; i < list[role].length; ++ i) {
					var face = getRandomInt(0, list[role][i].die.faces.length - 1),
						uuid = UUID.generate(),
						dieLi = buildDieHTML(list[role][i].colour, uuid, face);

					subUl.appendChild(dieLi);
				}

				li.appendChild(subUl);
			}

			ul.appendChild(li);
		}

		elements.resultsContainer.appendChild(ul);
	};

	var getRandomInt = function(min, max) {
		return Math.floor(aleaInstance() * (max - min + 1)) + min;
	}

	var calculationTimeoutCallback = function() {
		var list = selected.list();

		for (var role in list) {
			if (list[role].length > 0) {
				var rolls = recursiveDice(list[role]),
					processed = processResults(rolls);

				console.log(processed);

				buildResultsTable(role, processed);
			}
		}

		elements.modal.classList.add('hidden');
	};

	var capitaliseString = function(string) {
		return string && string[0].toUpperCase() + string.slice(1)
	};

	var roundFloat = function(float, digits) {
		return parseFloat(float.toFixed(digits));
	};

	var buildResultsTable = function(title, processed) {
		var roleWrapper = document.createElement('div'),
			h3 = document.createElement('h3'),
			capitalisedTitleString = capitaliseString(title),
			titleNode = document.createTextNode(capitalisedTitleString),
			probabilitiesDiv = document.createElement('div'),
			probabilitiesTable = buildProbabilitiesTable(processed.probabilities),
			statsDiv = document.createElement('div'),
			statsTable = buildStatsTable(processed);

		roleWrapper.className = 'role-wrapper';

		h3.appendChild(titleNode);
		roleWrapper.appendChild(h3);

		probabilitiesDiv.appendChild(probabilitiesTable);
		probabilitiesDiv.className = 'table-wrapper';
		roleWrapper.appendChild(probabilitiesDiv);

		statsDiv.appendChild(statsTable);
		statsDiv.className = 'table-wrapper';
		roleWrapper.appendChild(statsDiv);

		elements.resultsContainer.appendChild(roleWrapper);
	};

	var buildProbabilitiesTable = function(probabilities) { // probabilities ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		//		damage	surge	range
		//	0	0%		83.3%	100%
		//	1	16.7%	16.7%	0%
		//	2	50%		0%		0%
		//	3	33.3%	0%		0%

		var columns = [{ title: 'Values', key: 'value' }],
			rows = [];

		for (var effect in probabilities) {
			columns.push({ title: capitaliseString(effect), key: effect });

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

		var columns = [{ title: 'Statistic', key: 'statistic'}],
			rows = [],
			reports = [
				{ name: 'maximum', key: 'maximums' },
				{ name: 'minimum', key: 'minimums' },
				{ name: 'median', key: 'medians' },
				{ name: 'mode', key: 'modes' },
				{ name: 'average', key: 'means' }
			];

		for (var i = 0; i < reports.length; ++ i) {
			rows[i] = { statistic: capitaliseString(reports[i].name) };
			for (var effect in processed[reports[i].key]) {
				var filteredCols = columns.filter(function(el, i, arr) {
					return el.key === effect;
				});

				if (filteredCols.length === 0) {
					columns.push({ title: capitaliseString(effect), key: effect});
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
		var table = document.createElement('table'),
			thead = document.createElement('thead'),
			theadTr = document.createElement('tr'),
			tbody = document.createElement('tbody');

		for (var i = 0; i < columns.length; ++ i) {
			var th = document.createElement('th'),
				titleText = document.createTextNode(columns[i].title);

			th.appendChild(titleText);
			theadTr.appendChild(th);
		}

		thead.appendChild(theadTr);

		for (var i = 0; i < rows.length; ++i) {
			var tr = document.createElement('tr');

			for (var j = 0; j < columns.length; ++ j) {
				var cell, valueText;

				if (!!firstColTh && j === 0) {
					cell = document.createElement('th');
				} else {
					cell = document.createElement('td');
				}

				if (rows[i].hasOwnProperty(columns[j].key)) {
					valueText = document.createTextNode(rows[i][columns[j].key]);
				} else {
					valueText = document.createTextNode(defaultValue);
				}

				cell.appendChild(valueText);
				tr.appendChild(cell);
			}

			tbody.appendChild(tr);
		}

		table.appendChild(thead);
		table.appendChild(tbody);

		return table;
	};

	var getElements = function() {
		elements.app = document.querySelector('#app');
		elements.wrapper = document.querySelector('#wrapper');
		elements.modal = document.querySelector('#modal');
		elements.message = document.querySelector('#message');
		elements.availableUl = document.querySelector('ul#available.dice');
		elements.availableAttackUl = document.querySelector('ul#available.dice .attack ul');
		elements.availableDefenceUl = document.querySelector('ul#available.dice .defence ul');
		elements.selectedUl = document.querySelector('ul#selected.dice');
		elements.selectedAttackLi = document.querySelector('ul#selected.dice .attack');
		elements.selectedAttackUl = document.querySelector('ul#selected.dice .attack ul');
		elements.selectedDefenceLi = document.querySelector('ul#selected.dice .defence');
		elements.selectedDefenceUl = document.querySelector('ul#selected.dice .defence ul');
		elements.statsButton = document.querySelector('button.stats');
		elements.rollButton = document.querySelector('button.roll');
		elements.noDice = document.querySelector('.no-dice');
		elements.resultsContainer = document.querySelector('#results');
	};

	var buildDiceList = function(d) {
		var availableAttackFrag = document.createDocumentFragment(),
			availableDefenceFrag = document.createDocumentFragment(),
			selectedAttackFrag = document.createDocumentFragment(),
			selectedDefenceFrag = document.createDocumentFragment();

		// Build Available Dice, Attack list
		for (var colour in d.attack) {
			var li = document.createElement('li'),
				a = document.createElement('a'),
				img = document.createElement('img'),
				text = document.createTextNode(colour);

			img.setAttribute('src', 'img/dice/dice.svg#' + colour);
			img.setAttribute('alt', colour);
			img.setAttribute('data-colour', colour);
			a.setAttribute('href', '#');
			a.appendChild(img);
			li.className = 'die';
			li.appendChild(a);
			availableAttackFrag.appendChild(li);
		}

		elements.availableAttackUl.appendChild(availableAttackFrag);

		// Build Available Dice, Defence list
		for (var colour in d.defence) {
			var li = document.createElement('li'),
				a = document.createElement('a'),
				img = document.createElement('img'),
				text = document.createTextNode(colour);

			img.setAttribute('src', 'img/dice/dice.svg#' + colour);
			img.setAttribute('alt', colour);
			img.setAttribute('data-colour', colour);
			a.setAttribute('href', '#');
			a.appendChild(img);
			li.className = 'die';
			li.appendChild(a);
			availableDefenceFrag.appendChild(li);
		}

		elements.availableDefenceUl.appendChild(availableDefenceFrag);

		// Add event listeners to lists
		elements.availableAttackUl.addEventListener('click', addDie('attack'));
		elements.availableDefenceUl.addEventListener('click', addDie('defence'));

		elements.selectedAttackUl.addEventListener('click', removeDie('attack'));
		elements.selectedDefenceUl.addEventListener('click', removeDie('defence'));
	};

	var buildDieHTML = function(colour, uuid, face) {
		var li = document.createElement('li'),
			img = document.createElement('img'),
			a = document.createElement('a'),
			faceString = typeof(face) === 'undefined' ? '' : '-' + face;

		img.setAttribute('src', 'img/dice/dice.svg#' + colour + faceString);
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

		selected.add(side, uuid, colour, dice[side][colour]);
	};

	var addDie = function(side) {
		return function(e) {
			e.preventDefault();
			e.stopPropagation();

			if (/img/i.test(e.target.nodeName)) {
				addDieHTML(side, e.target.getAttribute('data-colour'));
			}
		};
	};

	var removeDie = function(side) {
		return function(e) {
			e.preventDefault();
			e.stopPropagation();

			if (/img/i.test(e.target.nodeName)) {
				var imgEl = e.target,
					aEl = imgEl.parentNode,
					liEl = aEl.parentNode,
					ulEl = liEl.parentNode,
					colour = e.target.getAttribute('data-colour'),
					uuid = e.target.getAttribute('data-uuid');

				e.preventDefault();
				e.stopPropagation();

				ulEl.removeChild(liEl);

				selected.remove(side, uuid);

				console.log('removing', side, colour, uuid);
			}
		};
	};

	// Setup

	UUID.setRNG(aleaInstance);

	xhr.get('json/dice.json').then(JSON.parse, displayError, displayProgress).then(function(res) {
		dice = res;
		getElements();
		setupListDisplay();
		buildDiceList(dice);
	}).done();
});
