(function (Prism) {

	var createTemplate = Prism.languages.templating.createTemplate;

	Object.defineProperties(Prism.languages['markup-templating'] = {}, {
		buildPlaceholders: {
			/**
			 * Tokenize all inline templating expressions matching `placeholderPattern`.
			 *
			 * @param {object} env The environment of the `before-tokenize` hook.
			 * @param {string} language The language id.
			 * @param {RegExp|Object<string, any>} placeholderPatternOrGrammar The pattern of templating grammar which
			 * matches the parts of the code that will be replaced with placeholders.
			 */
			value: function (env, language, placeholderPatternOrGrammar, replaceFilter) {
				if (env.language !== language) {
					return;
				}

				if (replaceFilter) {
					throw new Error('replaceFilter is not supported anymore.')
				}

				var grammar;
				if (Prism.util.type(placeholderPatternOrGrammar) === 'RegExp') {
					grammar = {};
					grammar[language] = {
						pattern: placeholderPatternOrGrammar,
						alias: 'language-' + language
					};
				} else {
					grammar = placeholderPatternOrGrammar;
				}

				var template = createTemplate(env.code, {
					grammar: grammar,
					getValue: function (token) {
						token.content = Prism.tokenize(token.content, Prism.languages[language]);
						return token;
					}
				});

				env.template = template;
				env.code = template.code;

				// Switch the grammar to markup
				env.grammar = Prism.languages.markup;
			}
		},
		tokenizePlaceholders: {
			/**
			 * Replace placeholders with proper tokens after tokenizing.
			 *
			 * @param {object} env The environment of the `after-tokenize` hook.
			 * @param {string} language The language id.
			 */
			value: function (env, language) {
				if (env.language !== language || !env.template) {
					return;
				}

				// Switch the grammar back
				env.grammar = Prism.languages[language];

				env.template.interpolate(env.tokens);
			}
		}
	});

}(Prism));
