// @ts-check

"use strict";

import { Alternation, Concatenation, Expression } from "./Expression.js";

/**
 *
 * @param {Iterable<string>} words
 * @returns {string} A regex pattern matching the given words.
 */
export function fold(words) {
	const dfa = DFA.fromWords(words);
	return stringOptimize(dfa.minimize().toRegex()).toString();
}

/**
 *
 * @param {Expression | string} expr
 * @returns {Expression | string}
 */
function stringOptimize(expr) {
	/**
	 * Given the length of a prefix or suffix of an alternation with `alternationCount` alternatives, it returns
	 * whether the string should be duplicated and concatenated with all alternatives.
	 *
	 * This assumes that the string and alternation are the only elements of an concatenation which is element of an
	 * alternation.
	 *
	 * @param {number} strLength
	 * @param {number} alternationCount
	 * @returns {boolean}
	 */
	function shouldIncludeString(strLength, alternationCount) {
		// (?:a|b|c)d or ad|bd|cd
		// If the length of both is the same then the latter is preferred

		return false || strLength * alternationCount + alternationCount - 1 <= strLength + alternationCount - 1 + 4;
	}

	/**
	 *
	 * @param {Expression | string} expr
	 * @returns {boolean}
	 */
	function optimizeAlternations(expr) {
		if (typeof expr === "string")
			return false;

		let result = false;
		expr.content.forEach(e => result = optimizeAlternations(e) || result);

		if (expr instanceof Alternation) {
			for (let i = 0; i < expr.content.length; i++) {
				const element = expr.content[i];
				if (element instanceof Concatenation) {
					if (element.content.length === 2) {
						const first = element.content[0];
						const second = element.content[1];

						if (typeof first === "string" && second instanceof Alternation) {
							// a(?:b|c) -> ab|ac
							if (shouldIncludeString(first.length, second.content.length)) {
								expr.content[i] = new Alternation(second.content.map(e => new Concatenation([first, e])));
								result = true;
							}
						} else if (first instanceof Alternation && typeof second === "string") {
							// (?:b|c)a -> ba|ca
							if (shouldIncludeString(second.length, first.content.length)) {
								expr.content[i] = new Alternation(first.content.map(e => new Concatenation([e, second])));
								result = true;
							}
						}
					}
				}
			}
		}

		return result;
	}

	let changed = true;
	while (changed) {
		expr = Expression.optimize(expr);
		changed = optimizeAlternations(expr);
	}
	return expr;
}


/**
 *
 * @param {Iterable<T>} iter
 * @returns {T|undefined}
 * @template T
 */
function firstOf(iter) {
	for (const value of iter) {
		return value;
	}
	return undefined;
}

/**
 *
 * @param {Iterable<T>} s1
 * @param {Set<T>} s2
 * @returns {Set<T>}
 * @template T
 */
function withoutSet(s1, s2) {
	const s = new Set();
	for (const x of s1) {
		if (!s2.has(x)) s.add(x);
	}
	return s;
}
/**
 *
 * @param {Iterable<T>} s1
 * @param {Set<T>} s2
 * @returns {Set<T>}
 * @template T
 */
function intersectSet(s1, s2) {
	const s = new Set();
	for (const x of s1) {
		if (s2.has(x)) s.add(x);
	}
	return s;
}
/**
 *
 * @param {Set<T>} s1
 * @param {Set<T>} s2
 * @returns {boolean}
 * @template T
 */
function disjoint(s1, s2) {
	for (const x of s1) {
		if (s2.has(x)) return false;
	}
	return true;
}


export class DFA {

	/**
	 * @typedef Node
	 * @property {Map<number, Node>} out
	 */


	/**
	 *
	 * @param {Node} initial
	 * @param {Set<Node>} finals
	 */
	constructor(initial, finals) {
		this.initial = initial;
		this.finals = finals;
	}

	/**
	 * @returns {DFA}
	 */
	minimize() {
		this.removeDeadStates();

		const P = this.findEquivalenceClasses();

		/** @type {Map<Node, Node>} */
		const newNodeMap = new Map();
		P.forEach(nodes => {
			const newNode = DFA.createNode();
			nodes.forEach(n => newNodeMap.set(n, newNode));
		});

		// initial and finals
		const initial = newNodeMap.get(this.initial);
		const finals = new Set();
		this.finals.forEach(f => finals.add(newNodeMap.get(f)));

		// transitions
		P.forEach(nodes => {
			nodes.forEach(n => {
				const from = newNodeMap.get(n);
				n.out.forEach((outNode, charCode) => {
					const to = newNodeMap.get(outNode);
					if (from.out.get(charCode) !== to) {
						DFA.linkNodes(from, to, charCode);
					}
				});
			});
		});

		return new DFA(initial, finals);
	}

	/**
	 *
	 * @returns {Set<Set<Node>>}
	 */
	findEquivalenceClasses() {
		// https://en.wikipedia.org/wiki/DFA_minimization#Hopcroft's_algorithm

		/** @type {Set<Node>} */
		const allNodes = new Set();
		/** @type {Set<number>} */
		const alphabet = new Set();
		/**
		 * A map from a char code to all nodes which have an incoming transition with that char code.
		 * @type {Map<Node, Map<number, Set<Node>>>}
		 */
		const inTransitions = new Map();
		const visitAll = (node = this.initial) => {
			if (allNodes.has(node)) return;
			else allNodes.add(node);

			node.out.forEach((outNode, charCode) => {
				alphabet.add(charCode);
				visitAll(outNode);

				let inMap = inTransitions.get(outNode);
				if (inMap === undefined) {
					inTransitions.set(outNode, inMap = new Map());
				}

				let set = inMap.get(charCode);
				if (set === undefined) {
					inMap.set(charCode, set = new Set());
				}
				set.add(node);
			});
			for (const outNode of node.out.values()) {
				visitAll(outNode);
			}
		}
		visitAll();

		/** @type {Set<Set<Node>>} */
		const P = new Set([this.finals, withoutSet(allNodes, this.finals)]);
		/** @type {Set<Set<Node>>} */
		const W = new Set([this.finals]);

		while (W.size > 0) {
			const A = firstOf(W);
			W.delete(A);

			for (const c of alphabet) {
				const X = new Set();
				A.forEach(n => {
					const edges = inTransitions.get(n);
					if (edges === undefined) return;
					const inOfC = edges.get(c);
					if (inOfC === undefined) return;
					inOfC.forEach(x => X.add(x));
				});
				if (X.size === 0) continue;

				const pToAdd = [];
				const pToDelete = [];
				for (const Y of P) {
					const intersection = intersectSet(X, Y);
					if (intersection.size === 0) continue;
					const without = withoutSet(Y, X);
					if (without.size === 0) continue;

					pToAdd.push(intersection, without);
					pToDelete.push(Y);

					if (W.has(Y)) {
						W.delete(Y);
						W.add(intersection).add(without);
					} else {
						if (intersection.size < without.size) {
							W.add(intersection);
						} else {
							W.add(without);
						}
					}
				}
				pToDelete.forEach(x => P.delete(x));
				pToAdd.forEach(x => P.add(x));
			}
		}

		return P;
	}

	removeDeadStates() {
		/** @type {Set<Node>} */
		const dead = new Set();
		/** @type {Set<Node>} */
		const alive = new Set();

		/**
		 *
		 * @param {Node} node
		 * @param {Node[]} stack
		 */
		const isDead = (node, stack = []) => {
			if (dead.has(node)) return true;
			if (alive.has(node)) return false;

			if (this.finals.has(node)) {
				alive.add(node);
				return false;
			}

			if (stack.includes(node)) {
				return undefined; // probably dead
			}

			stack.push(node);

			const toDelete = []
			let hasAliveOutEdges = false;
			node.out.forEach((outNode, key) => {
				const res = isDead(outNode, stack);
				if (res === true) {
					toDelete.push(key);
				} else if (res === false) {
					hasAliveOutEdges = true;
				}
			});

			toDelete.forEach(key => node.out.delete(key));

			stack.pop();

			if (hasAliveOutEdges) {
				alive.add(node);
				return false;
			} else {
				dead.add(node);
				return true;
			}
		}

		if (isDead(this.initial)) {
			this.finals.clear();
		}
	}

	/**
	 * @returns {Expression | string}
	 */
	toRegex() {
		/**
		 * @typedef RENode
		 * @property {Map<RENode, Expression | string>} out
		 * @property {Map<RENode, Expression | string>} in
		 */

		/**
		 * @returns {RENode}
		 */
		const createNode = () => ({ in: new Map(), out: new Map() });
		/** @type {Map<Node, RENode>} */
		const nodeToRENodeMap = new Map();
		/**
		 *
		 * @param {Node} node
		 * @returns {RENode}
		 */
		const nodeOf = node => {
			let reNode = nodeToRENodeMap.get(node);
			if (reNode === undefined) {
				nodeToRENodeMap.set(node, reNode = createNode());
			}
			return reNode;
		};
		/**
		 *
		 * @param {RENode} from
		 * @param {RENode} to
		 * @param {Expression | string} expr
		 * @returns {Expression | string}
		 */
		const link = (from, to, expr) => {
			if (from.out.has(to)) {
				expr = new Alternation([expr, from.out.get(to)]);
			}
			from.out.set(to, expr);
			to.in.set(from, expr);
			return expr;
		};


		// make new initial and final state
		const initial = createNode();
		const final = createNode();

		// connect
		link(initial, nodeOf(this.initial), "");
		this.finals.forEach(f => link(nodeOf(f), final, ""));

		// add the rest of the graph
		/**
		 *
		 * @param {Node} node
		 * @param {Node[]} stack
		 */
		const addNode = (node, stack = []) => {
			if (stack.includes(node)) return;
			stack.push(node);

			const reNode = nodeOf(node);

			/** @type {Map<Node, Alternation>} */
			const alternations = new Map();
			node.out.forEach((outNode, charCode) => {
				let alt = alternations.get(outNode);
				if (alt === undefined) {
					alt = new Alternation([]);
					link(reNode, nodeOf(outNode), alt)
					alternations.set(outNode, alt);

					// recursion
					addNode(outNode, stack);
				}
				alt.content.push(String.fromCharCode(charCode));
			});

			stack.pop();
		};
		addNode(this.initial);

		/**
		 * @returns {Iterable<RENode>}
		 */
		function iterate() {
			/** @type {Set<RENode>} */
			const visited = new Set();
			let toVisit = [initial]

			while (toVisit.length > 0) {
				const newToVisit = [];
				for (const node of toVisit) {
					if (visited.has(node))
						continue;
					else
						visited.add(node);

					newToVisit.push(...node.out.keys());
				}
				toVisit = newToVisit;
			}

			return visited;
		}

		// reduction steps
		let changed = true;
		while (changed) {
			changed = false;

			for (const node of iterate()) {
				if (node.out.has(node))
					throw new Error("Kleene star is not supported yet.");

				if (node.in.size === 1 && node.out.size === 1) {
					const from = firstOf(node.in.keys());
					const to = firstOf(node.out.keys());
					const expr = new Concatenation([firstOf(node.in.values()), firstOf(node.out.values())]);

					from.out.delete(node);
					to.in.delete(node);
					node.in.clear();
					node.out.clear();
					link(from, to, expr);

					changed = true;
					continue;
				}
			}

			if (!changed) {
				// we want to take away 1 out going edge of a node which has at least 2

				// optimize all expressions
				for (const node of iterate()) {
					node.out.forEach((expr, outNode) => {
						const optimized = Expression.optimize(expr);
						node.out.set(outNode, optimized);
						outNode.in.set(node, optimized);
					});
				}

				// find all candidates and measure them
				/** @type {RENode} */
				let min = undefined;
				/** @type {RENode} */
				let minOut = undefined;
				/** @type {number} */
				let minScore = undefined;
				for (const node of iterate()) {
					if (node.in.size >= 1 && node.out.size > 1) {
						let inScore = 0;
						node.in.forEach((expr) => inScore += expr.toString().length);

						node.out.forEach((expr, outNode) => {
							const score = inScore + node.in.size * (expr.toString().length);
							if (minScore === undefined || score < minScore) {
								min = node;
								minOut = outNode;
								minScore = score;
							}
						});
					}
				}

				// remove the minimum
				if (min !== undefined) {
					const outExpr = min.out.get(minOut);
					min.in.forEach((expr, inNode) => {
						link(inNode, minOut, new Concatenation([expr, outExpr]));
					});
					min.out.delete(minOut);
					minOut.in.delete(min);

					changed = true;
				}
			}
		}

		if (initial.out.size === 1 && initial.out.has(final)) {
			return firstOf(initial.out.values());
		}

		// this shouldn't happen
		throw new Error("Unable to further reduce the expression");
	}

	/**
	 *
	 * @param {Iterable<string>} words
	 * @returns {DFA}
	 */
	static fromWords(words) {
		const initial = DFA.createNode();
		const finals = /** @type {Set<Node>} */ (new Set());

		// just build a prefix trie
		for (const word of words) {
			let node = initial;
			for (let i = 0; i < word.length; i++) {
				const charCode = word.charCodeAt(i);
				let next = node.out.get(charCode);
				if (next === undefined) {
					next = DFA.createNode();
					DFA.linkNodes(node, next, charCode);
				}
				node = next;
			}
			finals.add(node);
		}

		return new DFA(initial, finals);
	}

	/**
	 * @returns {Node}
	 */
	static createNode() {
		return {
			out: new Map(),
		};
	}

	/**
	 *
	 * @param {Node} from
	 * @param {Node} to
	 * @param {number} codePoint
	 */
	static linkNodes(from, to, codePoint) {
		if (from.out.has(codePoint)) {
			throw new Error("The from node already has an out edge for that code point.");
		}

		from.out.set(codePoint, to);
	}

}
