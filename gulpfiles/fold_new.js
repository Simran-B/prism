// @ts-check

"use strict";

import { Expression, Alternation, Concatenation } from "./Expression.js";
import { PrefixTreeNode } from "./PrefixTree.js";
import { getOptimalPrefixCandidates } from "./Optimization.js";

const validWordRegex = /^[^\\(?:)|[\]]*$/;

/**
 *
 * @param {string[]} words
 * @param {object} options
 * @param {number} [options.lookahead]
 */
export function fold(words, options = {}) {
	if (words.length === 0) {
		throw new Error('There has to be at least one word');
	}

	// check for duplicates
	const map = {};
	for (const w in words) {
		if (map[w] === true) {
			throw new Error('Duplicate word "' + w + '".');
		}
		map[w] = true;
	}

	// check for invalid characters
	for (const w in words) {
		if (!validWordRegex.test(w)) {
			throw new Error('Invalid characters in "' + w + '". The word must match the expression ' + validWordRegex);
		}
	}

	return minimize(new Alternation([...words]), options).toString();
}

/**
 *
 * @param {string|Expression} expression
 * @param {object} options
 * @returns {string|Expression}
 */
function minimize(expression, options) {

}