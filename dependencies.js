// TODO: Merge this file with `components.js`
// TODO: Documentation

(function (components) {

	// ./prop1/prop2/prop3/

	var paths = {

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
		 * Simplifies the given path, adding the given base path and removing any unnecessary information.
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
		 * @param {string} path
		 * @param {string} [base='']
		 * @param {Object} [root=components]
		 * @returns {any}
		 */
		getItem: function getItem(path, base, root) {
			if (!root)
				root = components;

			var cleanPath = paths.simplify(path, base);
			if (cleanPath)
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
		}

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


	var aliasMap = null;
	function createAliasMap() {
		var map = {};

		(function addAliases(root, path) {
			if (typeof root !== 'object')
				return;

			// each path is its own alias
			if (path in map)
				throw new Error('The path "' + path + '" is overshadowed by an alias from "' + map[path] + '".');
			map[path] = path;

			for (var prop in root) {
				if (root.hasOwnProperty(prop)) {
					var value = root[prop];

					if (prop === 'alias') {
						var base = paths.getBase(path);
						var aliases = toArray(value);

						// add all aliases to the map
						aliases.forEach(function (alias) {
							alias = paths.simplify(alias, base);

							if (alias in map)
								throw new Error('Cannot create alias map because "' + path + '" and "' + map[alias] + '" have the same alias "' + alias + '".');

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

	function resolveAlias(path) {
		if (!aliasMap)
			aliasMap = createAliasMap();

		var cleanPath = paths.simplify(path, './');

		if (!(cleanPath in aliasMap))
			throw new Error('The given path "' + path + '" is not present in the alias map.');

		return aliasMap[cleanPath];
	}

	/**
	 * Returns all aliases of a given item.
	 *
	 * @param {string} path the path for which all aliases are to be returned.
	 * @param {boolean} [includeSelf=false] whether the path itself will be included in the list of aliases.
	 * @returns {string[]} the list of aliases.
	 */
	function getAliases(path, includeSelf) {
		var cleanPath = resolveAlias(path);

		// TODO: O(n)? rly?
		var aliases = [];

		for (var alias in aliasMap)
			if (aliasMap[alias] === cleanPath) {
				if (!includeSelf && alias === cleanPath)
					continue;
				aliases.push(alias);
			}

		return aliases;
	}

	var titleCache = null;
	function getTitle(path) {
		var cleanPath = paths.simplify(path, './');

		if (!titleCache)
			titleCache = {};
		if (cleanPath in titleCache)
			return titleCache[cleanPath];

		var title;

		// TODO: add implementation

		var resolvedPath = resolveAlias(cleanPath);

		if (cleanPath === resolvedPath) {
			// TODO:
		}

		return titleCache[cleanPath] = title;
	}


	var dependencyCache = null;

	/**
	 * @param {string} itemPath
	 * @param {string|string[]} [properties='require']
	 * @param {boolean} [recursive=true]
	 * @returns {string[]}
	 */
	function getDependencies(itemPath, properties, recursive) {
		if (recursive === undefined)
			recursive = true;

		// make properties and array and create cache key
		var cacheKey;
		if (properties) {
			if (typeof properties === 'string') {
				cacheKey = properties;
				properties = [properties];
			} else {
				cacheKey = properties.join(';');
			}
		} else {
			properties = [cacheKey = 'require'];
		}

		// simplify path
		itemPath = paths.simplify(itemPath, './');

		// try cache
		if (!dependencyCache)
			dependencyCache = {};
		if (!dependencyCache[cacheKey])
			dependencyCache[cacheKey] = {};
		else if (dependencyCache[cacheKey][itemPath])
			return Object.keys(dependencyCache[cacheKey][itemPath]);


		var dependencies = {};

		var base = paths.getBase(itemPath);
		var item = paths.getItem(itemPath);

		properties.forEach(function (property) {
			toArray(item[property]).forEach(function (dep) {
				dep = paths.simplify(dep, base);

				if (!(dep in dependencies)) {
					dependencies[dep] = true;
					if (recursive) {
						getDependencies(dep, properties, true).forEach(function (recursiveDep) {
							dependencies[recursiveDep] = true;
						});
					}
				}
			});
		});

		dependencyCache[cacheKey][itemPath] = dependencies;

		return Object.keys(dependencies);
	}

	function hasDependency(itemPath, dependencyPath, properties) {
		// TODO:
	}

	/**
	 * Sorts the given list of item path by thier relationship described in `require`, `peerDependencies` and `after`.
	 *
	 * The sorting algorithm is guaranteed to be stable.
	 * @param {string[]} itemPaths
	 * @param {string} [base='']
	 * @param {string[]}
	 */
	function sortItems(itemPaths, base) {
		// TODO: add implementation
	}

}(components));



if (typeof module !== 'undefined' && module.exports) {
	module.exports = components;
}
