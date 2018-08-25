var PrefixTree = require('./prefix-tree');

/**
 *
 * @param {string[]} keywords `['return', 'returns', 'get', 'set', 'pet']`
 * @param {number} [recursionDepth=1]
 * @returns {string} `(?:return?|[gps]et)`
 */
function fold(keywords, recursionDepth) {
	if (keywords.length === 0)
		throw new Error('No keywords provided.');

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

	/**
	 *
	 * @param {string[]} words
	 * @param {number} recursionDepth
	 * @param {number} maxRecursionDepth
	 * @returns {WordGroup}
	 */
	const optimizeWords = (words, recursionDepth = 0, maxRecursionDepth = Infinity) => {
		if (recursionDepth > maxRecursionDepth)
			return new WordGroup(words);

		// trivial cases: no words, one words, one optional words
		if (words.length <= 1)
			return new WordGroup(words[0] || "");
		if (words.length === 2 && words.some(w => !w))
			return new WordGroup(words);

		// cases:
		// 1) simple prefix:
		//     a)  pre_abc, pre_def, pre_ghi
		//     b)  token, tokens
		// 2) simple suffix:
		//     a)  abc_suf, def_suf, ghi_suf
		//     b)  get, set, let
		// 3) prefix combinations:
		//     a)  pre1_Suf1, pre1_Suf2, pre2_Suf1, pre2_Suf2
		//     b)  clReleaseEvent, clReleaseKernel, clReleaseSampler, clRetainEvent, clRetainKernel, clRetainSampler
		// 3) suffix combinations:


		/**
		 * Returns a score of the given word group.
		 * @param {WordGroup} wordGroup
		 * @returns {number} the score. The higher the better.
		 */
		const scoreWordGroup = (wordGroup) => -wordGroup.flattenContent().toString().length;

		const approximateOptimize = (words, steps = window["steps"] || 1) => {
			return optimizeWords(words, 1, Math.min(steps, maxRecursionDepth - recursionDepth));
		}
		const recursiveOptimize = (words) => {
			return optimizeWords(words, recursionDepth + 1, maxRecursionDepth);
		}


		/**
		 * @type {() => WordGroup}
		 */
		let bestWordGroupGenerator;
		/**
		 * @type {number}
		 */
		let bestScore;

		{
			// add default values
			const all = new WordGroup(words);
			bestScore = scoreWordGroup(all);
			bestWordGroupGenerator = () => all;
		}

		debugger;


		// simple prefix
		if (true) {
			let prefixTree = PrefixTree.create(words);
			prefixTree.setCaching(true, true);

			/**
			 * @param {string} prefix
			 */
			const chooseBest = (prefix) => {
				const child = prefixTree.getChild(prefix);

				// single word
				if (child.count === 1 && !child.isWord)
					return;

				const withPrefixSansPrefix = child.getWords();
				const withoutPrefix = prefixTree.getWordsWithoutPrefix(prefix);

				/**
				 *
				 * @param {(words: string[]) => WordGroup} optimizeFunc
				 */
				const generateWordGroup = (optimizeFunc) => {
					const content = [new WordGroup(prefix, optimizeFunc(withPrefixSansPrefix))];
					if (withoutPrefix.length)
						content.push(optimizeFunc(withoutPrefix));
					return new WordGroup(content)
				};

				// get score
				const score = scoreWordGroup(generateWordGroup(approximateOptimize));

				if (score > bestScore) {
					bestScore = score;
					bestWordGroupGenerator = () => generateWordGroup(recursiveOptimize);
				}

				// try all prefixes
				child.forEach(c => chooseBest(prefix + c.char));
			};

			prefixTree.forEach(c => chooseBest(c.char));
		}

		// simple suffix
		if (true) {
			/**
			 * Reverses the given string.
			 * @param {string} string
			 * @returns {string}
			 */
			const reverseString = (string) => Array.from(string).reverse().join("");
			/**
			 * Reverses all string contained by the given array.
			 * @param {string[]} strings
			 * @returns {string[]}
			 */
			const reverseStrings = (strings) => strings.map(reverseString);


			let suffixTree = PrefixTree.create(reverseStrings(words));
			suffixTree.setCaching(true, true);

			/**
			 * @param {string} suffix
			 */
			const chooseBest = (suffix) => {
				const child = suffixTree.getChild(suffix);

				// single word
				if (child.count === 1 && !child.isWord)
					return;

				const withPrefixSansPrefix = child.getWords();
				const withoutPrefix = suffixTree.getWordsWithoutPrefix(suffix);

				/**
				 *
				 * @param {(words: string[]) => WordGroup} optimizeFunc
				 */
				const generateWordGroup = (optimizeFunc) => {
					const content = [new WordGroup(optimizeFunc(withPrefixSansPrefix), new WordGroup(reverseString(suffix)))];
					if (withoutPrefix.length)
						content.push(optimizeFunc(withoutPrefix));
					return new WordGroup(content)
				};

				// get score
				const score = scoreWordGroup(generateWordGroup(approximateOptimize));

				if (score > bestScore) {
					bestScore = score;
					bestWordGroupGenerator = () => generateWordGroup(words => recursiveOptimize(reverseStrings(words)));
				}

				// try all prefixes
				child.forEach(c => chooseBest(suffix + c.char));
			};

			suffixTree.forEach(c => chooseBest(c.char));
		}

		// prefix combinations
		if (false) {

		}

		return bestWordGroupGenerator().flattenContent();
	}

	return optimizeWords(keywords).toString();
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

	toString() {
		var str = this.printContent();

		let after = this.after;
		while (after) {
			str += this.after.printContent();
			after = after.after;
		}

		return str;
	}

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

	flattenContent() {
		while (true) {
			if (!Array.isArray(this.content)) {
				if (this.content instanceof WordGroup && this.content.nothingAfter) {
					this.content = this.content.content;
					continue;
				}
			} else {
				if (this.content.some(w => w instanceof WordGroup && w.nothingAfter)) {
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



if (typeof module !== 'undefined')
	module.exports = fold;