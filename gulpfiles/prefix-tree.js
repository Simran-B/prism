// @ts-check

"use strict";

export class PrefixTree {

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
		this.childCount = 0;

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
	 * @param {(value: PrefixTree, tree?: PrefixTree) => T} [callbackfn=(v,t)=>v]
	 * @return {T[]}
	 */
	map(callbackfn = (v) => v) {
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
				if (!(c in tree)) {
					tree[c] = new PrefixTree(c, tree);
					tree.childCount++;
				}
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
		// TODO:
	}

}
