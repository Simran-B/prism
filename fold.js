/**
 *
 * @param {string[]} keywords
 */
function fold(keywords, caseInsensitive = false) {
	// case insensitive
	if (caseInsensitive)
		keywords = keywords.map(w => w.toUpperCase());

	// remove all duplicates and sort by length
	keywords.sort((a, b) => a.length - b.length).filter((value, i, array) => i === 0 || array[i - 1] !== value);

	// check characters
	keywords.forEach(w => {
		const regex = /^[\w ]+$/;
		if (!regex.test(w))
			throw new Error(`Invalid characters in "${w}"! The word must match the expression ${regex}`);
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

class PrefixTree {

	/**
	 *
	 * @param {string} character
	 * @param {PrefixTree} [parent]
	 */
	constructor(character, parent = null) {
		this.char = character;
		this.parent = parent;
		this.isWord = false;
		this.count = 0;

		this._caching = false;
		this._cachedWords = null;
		this._cachedPath = null;
	}

	/**
	 * @returns {string}
	 */
	get path() {
		if (this._caching && this._cachedPath)
			return this._cachedPath;

		let path = this.parent ? this.parent.path + this.char : "";

		if (this._caching)
			this._cachedPath = path;

		return path;
	}

	get caching() { return this._caching; }

	setCaching(value = true, recursive = true) {
		this._caching = value;
		if (!value) {
			this._cachedWords = null;
			this._cachedPath = null;
		}

		if (recursive) {
			this.forEach(t => {
				t.setCaching(value, true);
			});
		}
	}

	/**
	 *
	 * @param {(value: PrefixTree, tree?: PrefixTree) => void} callbackfn
	 */
	forEach(callbackfn) {
		for (const key in this) {
			if (key.length === 1 && this.hasOwnProperty(key)) {
				callbackfn(this[key], this)
			}
		}
	}

	/**
	 *
	 * @template T
	 * @param {(value: PrefixTree, tree?: PrefixTree) => T} [callbackfn=t=>t]
	 * @return {T[]}
	 */
	map(callbackfn = t => t) {
		const children = [];
		this.forEach(value => children.push(callbackfn(value, this)));
		return children;
	}

	/**
	 *
	 * @param {string} prefix
	 * @returns {PrefixTree|null}
	 */
	getChild(prefix) {
		if (!prefix)
			return this;

		let tree = this;
		for (let i = 0; i < prefix.length && tree; i++)
			tree = tree[prefix[i]];

		return tree || null;
	}

	/**
	 *
	 * @param {string} word
	 * @returns {boolean}
	 */
	includes(word) {
		const child = this.getChild(word);
		return !!child && child.isWord;
	}

	/**
	 * @returns {string[]}
	 */
	getWords() {
		if (this._caching && this._cachedWords)
			return [...this._cachedWords];

		const words = [];

		if (this.isWord)
			words.push("");

		this.forEach(c => {
			let childWords = c.getWords();
			for (let i = 0; i < childWords.length; i++)
				childWords[i] = c.char + childWords[i];
			words.push(...childWords);
		});

		if (this._caching)
			this._cachedWords = [...words];

		return words;
	}

	/**
	 * @param {string} prefix
	 * @returns {string[]}
	 */
	getWordsWithoutPrefix(prefix) {
		if (!prefix) return [];

		const words = [];

		if (this.isWord)
			words.push("");

		this.forEach(c => {
			let childWords = c.char === prefix[0] ? c.getWordsWithoutPrefix(prefix.substr(1)) : c.getWords();
			for (let i = 0; i < childWords.length; i++)
				childWords[i] = c.char + childWords[i];
			words.push(...childWords);
		});

		return words;
	}

	/**
	 *
	 * @param {string[]} words
	 */
	addWord(...words) {
		const root = this;

		words.forEach(w => {
			let tree = root;
			tree.count++;

			for (let i = 0; i < w.length; i++) {
				const c = w[i];
				if (!(c in tree))
					tree[c] = new PrefixTree(c, tree);
				tree = tree[c];
				tree.count++;
			}

			tree.isWord = true;
		});
	}

	/**
	 *
	 * @param {string[]} words
	 * @returns {PrefixTree}
	 */
	static create(words) {
		const root = new PrefixTree("", null);
		root.addWord(...words);
		return root;
	}

	/**
	 * Returns a new prefix tree which is equal to `createPrefixTree([all w where w is word in tree1, tree2, ... and treeN])`
	 * @param {PrefixTree[]} trees
	 * @returns {PrefixTree}
	 */
	static intersect(...trees) {

	}

}
