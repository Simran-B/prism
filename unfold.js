/**
 *
 * @param {string} list
 */
function unfold(list) {
	if (!list)
		return [""];

	/**
	 * @param {RegExp} base
	 * @param {Object.<string, string>} replacements
	 */
	const regexReplace = (base, replacements) => {
		var source = base.source;

		for (const patternSource in replacements) {
			if (replacements.hasOwnProperty(patternSource)) {
				const pattern = RegExp(patternSource, "g");
				let replacement = replacements[patternSource];
				replacement = replacement.source || replacement;
				source = source.replace(pattern, replacement)
			}
		}

		return RegExp(source, base.flags);
	}


	const allowedChars = /\w /;

	const char = RegExp("[" + allowedChars.source + "]");

	const braces = regexReplace(/(?:<nc((?:[^<>]|<(?:[^<>]|<(?:[^<>]|<(?:[^<>]|<(?:[^<>]|<[^<>]+>)+>)+>)+>)+>)+)>)/, { nc: "(?:\\?\\:)?", '<': "\\(", '>': "\\)" });
	const word = regexReplace(/(?:[allowedChars?\[\]]|braces)+/g, { braces: braces, allowedChars: allowedChars });
	const optionalChar = regexReplace(/(char)\?/, { char: char });
	const charSet = regexReplace(/\[(char+)\]/, { char: char });


	const isOptional = (match) => {
		return match && match.input[match.index + match[0].length] === "?";
	}
	const unfoldWord = (word = "") => {
		/**
		 * Recursively calls `unfoldWord` on each of the given words and returns the resulting words.
		 * @param {string[]} words
		 * @returns {string[]}
		 */
		const unfoldWordArray = (words) => {
			let unfoldedWords = [];
			words.forEach(w => {
				unfoldedWords.push(...unfoldWord(w));
			});
			return unfoldedWords;
		}

		debugger;

		// unfold brace
		// s(e|om|tor)e => see some store
		const bMatch = braces.exec(word);
		if (bMatch) {
			const optional = isOptional(bMatch) ? 1 : 0;
			const before = word.substr(0, bMatch.index);
			const after = word.substr(bMatch.index + bMatch[0].length + optional);
			const inner = unfold(bMatch[1]);

			let words = inner.map(w => before + w + after);
			if (optional) words.unshift(before + after);

			return unfoldWordArray(words);
		}

		// unfold optional character
		// colou?r => color colour
		const oMatch = optionalChar.exec(word);
		if (oMatch) {
			const before = word.substr(0, oMatch.index);
			const after = word.substr(oMatch.index + oMatch[0].length);

			let words = [before + after, before + oMatch[1] + after];

			return unfoldWordArray(words);
		}

		// unfold character set
		// [gsyl]et => get set yet let
		const cMatch = charSet.exec(word);
		if (cMatch) {
			const optional = isOptional(cMatch) ? 1 : 0;
			const before = word.substr(0, cMatch.index);
			const after = word.substr(cMatch.index + cMatch[0].length + optional);

			let words = Array.from(cMatch[1]).map(w => before + w + after);
			if (optional) words.unshift(before + after);

			return unfoldWordArray(words);
		}

		return [word];
	}

	let words = [];
	let match;
	while (match = word.exec(list)) {
		words.push(...unfoldWord(match[0]));
	}

	return words;
}
