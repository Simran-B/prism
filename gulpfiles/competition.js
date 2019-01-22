// @ts-check

"use strict";

/**
 * @typedef Competitor
 * @property {(this: T) => void} qualified
 * @template T
 */

/**
 * @template T
 */
export class Competition {

	constructor(maxCount) {
		/** @type {{competitor: T & Competitor.<T>, score: number}[]} */
		this.data = [];
		this.maxCount = maxCount;
		this.lowestScore = NaN;
		this.closed = false;
		/** @type {T[]} */
		this.finalists = null;
	}

	/**
	 *
	 * @param {T & Competitor.<T>} competitor
	 * @param {number} score
	 * @memberof Competition
	 */
	compete(competitor, score) {
		if (this.closed)
			throw new Error('Competition already closed.');
		if (!isFinite(score))
			throw new Error('Invalid score "' + score + '".');

		if (this.data.length < this.maxCount) {
			this.data.push({ competitor: competitor, score: score });
			this.lowestScore = isNaN(this.lowestScore) ? score : Math.min(this.lowestScore, score);
			this._sort();
		} else if (score > this.lowestScore) {
			this.data.pop();
			this.data.push({ competitor: competitor, score: score });
			this._sort();
			this.lowestScore = this.data[this.data.length - 1].score;
		}
	}

	/**
	 *
	 * @memberof Competition
	 */
	_sort() {
		this.data.sort((a, b) => {
			return a.score - b.score;
		});
	}

	/**
	 *
	 * @returns {T[]}
	 * @memberof Competition
	 */
	close() {
		if (this.closed)
			return this.finalists;

		this.closed = true;
		return this.finalists = this.data.map(c => {
			c.competitor.qualified();
			return c.competitor;
		});
	}

}
