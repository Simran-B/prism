// @ts-check

"use strict";

export class Expression {

	/**
	 *
	 * @param {(string|Expression)[]} content
	 */
	constructor(content) {
		if (new.target === Expression) {
			throw new TypeError('Cannot construct Expression instances directly');
		}

		this.content = content;
	}

	/**
	 * Returns the RegExp pattern representing this expression.
	 *
	 * The expression should be flattened for optimal results.
	 *
	 * It is assumed that the order of alternation is irrelevant.
	 *
	 * @return {string}
	 */
	toString() {
		throw new TypeError('Not implemented');
	}

	/**
	 * Returns the length of `this.toString()`.
	 *
	 * This might be more efficient than calling `this.toString().length`.
	 *
	 * @returns {number}
	 */
	get length() {
		return toString().length;
	}

	/**
	 * Optimizes the given expression to be as minimal as possible.
	 *
	 * @param {Expression|string} expression
	 * @returns {Expression|string}
	 */
	static optimize(expression) {
		if (typeof expression === 'string') {
			return expression;
		}

		if (expression.content.length === 0) {
			throw new Error('An expressions has to have at least one element');
		}

		if (expression.content.length === 1) {
			return Expression.optimize(expression.content[0]);
		}

		if (expression instanceof Alternation) {
			/** @type {(string|Expression)[]} */
			const content = [];

			for (let e of expression.content) {
				e = Expression.optimize(e);

				if (e instanceof Alternation) {
					content.push(...e.content);
				} else {
					content.push(e);
				}
			}

			return new Alternation(content);
		}

		if (expression instanceof Concatenation) {
			/** @type {(string|Expression)[]} */
			const content = [];

			for (let e of expression.content) {
				e = Expression.optimize(e);

				if (e instanceof Concatenation) {
					content.push(...e.content);
				} else {
					content.push(e);
				}
			}

			return new Concatenation(content);
		}

		throw new TypeError('Invalid type.');
	}

}

export class Alternation extends Expression {

	toString() {
		if (this.content.length === 0) {
			throw new Error('An alternation has to have at least one element');
		}

		if (this.content.length === 1) {
			return this.content[0].toString();
		}

		// convert all elements into strings and sort by length
		const strings = this.content.map(c => c.toString());
		strings.sort((a, b) => a.length - b.length);

		// the alternation is optional if the empty string is included
		const isOptional = strings[0].length === 0;
		let skip = isOptional ? 1 : 0;

		// only single character words -> [abc] or [abc]?
		if (strings[strings.length - 1].length === 1) {
			return Alternation._getOptimalCharacterSet(strings, skip) + (isOptional ? '?' : '');
		}

		// we need at least 3 single character words because 'a|b'.length < '[ab]'.length
		if (strings[skip + 2] && strings[skip + 2].length === 1) {
			let singleCharCount = 3;
			for (let i = skip + 3, l = strings.length; i < l && strings[i].length === 1; i++) {
				singleCharCount++;
			}

			// we replace the last char with the character set and skip all remaining single character words
			const characterSet = Alternation._getOptimalCharacterSet(strings, skip, skip + singleCharCount);
			strings[skip + singleCharCount - 1] = characterSet;
			skip += singleCharCount;
		}

		// join with |
		let result = strings[skip];
		for (let i = skip + 1, l = strings.length; i < l; i++) {
			result += '|' + strings[i];
		}

		return `(?:${result})`;
	}

	/**
	 * Returns the optimal RegExp character set for the given character.
	 *
	 * `start` and `end` will behave has the parameters of `Array.prototype.slice`.
	 *
	 * @param {string[]} chars The list of character. Each character within range have to only contain one code point.
	 * @param {number} [start]
	 * @param {number} [end]
	 * @returns {string}
	 */
	static _getOptimalCharacterSet(chars, start, end) {
		chars = chars.slice(start, end);

		if (chars.length === 1) {
			return chars[0];
		}

		chars.sort((a, b) => a.codePointAt(0) - b.codePointAt(0));

		// we can only really optimize with >= 4 characters
		if (chars.length >= 4) {

			// combine runs
			let runLength = 1;
			for (let i = 0; i < chars.length; i++) {
				if (chars[i + 1] && chars[i + 1].codePointAt(0) === chars[i].charCodeAt(0) + 1) {
					runLength++;
				} else {
					if (runLength >= 4) {
						// a b c d e >f _
						let run = chars[i - runLength + 1] + '-' + chars[i];
						if (run === '0-9') {
							run = '\\d';
						}

						chars.splice(i - runLength + 1, runLength, run);
						i -= runLength - 1;
					}
					runLength = 1;
				}
			}

			// check for matches with predefined character classes
			if (chars.length === 1 && chars[0] === '\\d') {
				return '\\d';
			}

		}

		return `[${chars.join('')}]`;
	}

}

export class Concatenation extends Expression {

	toString() {
		if (this.content.length === 0) {
			throw new Error('A concatenation has to have at least one element');
		}

		var res = '';
		for (var e of this.content) {
			res += e.toString();
		}
		return res;
	}

}
