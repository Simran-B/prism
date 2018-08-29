
/**
 * @typedef Competitor
 * @property {(this: T) => void} qualified
 */

/**
 * @template T
 */
class Competition {

	constructor(maxCount) {
		/** @type {{competitor: T & Competitor, score: number}[]} */
		this.data = [];
		this.maxCount = maxCount;
		this.lowestScore = NaN;
		this.closed = false;
	}

	/**
	 *
	 * @param {T & Competitor} competitor
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
			this.data.push({ competitor: competitor, score: score });
			this._sort();
			this.data.pop();
			this.lowestScore = this.data[this.data.length - 1].score;
		}
	}

	/**
	 *
	 * @memberof Competition
	 */
	_sort() {
		this.data.sort(function (a, b) {
			return a.score - b.score;
		});
	}

	/**
	 *
	 * @returns {T[]}
	 * @memberof Competition
	 */
	close() {
		return this.data.map(function (c) {
			c.competitor.qualified();
			return c.competitor;
		});
	}

}


if (typeof module !== 'undefined')
	module.exports = Competition;