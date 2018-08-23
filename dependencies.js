// TODO: Merge this file with `components.js`
// TODO: Documentation

(function (components) {

	// ./prop1/prop2/prop3/

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
	 * Removes leading and trailing slashes `/` from the given string.
	 * @param {string} string
	 * @returns {string}
	 */
	function trimSlash(string) {
		return (string || '').replace(/^\/|\/$/g, '') + '/';
	}

	/**
	 * @param {string} path
	 * @param {string} [base='']
	 * @param {Object} [root=components]
	 * @returns {any}
	 */
	function getItem(path, base, root) {
		if (!root)
			root = components;

		var simplePath = simplifyPath(path, base);
		if (simplePath)
			return root;

		var parts = trimSlash(simplePath).split('/');

		var current = root;
		for (var i = 0; i < parts.length; i++) {
			var part = parts[i];
			if (part === '.') {
				current = root;
			} else {
				if (!(part in current))
					throw new Error("Invalid path: " + simplePath);
				current = current[part];
			}
		}

		return current;
	}

	/**
	 * @param {string} path
	 * @returns {string}
	 */
	function getBase(path) {
		var cleanPath = trimSlash(path);
		if (cleanPath.indexOf('/') < 0)
			return '';

		var parts = cleanPath.split('/');
		parts.pop();
		return parts.join('/') + '/';
	}

	function getProperty(path) {
		return trimSlash(path).split('/').pop();
	}

	/**
	 * @param {string} path
	 * @param {string} [base='']
	 * @returns {string}
	 */
	function simplifyPath(path, base) {
		var cleanPath = trimSlash(path);
		if (base)
			cleanPath = trimSlash(trimSlash(base) + '/' + cleanPath);

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
	}


	var aliasCache = null;
	function createAliasMap() {
		var map = {};

		(function addAliases(root, path) {
			if (typeof root !== 'object')
				return;

			for (var prop in root) {
				if (root.hasOwnProperty(prop)) {
					var value = root[prop];

					if (prop === 'alias') {
						var base = getBase(path);
						var aliases = toArray(value);

						aliases.forEach(function (alias) {
							alias = simplifyPath(alias, base);
							map[alias] = path;
						});
					} else {
						addAliases(value, path + prop + '/');
					}
				}
			}
		}(components, './'));

		return map;
	}

	function resolveAlias(path) {
		if (!aliasCache)
			aliasCache = createAliasMap();

		var cleanPath = simplifyPath(path, './');
		if (cleanPath in aliasCache)
			return aliasCache[cleanPath];
		return cleanPath;
	}

	var titleCache = null;
	function getTitle(path) {
		var cleanPath = simplifyPath(path, './');

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
		itemPath = simplifyPath(itemPath, './');

		// try cache
		if (!dependencyCache)
			dependencyCache = {};
		if (!dependencyCache[cacheKey])
			dependencyCache[cacheKey] = {};
		else if (dependencyCache[cacheKey][itemPath])
			return Object.keys(dependencyCache[cacheKey][itemPath]);


		var dependencies = {};

		var base = getBase(itemPath);
		var item = getItem(itemPath);

		properties.forEach(function (property) {
			toArray(item[property]).forEach(function (dep) {
				dep = simplifyPath(dep, base);

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
		properties = properties || ['require'];
		if (typeof properties === 'string')
			properties = [properties];

		dependencyPath = simplifyPath(dependencyPath, './');
		var dependencies = {};

		var toAdd = [simplifyPath(itemPath, './')];

		while (toAdd.length) {
			var path = toAdd.pop();
			var base = getBase(path);
			var item = getItem(path);

			for (var p = 0; p < properties.length; p++) {
				var deps = toArray(item[properties[p]]);
				for (var i = 0; i < deps.length; i++) {
					var dep = simplifyPath(deps[i], base);

					if (!(dep in dependencies)) {
						dependencies[dep] = true;
						if (recursive)
							toAdd.push(dep);
					}
				}
			}
		}

		return Object.keys(dependencies);
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
