// @ts-check

/**
 *
 * @param {RegExp} base
 * @param {Object.<string, string|RegExp>} replacements
 * @returns {RegExp}
 */
function regexReplace(base, replacements) {
	let source = base.source;

	for (let placeholder in replacements) {
		let placeholderPattern = RegExp(placeholder, "g");

		let replacement = replacements[placeholder];
		let replacementSource = replacement instanceof RegExp ? replacement.source : replacement;

		source = source.replace(placeholderPattern, replacementSource);
	}

	return RegExp(source, base.flags);
}

/**
 *
 * @param {RegExpExecArray} match
 * @returns {boolean}
 */
function isOptional(match) {
	return match != null && match.input[match.index + match[0].length] === "?";
}

let char = /[^\\(?:)|[\]]/;

let patterns = {

	charSet: regexReplace(/\[(char+)\]/, { char: char }),
	optionalCharacter: regexReplace(/(char)\?/, { char: char }),

	braces: (function () {
		let bracesBase = /\((?:[^()]|inner)+\)/.source;
		let braces = bracesBase.replace('|inner', '');
		for (let i = 0; i < 5; i++)
			braces = bracesBase.replace('inner', braces);

		return regexReplace(/\(\?\:((?:[^()]|braces)+)\)/, { braces: braces });
	}()),

	simpleWord: regexReplace(/^char+$/, { char: char }),

};

/**
 *
 * @param {string} list
 * @returns {string}
 */
function preprocessList(list) {
	return list.replace(/\[([^[\]]+)\]/g, (m, chars) => {
		return '[' + chars.replace(/\\d/g, '0-9').replace(/(.)-(.)/g, (m, start, stop) => {
			const chars = [];
			start = start.charCodeAt(0);
			stop = stop.charCodeAt(0);
			for(let i = start; i <= stop; i++)
				chars.push(String.fromCharCode(i));
			return chars.join('');
		}) + ']';
	}).replace(/\\d/g, '[0123456789]');
}

/**
 *
 * @param {string} list `abc|def|ghi?`
 * @returns {string[]} `['abc', 'def', 'gh', 'ghi']`
 */
function unfold(list) {
	if (typeof list !== 'string')
		throw new TypeError('list has to be a string');

	// trivial cases
	if (!list)
		return [""];
	if (patterns.simpleWord.test(list))
		return [list];

	list = preprocessList(list);

	// check for integrity
	if (list.indexOf('\\') >= 0)
		throw new Error('Escape sequences are not supported.');
	if (list.indexOf('??') >= 0)
		throw new Error('Lazy optionals are not supported.');
	if (list.match(/\((?!\?)/))
		throw new Error('Capturing groups are not supported.');
	if (list.indexOf('[]') >= 0)
		throw new Error('Empty character sets are not supported.')


	let words = [];

	let wordPattern = regexReplace(/^((?:[^\\():|]|braces)+)(?:$|\|(?=.))/, { braces: patterns.braces });
	for (let match = null; match = wordPattern.exec(list);) {
		// add words
		words.push.apply(words, unfoldWord(match[1]));

		// cut list
		list = list.substr(match[0].length);
	}

	if (list.length !== 0)
		throw new Error('Some parts of the word list could not be unfolded:\n' + list);

	return words;
}

/**
 *
 * @param {string} word `ghi?`
 * @returns {string[]} `['gh', 'ghi']`
 */
function unfoldWord(word) {
	let before = '', after = '', match = null;
	/**
	 * @param {boolean} [optional]
	 */
	function setBeforeAfter(optional) {
		if (optional === undefined)
			optional = isOptional(match);

		before = word.substr(0, match.index);
		after = word.substr(match.index + match[0].length + (optional ? 1 : 0));
	}


	// unfold brace
	// s(?:e|om|tor)e => see some store
	match = patterns.braces.exec(word);
	if (match) {
		let optional = isOptional(match);
		setBeforeAfter(optional);

		let words = [];
		if (optional) words.push(before + after);

		let inners = unfold(match[1]);
		for (let i = 0, l = inners.length; i < l; i++)
			words.push(before + inners[i] + after);

		return unfoldWordArray(words);
	}

	// unfold optional character
	// colou?r => color colour
	match = patterns.optionalCharacter.exec(word);
	if (match) {
		setBeforeAfter(false);

		let words = [before + after, before + match[1] + after];

		return unfoldWordArray(words);
	}

	// unfold character set
	// [gsyl]et => get set yet let
	match = patterns.charSet.exec(word);
	if (match) {
		let optional = isOptional(match);
		setBeforeAfter(optional);

		let words = [];
		if (optional) words.push(before + after);

		let set = match[1];
		for (let i = 0, l = set.length; i < l; i++)
			words.push(before + set[i] + after);

		return unfoldWordArray(words);
	}

	return [word];
}

/**
 *
 * @param {string[]} words
 * @returns {string[]}
 */
function unfoldWordArray(words) {
	let unfoldedWords = [];
	words.forEach(function (w) {
		unfoldedWords.push.apply(unfoldedWords, unfoldWord(w));
	});
	return unfoldedWords;
}

if (typeof module !== 'undefined')
	module.exports = unfold;
