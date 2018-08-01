var _self = (typeof window !== 'undefined')
	? window   // if in browser
	: (
		(typeof WorkerGlobalScope !== 'undefined' && self instanceof WorkerGlobalScope)
		? self // if in worker
		: {}   // if in node js
	);

/**
 * Prism: Lightweight, robust, elegant syntax highlighting
 * MIT license http://www.opensource.org/licenses/mit-license.php/
 * @author Lea Verou http://lea.verou.me
 */

var Prism = (function(){

// Private helper vars
var lang = /\blang(?:uage)?-([\w-]+)\b/i;
var uniqueId = 0;

/**
 * @typedef PatternObject
 * @type {Object}
 * @property {RegExp} pattern
 * @property {boolean} [lookbehind=false]
 * @property {boolean} [greedy=false]
 * @property {Grammar=} inside
 * @property {string|string[]} [alias]
 *
 * @typedef Pattern
 * @type {RegExp|PatternObject}
 *
 * @typedef GrammarToken
 * @type {Pattern|Pattern[]}
 *
 * @typedef {{[tokenId: string]: GrammarToken; rest: Object.<string, GrammarToken>}} Grammar
 *
 *
 * @typedef {Object} BeforeHighlightAllEnvironment
 * @property {Function} [callback]
 * @property {Element[]} [elements]
 * @property {string} selector
 *
 * @typedef {Object} TokenizeEnvironment
 * @property {string} code
 * @property {Grammar} grammar
 * @property {string} language
 * @property {(string|Token)[]} [tokens]
 *
 * @typedef {Object} WrapEnvironment
 * @property {{[name: string]: string}} attributes
 * @property {string[]} classes
 * @property {string} content
 * @property {string} language
 * @property {Token|(string|Token)[]} [parent]
 * @property {string} tag
 * @property {string} type
 *
 * @typedef {Object} HighlightEnvironment
 * @property {string} code
 * @property {HTMLElement} element
 * @property {Grammar} [grammar]
 * @property {string} [highlightedCode]
 * @property {string} language
 *
 * @typedef {BeforeHighlightAllEnvironment|TokenizeEnvironment|WrapEnvironment|HighlightEnvironment} Environment
 *
 */

var _ = {
	manual: _self.Prism && _self.Prism.manual,
	disableWorkerMessageHandler: _self.Prism && _self.Prism.disableWorkerMessageHandler,
	util: {

		/**
		 * Returns a copy of the given token stream encoded.
		 * @param {string|Token|(string|Token)[]} tokens The tokens to be encoded.
		 * @returns {string|Token|(string|Token)[]} The encoded tokens.
		 */
		encode: function encode(tokens) {
			if (tokens instanceof Token) {
				return new Token(tokens.type, encode(tokens.content), tokens.alias);
			} else if (_.util.type(tokens) === 'Array') {
				return tokens.map(encode);
			} else {
				return tokens.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\u00a0/g, ' ');
			}
		},

		/**
		 * Returns the type of the given object.
		 * @param {Object} o The language id.
		 * @returns {string} The type of the object.
		 */
		type: function (o) {
			return Object.prototype.toString.call(o).match(/\[object (\w+)\]/)[1];
		},

		/**
		 * Gives the given object a unique id if it did not have one already.
		 * @param {Object} obj The object.
		 * @returns {number} The id of the object.
		 */
		objId: function (obj) {
			if (!obj['__id']) {
				Object.defineProperty(obj, '__id', { value: ++uniqueId });
			}
			return obj['__id'];
		},

		/**
		 * Creates a deep clone of the given object. (e.g. to extend language definitions)
		 * @param {Object} o The object to be cloned.
		 * @returns {Object} A deep clone of the original.
		 */
		clone: function deepClone(o, visited) {
			var type = _.util.type(o),
			    objId = _.util.objId;

			visited = visited || {};

			switch (type) {
				case 'Object':
					if (visited[objId(o)]) {
						return visited[objId(o)];
					}
					var clone = {};
					visited[objId(o)] = clone;

					for (var key in o) {
						if (o.hasOwnProperty(key)) {
							clone[key] = deepClone(o[key], visited);
						}
					}

					return clone;

				case 'Array':
					if (visited[objId(o)]) {
						return visited[objId(o)];
					}
					var clone = [];
					visited[objId(o)] = clone;

					o.forEach(function (v, i) {
						clone[i] = deepClone(v, visited);
					});

					return clone;
			}

			return o;
		}
	},

	languages: {

		/**
		 * Creates a new grammar extending the existing grammar of the given language id with the given grammar.
		 * @param {string} id The language id.
		 * @param {Grammar} redef The tokens to be added.
		 * @returns {Grammar} The extended grammar.
		 */
		extend: function (id, redef) {
			var lang = _.util.clone(_.languages[id]);

			for (var key in redef) {
				lang[key] = redef[key];
			}

			return lang;
		},

		/**
		 * @todo Replace the "if not provided" notice.
		 *
		 * Inserts the tokens of `insert` before the token `before` in the grammar `inside` which is a value of `root`.
		 *
		 * This operation will create a copy of the `inside` grammar to insert the tokens.
		 * All occurrences of the old `inside` grammar in `Prism.languages` will be replaced with the new copy.
		 * @param {string} inside The key of `root` or language id.
		 * @param {string} before The key before which `insert` will be inserted. If not provided, the function appends instead.
		 * @param {Grammar} insert The grammar which tokens will be inserted before `before`.
		 * @param {Object<string, Grammar>} [root=Prism.languages] The object containing `inside`. If equal to Prism.languages, it can be omitted.
		 * @returns {Grammar} The copy of the `inside` grammar with the tokens inserted.
		 */
		insertBefore: function (inside, before, insert, root) {
			root = root || _.languages;
			var grammar = root[inside];

			if (arguments.length == 2) {
				insert = arguments[1];

				for (var newToken in insert) {
					if (insert.hasOwnProperty(newToken)) {
						grammar[newToken] = insert[newToken];
					}
				}

				return grammar;
			}

			var ret = {};

			for (var token in grammar) {
				if (grammar.hasOwnProperty(token)) {

					if (token == before) {
						for (var newToken in insert) {
							if (insert.hasOwnProperty(newToken)) {
								ret[newToken] = insert[newToken];
							}
						}
					}

					ret[token] = grammar[token];
				}
			}

			// Update references in other language definitions
			_.languages.DFS(_.languages, function(key, value) {
				if (value === root[inside] && key != inside) {
					this[key] = ret;
				}
			});

			return root[inside] = ret;
		},

		/**
		 * Traverse a language definition with Depth First Search.
		 */
		DFS: function(o, callback, type, visited) {
			visited = visited || {};
			for (var i in o) {
				if (o.hasOwnProperty(i)) {
					callback.call(o, i, o[i], type || i);

					if (_.util.type(o[i]) === 'Object' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, null, visited);
					}
					else if (_.util.type(o[i]) === 'Array' && !visited[_.util.objId(o[i])]) {
						visited[_.util.objId(o[i])] = true;
						_.languages.DFS(o[i], callback, i, visited);
					}
				}
			}
		}
	},

	plugins: {},

	/**
	 *
	 * @param {boolean} [async=false]
	 * @param {Function} [callback]
	 */
	highlightAll: function(async, callback) {
		_.highlightAllUnder(document, async, callback);
	},

	/**
	 *
	 * @param {Element} container
	 * @param {boolean} [async=false]
	 * @param {Function} [callback]
	 */
	highlightAllUnder: function(container, async, callback) {
		var env = {
			callback: callback,
			selector: 'code[class*="language-"], [class*="language-"] code, code[class*="lang-"], [class*="lang-"] code'
		};

		_.hooks.run("before-highlightall", env);

		var elements = env.elements || container.querySelectorAll(env.selector);

		for (var i=0, element; element = elements[i++];) {
			_.highlightElement(element, async === true, env.callback);
		}
	},

	/**
	 *
	 * @param {HTMLElement} element
	 * @param {boolean} [async=false]
	 * @param {(element: HTMLElement) => void} [callback]
	 */
	highlightElement: function(element, async, callback) {
		// Find language
		var language, grammar, parent = element;

		while (parent && !lang.test(parent.className)) {
			parent = parent.parentNode;
		}

		if (parent) {
			language = (parent.className.match(lang) || [,''])[1].toLowerCase();
			grammar = _.languages[language];
		}

		// Set language on the element, if not present
		element.className = element.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;

		if (element.parentNode) {
			// Set language on the parent, for styling
			parent = element.parentNode;

			if (/pre/i.test(parent.nodeName)) {
				parent.className = parent.className.replace(lang, '').replace(/\s+/g, ' ') + ' language-' + language;
			}
		}

		var code = element.textContent;

		var env = {
			element: element,
			language: language,
			grammar: grammar,
			code: code
		};

		var runHook = _.hooks.run;

		runHook('before-sanity-check', env);

		if (!env.code || !env.grammar) {
			if (env.code) {
				runHook('before-highlight', env);
				env.element.textContent = env.code;
				runHook('after-highlight', env);
			}
			runHook('complete', env);
			return;
		}

		runHook('before-highlight', env);

		if (async && _self.Worker) {
			var worker = new Worker(_.filename);

			worker.onmessage = function(evt) {
				env.highlightedCode = evt.data;

				runHook('before-insert', env);

				env.element.innerHTML = env.highlightedCode;

				callback && callback.call(env.element);
				runHook('after-highlight', env);
				runHook('complete', env);
			};

			worker.postMessage(JSON.stringify({
				language: env.language,
				code: env.code,
				immediateClose: true
			}));
		}
		else {
			env.highlightedCode = _.highlight(env.code, env.grammar, env.language);

			runHook('before-insert', env);

			env.element.innerHTML = env.highlightedCode;

			callback && callback.call(element);

			runHook('after-highlight', env);
			runHook('complete', env);
		}
	},

	/**
	 *
	 * @param {string} text
	 * @param {Grammar} grammar
	 * @param {string} language The language id.
	 */
	highlight: function (text, grammar, language) {
		var runHook = _.hooks.run;

		var env = {
			code: text,
			grammar: grammar,
			language: language
		};
		runHook('before-tokenize', env);
		env.tokens = _.tokenize(env.code, env.grammar);
		runHook('after-tokenize', env);
		return Token.stringify(_.util.encode(env.tokens), env.language);
	},

	/**
	 *
	 * @private
	 * @param {string} text
	 * @param {(string|Token)[]} strarr
	 * @param {Grammar} grammar
	 * @param {number} index
	 * @param {number} startPos
	 * @param {boolean} [oneshot=false]
	 * @param {string} [target]
	 */
	matchGrammar: function (text, strarr, grammar, index, startPos, oneshot, target) {
		for (var token in grammar) {
			if (!grammar.hasOwnProperty(token) || !grammar[token]) {
				continue;
			}

			if (token == target) {
				return;
			}

			/**
			 * @type {PatternObject[]}
			 */
			var patterns = grammar[token];
			patterns = (_.util.type(patterns) === "Array") ? patterns : [patterns];

			for (var j = 0; j < patterns.length; ++j) {
				var patternObject = patterns[j];
				var pattern = patternObject.pattern,
					inside = patternObject.inside,
					lookbehind = !!patternObject.lookbehind,
					greedy = !!patternObject.greedy,
					lookbehindLength = 0,
					alias = patternObject.alias;

				if (greedy && !pattern.global) {
					// Without the global flag, lastIndex won't work
					var flags = pattern.toString().match(/[imuy]*$/)[0];
					pattern = RegExp(pattern.source, flags + "g");
				}

				pattern = pattern || patternObject;

				// Don’t cache length as it changes during the loop
				for (var i = index, pos = startPos; i < strarr.length; pos += strarr[i].length, ++i) {

					var str = strarr[i];

					if (strarr.length > text.length) {
						// Something went terribly wrong, ABORT, ABORT!
						return;
					}

					if (str instanceof Token) {
						continue;
					}

					if (greedy && i != strarr.length - 1) {
						pattern.lastIndex = pos;
						var match = pattern.exec(text);
						if (!match) {
							break;
						}

						var from = match.index + (lookbehind ? match[1].length : 0),
						    to = match.index + match[0].length,
						    k = i,
						    p = pos;

						for (var len = strarr.length; k < len && (p < to || (!strarr[k].type && !strarr[k - 1].greedy)); ++k) {
							p += strarr[k].length;
							// Move the index i to the element in strarr that is closest to from
							if (from >= p) {
								++i;
								pos = p;
							}
						}

						// If strarr[i] is a Token, then the match starts inside another Token, which is invalid
						if (strarr[i] instanceof Token) {
							continue;
						}

						// Number of tokens to delete and replace with the new match
						delNum = k - i;
						str = text.slice(pos, p);
						match.index -= pos;
					} else {
						pattern.lastIndex = 0;

						var match = pattern.exec(str),
							delNum = 1;
					}

					if (!match) {
						if (oneshot) {
							break;
						}

						continue;
					}

					if(lookbehind) {
						lookbehindLength = match[1] ? match[1].length : 0;
					}

					var from = match.index + lookbehindLength,
					    match = match[0].slice(lookbehindLength),
					    to = from + match.length,
					    before = str.slice(0, from),
					    after = str.slice(to);

					var args = [i, delNum];

					if (before) {
						++i;
						pos += before.length;
						args.push(before);
					}

					var wrapped = new Token(token, inside? _.tokenize(match, inside) : match, alias, match, greedy);

					args.push(wrapped);

					if (after) {
						args.push(after);
					}

					Array.prototype.splice.apply(strarr, args);

					if (delNum != 1)
						_.matchGrammar(text, strarr, grammar, i, pos, true, token);

					if (oneshot)
						break;
				}
			}
		}
	},

	/**
	 *
	 * @param {string} text
	 * @param {Grammar} grammar
	 * @returns {(string|Token)[]}
	 */
	tokenize: function(text, grammar, language) {
		var strarr = [text];

		var rest = grammar.rest;

		if (rest) {
			for (var token in rest) {
				grammar[token] = rest[token];
			}

			delete grammar.rest;
		}

		_.matchGrammar(text, strarr, grammar, 0, 0, false);

		return strarr;
	},

	hooks: {
		/**
		 * A map from the name a hook to its respective list of callbacks.
		 * @type {{[hookName: string]: Array.<(env: Environment) => void>}}
		 */
		all: {},

		/**
		 * Adds a given callback to the list of callbacks for the given hook.
		 * @param {string} name The name of the hook.
		 * @param {(env: Environment) => void} callback
		 */
		add: function (name, callback) {
			var hooks = _.hooks.all;

			hooks[name] = hooks[name] || [];

			hooks[name].push(callback);
		},

		/**
		 * Calls all callback for the given hook. Callbacks are called in the order they were added.
		 * @param {string} name The name of the hook.
		 * @param {Environment} env The environment given to the callbacks.
		 */
		run: function (name, env) {
			var callbacks = _.hooks.all[name];

			if (!callbacks || !callbacks.length) {
				return;
			}

			for (var i=0, callback; callback = callbacks[i++];) {
				callback(env);
			}
		}
	}
};
_self.Prism = _;

/**
 *
 * @class
 * @alias Token
 * @param {string} type
 * @param {string} content
 * @param {string|string[]} [alias]
 * @param {string} [matchedStr=""]
 * @param {boolean} [greedy=false]
 */
var Token = function (type, content, alias, matchedStr, greedy) {
	this.type = type;
	this.content = content;
	this.alias = alias;
	// Copy of the full string this token was created from
	this.length = (matchedStr || "").length|0;
	this.greedy = !!greedy;
};
_.Token = Token;

/**
 *
 * @param {string|Token|(string|Token)[]} o
 * @param {string} language The language id.
 * @param {Token|(string|Token)[]} [parent]
 */
Token.stringify = function (o, language, parent) {
	if (typeof o === 'string') {
		return o;
	}

	if (_.util.type(o) === 'Array') {
		return o.map(function(element) {
			return Token.stringify(element, language, o);
		}).join('');
	}

	var env = {
		type: o.type,
		content: Token.stringify(o.content, language, parent),
		tag: 'span',
		classes: ['token', o.type],
		attributes: {},
		language: language,
		parent: parent
	};

	if (o.alias) {
		var aliases = _.util.type(o.alias) === 'Array' ? o.alias : [o.alias];
		Array.prototype.push.apply(env.classes, aliases);
	}

	_.hooks.run('wrap', env);

	var attributes = Object.keys(env.attributes).map(function (name) {
		return name + '="' + (env.attributes[name] || '').replace(/"/g, '&quot;') + '"';
	}).join(' ');

	return '<' + env.tag + ' class="' + env.classes.join(' ') + '"' + (attributes ? ' ' + attributes : '') + '>' + env.content + '</' + env.tag + '>';
};

if (!_self.document) {
	if (!_self.addEventListener) {
		// in Node.js
		return _self.Prism;
	}

	if (!_.disableWorkerMessageHandler) {
		// In worker
		_self.addEventListener('message', function (evt) {
			var message = JSON.parse(evt.data),
				lang = message.language,
				code = message.code,
				immediateClose = message.immediateClose;

			_self.postMessage(_.highlight(code, _.languages[lang], lang));
			if (immediateClose) {
				_self.close();
			}
		}, false);
	}

	return _self.Prism;
}

//Get current script and highlight
var script = document.currentScript || [].slice.call(document.getElementsByTagName("script")).pop();

if (script) {
	_.filename = script.src;

	if (!_.manual && !script.hasAttribute('data-manual')) {
		if (document.readyState !== "loading") {
			if (window.requestAnimationFrame) {
				window.requestAnimationFrame(_.highlightAll);
			} else {
				window.setTimeout(_.highlightAll, 16);
			}
		} else {
			document.addEventListener('DOMContentLoaded', _.highlightAll);
		}
	}
}

return _self.Prism;

})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = Prism;
}

// hack for components to work correctly in node.js
if (typeof global !== 'undefined') {
	global.Prism = Prism;
}
