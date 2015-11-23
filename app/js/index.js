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
		elements.calculateButton.classList.add('hidden');
		elements.selectedAttackLi.classList.add('hidden');
		elements.selectedDefenceLi.classList.add('hidden');

		toggleListDisplayUUID = selected.addCallback('both', function(sel) {
			var list = sel.list(),
				attack = Object.keys(list.attack).length > 0,
				defence = Object.keys(list.defence).length > 0;

			elements.wrapper.classList.toggle('button-shown', (attack || defence));
			elements.noDice.classList.toggle('hidden', (attack || defence));
			elements.calculateButton.classList.toggle('hidden', !(attack || defence));
			elements.selectedAttackLi.classList.toggle('hidden', !attack);
			elements.selectedDefenceLi.classList.toggle('hidden', !defence);

			if (attack || defence) {
				elements.calculateButton.removeAttribute('disabled');
			} else {
				elements.calculateButton.setAttribute('disabled', 'disabled');
			}
		});

		clearResultsContainer = selected.addCallback('both', function(sel) {
			elements.resultsContainer.innerHTML = '';
		});

		elements.calculateButton.addEventListener('click', calculateProbabilities);
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
			processed = {
				means: calculateMeans(sorted),
				maximums: calculateMaximums(sorted),
				medians: calculateMedians(sorted),
				minimums: calculateMinimums(sorted),
				modes: calculateModes(totals),
				probabilities: calculatePercentages(totals, rolls.length),
				sorted: sorted,
				totals: totals
			};

		return processed;
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

			for (var i = 0; i < sorted[effect].length; ++ i) {
				if (typeof(totals[effect][sorted[effect][i]]) === 'undefined') {
					totals[effect][sorted[effect][i]] = 0;
				}

				++ totals[effect][sorted[effect][i]];
			}

			for (var i = 0; i < totals[effect].length; ++ i) {
				if (typeof(totals[effect][i]) === 'undefined') {
					totals[effect][i] = 0;
				}
			}
		}

		return totals;
	};

	var calculateMeans = function(sorted) {
		var means = {};

		for (var effect in sorted) {
			var total = 0;

			for (var i = 0; i < sorted[effect].length; ++ i) {
				total += sorted[effect][i];
			}

			means[effect] = total / sorted[effect].length;
		}

		return means;
	};

	var calculateMaximums = function(sorted) {
		var maximums = {};

		for (var effect in sorted) {
			maximums[effect] = sorted[effect][sorted[effect].length - 1];
		}

		return maximums;
	};

	var calculateMedians = function(sorted) {
		var medians = {};

		for (var effect in sorted) {
			if (sorted[effect].length === 0) {
				medians[effect] = null;
			} else if (sorted[effect].length === 1) {
				medians[effect] = sorted[effect][0];
			} else if (sorted[effect].length % 2 > 0) { // Odd number of values; just get the middle value
				var indexToGet = Math.floor(sorted[effect].length / 2);
				medians[effect] = sorted[effect][indexToGet];
			} else { // even number of values; need to find the average between the two values surrounding the middle
				var indexToGet = sorted[effect].length / 2,
					median = (sorted[effect][indexToGet] + sorted[effect][indexToGet - 1]) / 2;

				medians[effect] = median;
			}
		}

		return medians;
	};

	var calculateMinimums = function(sorted) {
		var minimums = {};

		for (var effect in sorted) {
			minimums[effect] = sorted[effect][0];
		}

		return minimums;
	};

	var calculateModes = function(totals) { // totals ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		var modes = {};

		for (var effect in totals) {
			var mode = [],
				max = 0;

			for (var i = 0; i < totals[effect].length; ++ i) {
				if (totals[effect][i] > max) {
					mode = [i];
					max = totals[effect][i];
				} // TODO: Figure out how to show multiple modes when two are tied
			}

			modes[effect] = mode;
		}

		return modes;
	};

	var calculatePercentages = function(totals, numRolls) { // totals ~= {damage: [<int>], range: [<int>], surge: [<int>]};
		var percentages = {};

		for (var effect in totals) {
			for (var i = 0; i < totals[effect].length; ++i) {
				if (!percentages.hasOwnProperty(effect)) {
					percentages[effect] = [];
				}

				percentages[effect][i] = totals[effect][i] / numRolls;
			}
		}

		return percentages;
	};

	var calculateProbabilities = function(e) {
		console.log('Calculating probabilities...', e);
		elements.message.innerText = 'Calculating...';
		elements.modal.classList.remove('hidden');
		elements.resultsContainer.innerHTML = '';
		elements.calculateButton.classList.add('hidden');

		setTimeout(calculationTimeoutCallback, 1000);
	};

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
		elements.calculateButton = document.querySelector('button.calculate');
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

			img.setAttribute('src', '/img/dice/dice.svg#' + colour);
			img.setAttribute('alt', colour);
			img.setAttribute('data-colour', colour);
			a.setAttribute('href', '#');
			a.appendChild(img);
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

			img.setAttribute('src', '/img/dice/dice.svg#' + colour);
			img.setAttribute('alt', colour);
			img.setAttribute('data-colour', colour);
			a.setAttribute('href', '#');
			a.appendChild(img);
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

	var addDieHTML = function(side, colour) {
		var parent = document.body,
			li = document.createElement('li'),
			img = document.createElement('img'),
			a = document.createElement('a'),
			uuid = UUID.generate();

		if (side === 'attack') {
			parent = elements.selectedAttackUl;
		} else if (side === 'defence') {
			parent = elements.selectedDefenceUl;
		}

		img.setAttribute('src', '/img/dice/dice.svg#' + colour);
		img.setAttribute('alt', colour);
		img.setAttribute('data-colour', colour);
		img.setAttribute('data-uuid', uuid);
		a.setAttribute('href', '#');
		a.appendChild(img);
		li.appendChild(a);
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

	xhr.get('/json/dice.json').then(JSON.parse, displayError, displayProgress).then(function(res) {
		dice = res;
		getElements();
		setupListDisplay();
		buildDiceList(dice);
	}).done();
});
