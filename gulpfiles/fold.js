//var PrefixTree = require('./prefix-tree');
//var Competition = require('./competition');

/**
 *
 * @param {string[]} keywords `['return', 'returns', 'get', 'set', 'pet']`
 * @param {number} [lookAhead=1]
 * @returns {string} `(?:return?|[gps]et)`
 */
function fold(keywords, lookAhead) {
	if (keywords.length === 0)
		throw new Error('No keywords provided.');
	if (lookAhead === undefined)
		lookAhead = 1;

	// check for duplicates
	(function () {
		var map = {};
		keywords.forEach(function (w) {
			if (w in map)
				throw new Error('Duplicate word "' + w + '".');
			map[w] = true;
		});
	}());

	// check for invalid characters
	keywords.forEach(function (w) {
		var regex = /^[^\\(?:)|[\]]*$/;
		if (!regex.test(w))
			throw new Error('Invalid characters in "' + w + '". The word must match the expression ' + regex);
	});

	return optimizeWords(keywords, { lookAhead: lookAhead }).toString();
}


// #####################################################################################################################
//
// GENERAL INFO
//
// - No method is allowed to modify the word list given to it. Make a copy.
// - No method is allowed to modify the options given to it. Make a copy.
//
// #####################################################################################################################


/**
 * @param {WordGroup} wordGroup
 * @returns {number}
 */
function scoreWordGroup(wordGroup) {
	return -wordGroup.flattenContent().length;
}

/**
 * @typedef OptimizationOptions
 * @property {number} lookAhead
 * @property {boolean} [isLookingAhead=false]
 * @property {number} [maxCandidates=16]
 */

/**
 * @typedef WordGroupCandidate
 * @property {number} score
 * @property {string[]} consumedWords
 * @property {() => WordGroup} generator
 */

/**
 *
 * @param {string[]} words
 * @param {OptimizationOptions} options
 * @returns {WordGroup}
 */
function optimizeWords(words, options) {
	options = Object.assign({}, options); // make a copy
	if (options.isLookingAhead) {
		if (!(options.lookAhead > 0))
			return new WordGroup(words);
		options.lookAhead -= 1;
	}

	options.maxCandidates = options.maxCandidates || 16;

	// cannot return an empty word group
	if (!words.length)
		throw new Error('Cannot optimize empty list of words.');

	// trivial cases: one words, one optional words
	if (words.length === 1)
		return new WordGroup(words[0] || "");
	if (words.length === 2 && !(words[0] && words[1]))
		return new WordGroup(words);


	/**
	 * The different optimization methods which will be used.
	 * @type {(words: string[], options: OptimizationOptions) => WordGroupCandidate[]}
	 */
	var methods = [
		optimizationMethods.simpleNoop,
		optimizationMethods.simplePrefix,
		optimizationMethods.simpleSuffix,
	];

	/**
	 * The combined list of finalists of each optimization method.
	 * @type {WordGroupCandidate[]}
	 */
	var finalists = [];
	methods.forEach(function (method) {
		finalists.push(...method(words, options));
	});

	finalists.sort(function (a, b) { return a.score - b.score; });

	return finalists.pop().generator().flattenContent();
}


/**
 * A group of words which can be followed by another group of words.
 *
 * A group of words is here a nested string array.
 */
class WordGroup {

	/**
	 *
	 * @param {string|WordGroup|(string|WordGroup)[]} content
	 * @param {WordGroup} [after]
	 */
	constructor(content, after = null) {
		/**
		 * @type {string|WordGroup|(string|WordGroup)[]}
		 */
		this.content = content;
		this.after = after;
	}

	get nothingAfter() {
		return !this.after;
	}

	/**
	 *
	 * @returns {string}
	 * @memberof WordGroup
	 */
	toString() {
		var str = this.printContent();

		var after = this.after;
		while (after) {
			str += this.after.printContent();
			after = after.after;
		}

		return str;
	}

	/**
	 *
	 * @returns {string}
	 * @memberof WordGroup
	 */
	printContent() {
		// not an array
		if (!Array.isArray(this.content))
			return this.content.toString();

		// no content
		if (this.content.length === 0)
			throw new Error("No content");

		// only one element: abc
		if (this.content.length === 1)
			return this.content[0].toString();

		// transform into strings and remove empty strings
		const words = this.content.map(t => t ? t.toString() : t).filter(t => t);

		// is optional
		const optional = words.length < this.content.length ? "?" : "";

		// optional single character: a?
		if (words.length === 1 && words[0].length === 1)
			return words[0] + optional;

		// combine single characters into a character set: a b c def => [abc] def
		words.sort((a, b) => b.length - a.length);

		let charCount = words.reduce((count, value) => value.length === 1 ? count + 1 : count, 0);
		if (charCount === words.length || charCount >= 3) {
			// this will only decrease the overall length if either:
			//  a) charCount === words.length
			//     In this case, the overhead of (?:words) can be avoided because only one character set will be used.
			//  b) charCount >= 3
			//     With charCount == 3 and above, "(?:[abc]|words)".length <= "(?:a|b|c|words)" is true.

			var charSet = "[" + words.slice(words.length - charCount, words.length).join("") + "]";
			words.splice(words.length - charCount, charCount, charSet);

			// single character set: [abc]
			if (words.length === 1)
				return words[0] + optional;
		}

		// join using alternations: (?:abc|def)
		return "(?:" + words.join("|") + ")" + optional;
	}

	/**
	 *
	 * @returns {number}
	 * @memberof WordGroup
	 */
	get length() {
		var score = this.scoreContent();

		var after = this.after;
		while (after) {
			score += this.after.scoreContent();
			after = after.after;
		}

		return score;
	}

	scoreContent() {
		// not an array
		if (!Array.isArray(this.content))
			return this.content.length;

		// no content
		if (this.content.length === 0)
			throw new Error("No content");

		// only one element: abc
		if (this.content.length === 1)
			return this.content[0].length;

		var optional = 0;
		var lengths = [];
		this.content.forEach(function (t) {
			var l = t ? t.length : 0;
			if (l)
				lengths.push(l);
			else
				optional = 1;
		});

		// optional single character: a?
		if (lengths.length === 1 && lengths[0] === 1)
			return 1 + optional;

		lengths.sort();

		for (var charCount = 0, l = lengths.length; charCount < l; charCount++)
			if (lengths[charCount] > 1)
				break;
		charCount = Math.min(charCount, lengths.length);
		if (charCount === lengths.length || charCount >= 3) {
			// this will only decrease the overall length if either:
			//  a) charCount === words.length
			//     In this case, the overhead of (?:words) can be avoided because only one character set will be used.
			//  b) charCount >= 3
			//     With charCount == 3 and above, "(?:[abc]|words)".length <= "(?:a|b|c|words)" is true.

			lengths.splice(0, charCount, charCount + 2);

			// single character set: [abc]
			if (lengths.length === 1)
				return lengths[0] + optional;
		}

		// join using alternations: (?:abc|def)
		var sum = optional + 4; // (?:)
		for (var i = 0, l = lengths.length; i < l; i++)
			sum += lengths[i];
		sum += l - 1; // |
		return sum;
	}

	flattenContent() {
		while (true) {
			if (!Array.isArray(this.content)) {
				if (this.content instanceof WordGroup && this.content.nothingAfter) {
					this.content = this.content.content;
					continue;
				}
			} else {
				if (this.content.length === 1) {
					this.content = this.content[0];
					continue;
				} else if (this.content.some(w => w instanceof WordGroup && w.nothingAfter)) {
					const flattened = [];
					this.content.forEach(w => {
						if (w instanceof WordGroup && w.nothingAfter) {
							if (Array.isArray(w.content))
								flattened.push(...w.content);
							else
								flattened.push(w.content);

						} else {
							flattened.push(w);
						}
					});
					this.content = flattened;
					continue;
				}
			}

			return this;
		}
	}
}


var optimizationMethods = {

	util: {
		/**
		 * Recursively optimizes the given words with unlimited recursion depth.
		 *
		 * The returned word group will to be equivalent to the one returned by `util.approximate`,
		 * if `options.isLookingAhead` is `true`.
		 * @param {string[]} words
		 * @param {OptimizationOptions} options
		 */
		optimize: function (words, options) {
			return optimizeWords(words, options);
		},
		/**
		 * Recursively optimizes the given words with `options.lookAhead` recursive steps.
		 * @param {string[]} words
		 * @param {OptimizationOptions} options
		 */
		approximate: function (words, options) {
			var opts = Object.assign({}, options);
			opts.isLookingAhead = true;
			return optimizeWords(words, opts);
		},
		/**
		 * Doesn't optimize the given words.
		 * @param {string[]} words
		 * @param {OptimizationOptions} options
		 */
		noopOptimize: function (words, options) {
			return new WordGroup(words);
		},

		/**
		 * Reverses the given string.
		 * @param {string} string
		 * @returns {string}
		 */
		reverseString: function (string) {
			return Array.from(string).reverse().join("");
		},
		/**
		 * Reverses all string contained by the given array returning a new array.
		 * @param {string[]} strings
		 * @returns {string[]}
		 */
		reverseStrings: function (strings) {
			return strings.map(optimizationMethods.util.reverseString);
		}
	},

	/**
	 * - true, false, null => true|false|null
	 * @param {string[]} words
	 * @param {OptimizationOptions} options
	 * @returns {WordGroupCandidate[]}
	 */
	simpleNoop: function (words, options) {
		var wordGroup = new WordGroup(words);
		return [
			{
				consumedWords: words,
				score: scoreWordGroup(wordGroup),
				generator: function () {
					return wordGroup;
				}
			}
		];
	},

	/**
	 * - pre_abc, pre_def, pre_ghi => pre_(abc|def|ghi)
	 * - token, tokens => token(s|)
	 * @param {string[]} words
	 * @param {OptimizationOptions} options
	 * @returns {WordGroupCandidate[]}
	 */
	simplePrefix: function (words, options) {
		var util = optimizationMethods.util;

		/** @type {Competition.<WordGroupCandidate>} */
		var competition = new Competition(options.maxCandidates);

		var prefixTree = PrefixTree.create(words);
		prefixTree.setCaching(true, true);


		/**
		 * @param {string} prefix
		 */
		function chooseBest(prefix) {
			var child = prefixTree.getChild(prefix);

			// single word
			if (child.count === 1)
				return;

			var prefixedWords = child.getWords();
			var remainingWords = prefixTree.getWordsWithoutPrefix(prefix);

			/**
			 * Returns the word group generated from the current prefix optimized using `optimizer`.
			 * @param {(words: string[], options: OptimizationOptions) => WordGroup} optimizer
			 * @returns {WordGroup}
			 */
			function getWordGroup(optimizer) {
				var content = [
					new WordGroup(prefix, optimizer(prefixedWords, options))
				];

				if (remainingWords.length) {
					// optimize
					var optimized = optimizer(remainingWords, options);

					if (optimized.content === remainingWords && optimized.nothingAfter)
						// unable to optimize
						content.push(...remainingWords);
					else
						content.push(optimized);
				}

				return new WordGroup(content);
			}


			/** @type {WordGroupCandidate} */
			var competitor = {
				consumedWords: null,
				generator: null,
				score: -Infinity,
				qualified: function () {
					var approximated = getWordGroup(util.approximate);

					this.score = scoreWordGroup(approximated);
					this.generator = function () {
						if (options.isLookingAhead)
							return approximated;
						return getWordGroup(util.optimize);
					};
				},
			};

			var score = scoreWordGroup(getWordGroup(util.noopOptimize));
			competition.compete(competitor, score);

			// try all prefixes
			child.forEach(c => chooseBest(prefix + c.char));
		};

		prefixTree.forEach(c => chooseBest(c.char));

		return competition.close();
	},

	/**
	 * - abc_suf, def_suf, ghi_suf => (abc|def|ghi)_suf
	 * - get, set, let => (g|s|l)et
	 * @param {string[]} words
	 * @param {OptimizationOptions} options
	 * @returns {WordGroupCandidate[]}
	 */
	simpleSuffix: function (words, options) {
		var util = optimizationMethods.util;

		/** @type {Competition.<WordGroupCandidate>} */
		var competition = new Competition(options.maxCandidates);

		var suffixTree = PrefixTree.create(util.reverseStrings(words));
		suffixTree.setCaching(true, true);


		/**
		 * @param {string} suffix
		 */
		function chooseBest(suffix) {
			var child = suffixTree.getChild(suffix);

			// single word
			if (child.count === 1)
				return;

			var suffixedWords = child.getWords();
			var remainingWords = suffixTree.getWordsWithoutPrefix(suffix);

			/**
			 * Returns the word group generated from the current prefix optimized using `optimizer`.
			 * @param {(words: string[], options: OptimizationOptions) => WordGroup} optimizer
			 * @returns {WordGroup}
			 */
			function getWordGroup(optimizer) {
				var _suffixedWords = suffixedWords;
				var _remainingWords = remainingWords;

				// reverse words
				if (optimizer === util.optimize) {
					_suffixedWords = util.reverseStrings(_suffixedWords);
					_remainingWords = util.reverseStrings(_remainingWords);
				}

				var content = [
					new WordGroup(optimizer(_suffixedWords, options), new WordGroup(util.reverseString(suffix)))
				];

				if (remainingWords.length) {
					// optimize
					var optimized = optimizer(_remainingWords, options);

					if (optimized.content === _remainingWords && optimized.nothingAfter)
						// unable to optimize
						content.push(..._remainingWords);
					else
						content.push(optimized);
				}

				return new WordGroup(content);
			}


			/** @type {WordGroupCandidate} */
			var competitor = {
				consumedWords: null,
				generator: null,
				score: -Infinity,
				qualified: function () {
					var approximated = getWordGroup(util.approximate);

					this.score = scoreWordGroup(approximated);
					this.generator = function () {
						if (options.isLookingAhead)
							return approximated;
						return getWordGroup(util.optimize);
					};
				},
			};

			var score = scoreWordGroup(getWordGroup(util.noopOptimize));
			competition.compete(competitor, score);

			// try all suffixes
			child.forEach(c => chooseBest(suffix + c.char));
		};

		suffixTree.forEach(c => chooseBest(c.char));

		return competition.close();
	},

};



if (typeof module !== 'undefined')
	module.exports = fold;