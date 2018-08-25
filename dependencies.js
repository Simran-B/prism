
// TODO: Merge this file with `components.js`
// TODO: Documentation

(function (components) {

	var paths = {

		// ./prop1/prop2/prop3/

		/**
		 * Removes leading and trailing slashes `/` from the given string.
		 * @param {string} string the string.
		 * @returns {string} the string without leading and trailing slashes.
		 */
		trimSlash: function trimSlash(string) {
			return (string || '').replace(/^\/|\/$/g, '');
		},

		/**
		 * Returns the base path of the given path. The base path is equal to the given path without the last property.
		 * @param {string} path the path.
		 * @returns {string} the base of the given path.
		 */
		getBase: function getBase(path) {
			var cleanPath = paths.trimSlash(path);
			if (cleanPath.indexOf('/') < 0)
				return '';

			var parts = cleanPath.split('/');
			parts.pop();
			return parts.join('/') + '/';
		},

		/**
		 * Returns the name of the given path. The name is the last property of the path.
		 * @param {string} path the path.
		 * @returns {string} the name of the path.
		 */
		getName: function getName(path) {
			return paths.trimSlash(path).split('/').pop();
		},

		/**
		 * - Removes leading slashes and adds a trailing slash if `path` did not end with one.
		 * - `base` and `path` will be concatenated.
		 * - All properties before the last `.` property will be removed.
		 * - If the resulting full path is empty, an empty string will be returned.
		 * @param {string} path the path to be simplified.
		 * @param {string} [base=''] the base path of `path`.
		 * @returns {string}
		 */
		simplify: function simplify(path, base) {
			var cleanPath = paths.trimSlash(path);
			if (base)
				cleanPath = paths.trimSlash(paths.trimSlash(base) + '/' + cleanPath);

			if (!cleanPath)
				return '';

			var parts = cleanPath.split('/');
			if (parts.length === 0)
				return parts[0] + '/';

			var lastRoot = -1;
			for (var i = parts.length - 1; i >= 0; i--)
				if (parts[i] === '.') {
					lastRoot = i;
					break;
				}
			if (lastRoot > 0)
				parts.splice(0, lastRoot);

			return parts.join('/') + '/';
		},

		/**
		 * This is equivalent to `simplify(path, './')`.
		 * @param {string} path the path to be normalized.
		 * @returns {string}
		 */
		normalize: function normalize(path) {
			return paths.simplify(path, './');
		},


		/**
		 * @param {string} path
		 * @param {string} [base='']
		 * @param {Object.<string, any>} [root=components]
		 * @returns {any}
		 */
		getItem: function getItem(path, base, root) {
			if (!root)
				root = components;

			var cleanPath = paths.simplify(path, base);
			if (!cleanPath)
				return root;

			var parts = paths.trimSlash(cleanPath).split('/');

			var current = root;
			for (var i = 0; i < parts.length; i++) {
				var part = parts[i];
				if (part === '.') {
					current = root;
				} else {
					if (!(part in current))
						throw new Error("Invalid path: " + path);
					current = current[part];
				}
			}

			return current;
		},

	};

	/**
	 * Converts the given object into an array.
	 * @param {undefined|any|any[]} o
	 * @returns {any[]}
	 */
	function toArray(o) {
		if (o === undefined)
			return [];
		else if (Object.prototype.toString.call(o) === '[object Array]')
			return o;
		else
			return [o];
	}

	/**
	 * A map from any path or alias path to the original path.
	 * @type {Object.<string, string>}
	 */
	var aliasMap = createAliasMap();

	/**
	 * Returns a map of all paths and alias paths to their respective original path.
	 * @returns {Object.<string, string>} the alias map.
	 */
	function createAliasMap() {
		var map = {};
		var fixedPaths = {};

		(function addAliases(root, path) {
			fixedPaths[path] = true;

			if (typeof root !== 'object')
				return;

			// overshadowing is not allowed
			if (path in map)
				throw new Error('The path "' + path + '" is overshadowed by an alias from "' + map[path] + '".');

			for (var prop in root) {
				if (root.hasOwnProperty(prop)) {
					var value = root[prop];

					if (prop === 'alias') {
						var base = paths.getBase(path);
						var aliases = toArray(value);

						// add all aliases to the map
						aliases.forEach(function (alias) {
							alias = paths.simplify(alias, base);

							// alias cannot be an existing path
							if (alias in fixedPaths)
								throw new Error('Alias "' + alias + '" of "' + path + '" cannot overwrite an existing path.');
							// same alias for different paths is not allowed
							if (alias in map && map[alias] !== path)
								throw new Error('"' + path + '" and "' + map[alias] + '" both have the same alias "' + alias + '".');

							map[alias] = path;
						});
					} else if (prop === '.') {
						throw new Error('Invalid property name "." in "' + path + '".');
					} else {
						// recursively search for aliases
						addAliases(value, path + prop + '/');
					}
				}
			}
		}(components, './'));

		return map;
	}

	/**
	 * Resolves the given path or alias path returning the proxied path or the given path.
	 * @param {string} path the path which may as well be an alias path. It does not have to be normalized.
	 * @returns {string} the path itself (normalized) or the proxied path of the given alias path.
	 *
	 * The returned path is guaranteed to be normalized.
	 */
	function resolveAlias(path) {
		if (!aliasMap)
			aliasMap = createAliasMap();

		var cleanPath = paths.normalize(path);

		var proxiedPath = aliasMap[cleanPath];
		if (proxiedPath)
			return proxiedPath;
		return cleanPath;
	}

	/**
	 * Returns all alias paths of the given path.
	 * @param {string} path the path for which all aliases are to be returned.
	 * @returns {string[]} the list of alias paths and the proxied path itself.
	 *
	 * All paths are guaranteed to be normalized.
	 * The last item is guaranteed to be the proxied path itself.
	 */
	function getAliases(path) {
		var resolvedPath = resolveAlias(path);

		var aliases = [];

		for (var alias in aliasMap)
			if (aliasMap[alias] === resolvedPath) {
				aliases.push(alias);
			}

		aliases.push(resolvedPath);

		return aliases;
	}


	/**
	 * A map of paths to their respective titles.
	 * @type {Object.<string, string>}
	 */
	var titleCache = null;

	/**
	 * Returns the title of the item behind a given path.
	 *
	 * If the given path is an alias and has an alias title, the alias' title is returned.
	 * @param {string} path the path of alias path. `path` will be normalized before being used.
	 * @returns {string} the title of the given path.
	 */
	function getTitle(path) {
		var cleanPath = paths.normalize(path);

		if (!titleCache)
			titleCache = {};
		if (cleanPath in titleCache)
			return titleCache[cleanPath];

		var title;

		var resolvedPath = resolveAlias(cleanPath);
		var resolvedItem = paths.getItem(resolvedPath);

		// it is assumed that every resolved item is either a string or has a title property (which has to be a string).

		if (typeof resolvedItem !== 'object') {
			title = resolvedItem;
		} else if (resolvedPath === cleanPath || !resolvedItem['aliasTitles']) {
			title = resolvedItem.title;
		} else {
			var aliasTitles = resolvedItem['aliasTitles'];
			var resolvedBase = paths.getBase(resolvedPath);

			for (var alias in aliasTitles) {
				if (aliasTitles.hasOwnProperty(alias)) {
					const aliasTitle = aliasTitles[alias];

					if (paths.simplify(alias, resolvedBase) === cleanPath) {
						title = aliasTitle;
						break;
					}
				}
			}
		}

		return titleCache[cleanPath] = title;
	}


	var flatDependencyCache = null;
	var recursiveDependencyCache = null;

	/**
	 * Returns the correct cache for the given cache key and recursiveness.
	 * @param {string} cacheKey
	 * @param {boolean} recursive
	 * @returns {Object.<string, Object.<string, true>>}
	 */
	function getDependencyCache(cacheKey, recursive) {
		if (!flatDependencyCache)
			flatDependencyCache = {};
		if (!recursiveDependencyCache)
			recursiveDependencyCache = {};

		var dependenciesCache = recursive ? recursiveDependencyCache : flatDependencyCache;

		var cache = dependenciesCache[cacheKey];
		if (!cache)
			dependenciesCache[cacheKey] = cache = {};
		return cache;
	}

	function prepareProperties(properties) {
		if (!properties)
			throw new TypeError('properties has to be defined.');
		if (properties.cacheKey) // already prepared
			return properties;

		// make properties an array and create a cache key from that
		// the cache key is used to get the correct dependency cache based of the properties regarded as dependencies
		var cacheKey;
		if (typeof properties === 'string') {
			properties = [cacheKey = properties];
		} else if (typeof properties === 'object') {
			if (!properties.length)
				throw new Error('properties has to have a length greater than 0.');
			cacheKey = properties.join(';');
		} else {
			throw new Error('properties has to be a string or string array.');
		}

		properties.cacheKey = cacheKey;
		return properties;
	}

	function cacheDependencies(itemPath, properties, recursive) {
		properties = prepareProperties(properties);

		// get cache
		var cache = getDependencyCache(properties.cacheKey, recursive);

		/**
		 * Checks for circular dependencies in the given stack regarding `dependency`.
		 * @param {string[]} stack the stack of dependencies (normalized).
		 * @param {string} dependency the dependency (normalized) for which circular references are to be checked.
		 * @throws {Error} if there is a circular dependency.
		 */
		function checkCircular(stack, dependency) {
			var index = stack.indexOf(dependency);
			if (index >= 0) {
				var circle = stack.slice(index);
				circle.push(dependency);
				throw new Error('Circular dependencies "' + circle.join('" -> "') + '" for the properties [' + properties.join(', ') + '].');
			}
		}

		/**
		 *
		 * @param {string} path `path` is required to be normalized.
		 * @param {string[]} stack the stack of already visited dependencies. All path are normalized.
		 * @returns {Object.<string, true>}
		 */
		function getDependenciesImpl(path, stack) {
			// path guaranteed to be normalized and not an alias
			if (path in cache)
				return cache[path];

			var item = paths.getItem(path);
			var dependencies = {};

			// we need to have an object
			if (typeof item === 'object') {
				if (!stack)
					stack = [];
				stack.push(path);

				var base = paths.getBase(path);

				properties.forEach(function (property) {
					toArray(item[property]).forEach(function (dependency) {
						var depPath = resolveAlias(paths.simplify(dependency, base));

						// check for circular dependencies and add
						checkCircular(stack, depPath);
						dependencies[depPath] = true;

						if (recursive) {
							var recursiveDependencies = getDependenciesImpl(depPath, stack);

							for (var recDepPath in recursiveDependencies) {
								// check for circular dependencies and add
								checkCircular(stack, recDepPath);
								dependencies[recDepPath] = true;
							}
						}
					});
				});

				stack.pop();
			}

			cache[path] = dependencies;
			return dependencies;
		}

		// resolve item path
		var resolvedPath = resolveAlias(itemPath);

		// cache dependencies
		var dependencies = getDependenciesImpl(resolvedPath);

		return { cache: cache, path: resolvedPath, dependencies: dependencies };
	}

	/**
	 * Returns an array of all dependencies of a given item.
	 *
	 * Dependencies are paths contained by at least one of the given properties.
	 * The paths can be given as an array or as a simple string.
	 * These paths do **not** have to be normalized and can be aliases.
	 * The base path of the parent item will be used to normalize each path.
	 * @param {string} itemPath the path of the item for which the list of dependencies is to be returned.
	 * `itemPath` is **not** required to be normalized and can be an alias.
	 * @param {string|string[]} properties
	 * @param {boolean} [recursive=true] whether dependencies are to be resolved recursively.
	 * @returns {string[]} a copy of the list of aliases of the item of `itemPath`.
	 * - All dependency paths are guaranteed to be normalized and **not** to be aliases.
	 * - The list is guaranteed to not contain any duplicates.
	 * - Dependencies can be in any order.
	 * @throws {Error} if circular dependencies were detected. (Only if `recursive` is `true`.)
	 */
	function getDependencies(itemPath, properties, recursive) {
		if (recursive === undefined)
			recursive = true;
		if (typeof recursive !== 'boolean')
			throw new Error('recursive has to be a boolean.');

		// copy the array because cacheDependencies is going to modify it
		if (typeof properties === 'object')
			properties = properties.slice(0);

		var cached = cacheDependencies(itemPath, properties, recursive);

		return Object.keys(cached.dependencies);
	}

	function hasDependency(itemPath, dependencyPath, properties, recursive) {
		if (recursive === undefined)
			recursive = true;
		if (typeof recursive !== 'boolean')
			throw new Error('recursive has to be a boolean.');

		// copy the array because cacheDependencies is going to modify it
		if (typeof properties === 'object')
			properties = properties.slice(0);

		var cached = cacheDependencies(itemPath, properties, recursive);

		var resolvedDepPath = resolveAlias(dependencyPath);

		return resolvedDepPath in cached.dependencies;
	}

	/**
	 *
	 * @param {string|string[]} properties
	 * @param {boolean} [recursive=true] whether dependencies are to be resolved recursively.
	 * @returns {(a: string, b: string) => number} A comparer comparing 2 paths by their dependency to each other.
	 * If a depends on b, then b will be regarded as less than a.
	 */
	function byDependencies(properties, recursive) {
		if (recursive === undefined)
			recursive = true;
		if (typeof recursive !== 'boolean')
			throw new Error('recursive has to be a boolean.');

		// because cacheDependencies tries to reuse the properties array, we will use that to create an array only once
		if (typeof properties === 'string')
			properties = [properties];

		// copy the array because cacheDependencies is going to modify it
		else if (typeof properties === 'object')
			properties = properties.slice(0);

		return function (a, b) {
			var cachedA = cacheDependencies(a, properties, recursive);
			var cachedB = cacheDependencies(b, properties, recursive);

			// a depends on b
			if (cachedB.path in cachedA.dependencies)
				return 1;
			// b depends on a
			if (cachedA.path in cachedB.dependencies)
				return -1;
			// independent
			return 0;
		};
	}



	Object.defineProperties(components, {
		'resolveAlias': {
			value: resolveAlias,
		},
		'getAliases': {
			value: getAliases,
		},
		'getTitle': {
			value: getTitle,
		},
		'getDependencies': {
			value: getDependencies,
		},
		'hasDependency': {
			value: hasDependency,
		},
		'byDependencies': {
			value: byDependencies,
		},
	});

}(components));

if (typeof module !== 'undefined' && module.exports) {
	module.exports = components;
}
