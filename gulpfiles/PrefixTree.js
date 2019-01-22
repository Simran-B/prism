// @ts-check

"use strict";

/**
 * Returns a new string with the reversed order of characters of the given string.
 *
 * @param {string} str
 */
function reverseString(str) {
	let s = '';
	for (let i = str.length - 1; i >= 0; i--) {
		s += str[i];
	}
	return s;
}


export class PrefixTreeNode {

	/**
	 *
	 * @private
	 * @param {string} character
	 * @param {PrefixTreeNode} parent
	 */
	constructor(character, parent) {
		if (character && character.length > 1) {
			throw new Error('The length of character has to be one.');
		}

		/**
		 * The character which is prefix to all children.
		 *
		 * This will be the empty string if `this` is the root of the prefix tree.
		 *
		 * @readonly
		 * @type {string}
		 */
		this.character = character;
		/**
		 * The parent node of this node.
		 *
		 * This will be `null` if `this` is the root of the prefix tree.
		 *
		 * @readonly
		 * @type {PrefixTreeNode}
		 */
		this.parent = parent;
		/**
		 * The prefix of all child node.
		 *
		 * The prefix of the root node is `''`.
		 * The prefix of all other nodes is `this.parent.prefix + this.character`.
		 *
		 * @readonly
		 * @type {string}
		 */
		this.prefix = parent ? parent.prefix + character : '';

		/**
		 * The map of children of this node.
		 *
		 * The number of child node can be queried with `this.childCount`.
		 *
		 * @readonly
		 * @type {Object.<string, PrefixTreeNode>}
		 */
		this.children = {};
		/**
		 * The number of child nodes in `this.children`.
		 *
		 * @type {number}
		 */
		this.childCount = 0;

		/**
		 * Whether `this.prefix` is a word of the prefix tree.
		 *
		 * @type {boolean}
		 */
		this.isWord = false;
		/**
		 * The number of words encoded by the child nodes plus 1 if this a word.
		 *
		 * @type {number}
		 */
		this.wordCount = 0;

		this._iterator = function* _iterator() {
			const children = this.children;
			for (const key in children) {
				if (key.length === 1 && children.hasOwnProperty(key)) {
					yield children[key];
				}
			}
		};
	}

	[Symbol.iterator]() {
		return this._iterator();
	}

	/**
	 * Calls the given callback with every child of this node.
	 *
	 * @param {(child: PrefixTreeNode) => void} callbackfn
	 */
	forEach(callbackfn) {
		for (const child of this) {
			callbackfn(child);
		}
	}

	/**
	 * Whether `this` is the root of the prefix tree.
	 *
	 * @type {boolean}
	 */
	get isRoot() {
		return !this.parent;
	}

	/**
	 * Returns the child node with the given prefix relative to this node or `null` if no such node exists.
	 *
	 * The prefix of the returned node will be `this.prefix + prefix`.
	 *
	 * @param {string} prefix
	 * @returns {PrefixTreeNode|null}
	 */
	getChild(prefix) {
		if (!prefix) {
			return this;
		}

		let node = this.children[prefix[0]];
		for (let i = 1, l = prefix.length; i < l && node; i++) {
			node = node.children[prefix[i]];
		}

		return node || null;
	}

	/**
	 * Adds the given words the tree.
	 *
	 * @param {string[]} words The words to be added.
	 * @param {boolean} [reversed=false] Whether each word is to added in the reversed order of characters.
	 */
	addWords(words, reversed = false) {
		if (!this.isRoot) {
			throw new Error('Words can only be added at the root');
		}

		for (const w of words) {
			/** @type {PrefixTreeNode} */
			let node = this;
			node.wordCount++;

			for (let i = 0, l = w.length; i < l; i++) {
				const char = reversed ? w[l - 1 - i] : w[i];

				if (!(char in node.children)) {
					node.children[char] = new PrefixTreeNode(char, node);
					node.childCount++;
				}
				node = node.children[char];
				node.wordCount++;
			}

			node.isWord = true;
		}
	}

	/**
	 * Returns a list of all words under this node including the word this node encodes.
	 *
	 * @param {boolean} [reversed] Whether all words shall be reversed.
	 * @param {boolean} [includePrefix] Whether the prefix of the this node is to be added to every word.
	 * @returns {string[]}
	 */
	getWords(reversed = false, includePrefix = false) {
		let prefix = '';
		if (includePrefix) {
			prefix = this.prefix;
			if (reversed) {
				prefix = reverseString(prefix);
			}
		}

		/** @type {string[]} */
		const words = [];

		if (this.isWord) {
			words.push(prefix);
		}

		for (const c of this) {
			for (let childWord of c.getWords(reversed, false)) {
				if (reversed) {
					childWord = childWord + c.character + prefix;
				} else {
					childWord = prefix + c.character + childWord;
				}
				words.push(childWord);
			}
		}

		return words;
	}

	/**
	 * Returns all words under this node which do not have the given string as prefix.
	 *
	 * @param {string} prefix
	 * @param {boolean} [reversed] Whether all words shall be reversed.
	 * @returns {string[]}
	 */
	getWordsWithoutPrefix(prefix, reversed = false) {
		// all words have '' as prefix
		if (!prefix) {
			return [];
		}

		/** @type {string[]} */
		const words = [];

		if (this.isWord) {
			words.push('');
		}

		const currentChar = prefix[reversed ? prefix.length - 1 : 0];
		prefix = reversed ? prefix.substr(0, prefix.length - 1) : prefix.substr(1);

		for (const c of this) {
			const childWords = c.character === currentChar
				? c.getWordsWithoutPrefix(prefix, reversed)
				: c.getWords(reversed);

			for (let w of childWords) {
				w = reversed ? w + c.character : c.character + w;
				words.push(w);
			}
		}

		return words;
	}

	/**
	 * Returns the root node of a new prefix tree.
	 *
	 * @returns {PrefixTreeNode}
	 */
	static createRoot() {
		return new PrefixTreeNode('', null);
	}

}
