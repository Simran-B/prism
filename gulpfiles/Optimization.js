
// @ts-check

"use strict";

import { PrefixTreeNode } from './PrefixTree.js';

/**
 *
 * @param {PrefixTreeNode} root
 * @returns {PrefixTreeNode[]}
 */
export function getOptimalPrefixCandidates(root) {
	if (!root || root.wordCount === 0) {
		throw new Error('Give at least one word');
	}
	if (root.wordCount === 1) {
		return [];
	}

	// if all words have a common prefix `pre` of a certain length it is guaranteed to be beat everything else
	if (!root.isWord && root.childCount === 1) {
		let node = root;
		while (!node.isWord && node.childCount === 1) {
			for (const child of node) {
				node = child;
			}
		}

		return [node];
	}

	/** @type {PrefixTreeNode[]} */
	const candidates = [];

	/**
	 * @param {PrefixTreeNode} node
	 */
	function choosePrefixes(node) {
		// single word
		if (node.wordCount === 1)
			return;

		// it is always possible to find a better prefix if the current tree is its parent only child and not a word
		// therefore we only need to check in all other cases
		// e.g. abc|abcdef|abcghi -> we don't need to check 'a' and 'ab'

		if (node.isWord || node.childCount > 1) {
			candidates.push(node);
		}

		// try all prefixes
		node.forEach(choosePrefixes);
	}

	root.forEach(choosePrefixes);

	return candidates;
}
