// @ts-check

"use strict";

var ComponentManager = (function () {

	/**
	 * @typedef ComponentBase
	 * @property {string} title
	 * @property {string} [owner]
	 * @property {string|string[]} [alias]
	 * @property {Object.<string, string>} [aliasTitles]
	 * @property {string|string[]} [require]
	 * @property {string|string[]} [peerDependencies]
	 * @property {string|string[]} [after]
	 * @property {boolean} [noCSS]
	 */
	/**
	 * @typedef {ComponentBase & Object.<string, any>} Component
	 */
	/**
	 * @typedef MetaBase
	 * @property {string} path
	 * @property {string} [link]
	 * @property {string} [examplePath]
	 * @property {boolean} [exclusive]
	 */
	/**
	 * @typedef {MetaBase & Object.<string, any>} Meta
	 */
	/**
	 * @typedef {Object.<string, Component>} FlatComponents
	 */
	/**
	 * @typedef {Object.<string, Component | string> & { meta: Meta }} ComponentsSection
	 */
	/**
	 * @typedef {Object.<string, ComponentsSection>} Components
	 */
	var jsDocTypes;

	/**
	 *
	 * @param {Components} components
	 */
	function ComponentManager(components) {
		this.components = components;
		this.flat = createFlatComponents(components);

		/** @private */
		this._sectionMap = createSectionMap(components);
		/** @private */
		this._aliasMap = createAliasMap(this.flat);
		/**
		 * @private
		 * @type {Object.<string, Object.<string, ReadonlyArray.<string>>>}
		 */
		this._directDependencyCache = {};
		/** @private */
		this._recursiveDependencyMap = createRecursiveDependencyMap(this);
	}


	/**
	 *
	 * @param {Components} components
	 * @returns {Object.<string, string>}
	 */
	function createSectionMap(components) {
		/** @type {Object.<string, string>} */
		var map = {};

		for (var sectionKey in components) {
			var section = components[sectionKey];
			for (var id in section) {
				if (id !== 'meta') {
					if (id in map) {
						throw new Error('Section "' + map[id] + '" and "' + sectionKey +
							'" cannot both contain the component "' + id + '".');
					}

					map[id] = sectionKey;
				}
			}
		}

		return map;
	}

	/**
	 *
	 * @param {Components} components
	 * @returns {FlatComponents}
	 */
	function createFlatComponents(components) {
		/** @type {FlatComponents} */
		var flat = {};

		['languages', 'plugins'].forEach(function (key) {
			var section = components[key];
			for (var id in section) {
				if (id !== 'meta') {
					var value = section[id];
					if (typeof value === 'string') {
						value = { title: value };
					}
					flat[id] = value;
				}
			}
		});

		return flat;
	}

	/**
	 *
	 * @param {FlatComponents} flatComponents
	 * @param {Object.<string, string>} [map]
	 */
	function createAliasMap(flatComponents, map) {
		if (!map) map = {};

		function addAlias(alias, id) {
			if (alias in flatComponents) {
				throw new Error('"' + id + '" cannot have the alias "' + alias + '" because there is an object with that id.');
			}
			if (alias in map) {
				throw new Error('"' + map[alias] + '" and "' + id + '" cannot have the same alias "' + alias + '".');
			}

			map[alias] = id;
		}

		for (var id in flatComponents) {
			var value = flatComponents[id];
			var alias = value.alias;
			if (alias) {
				if (typeof alias === 'string') {
					addAlias(alias, id);
				} else {
					alias.forEach(function (a) {
						addAlias(a, id);
					});
				}
			}
		}

		return map;
	}

	/**
	 *
	 * @param {ComponentManager} manager
	 * @returns {Object.<string, Object.<string, boolean>>}
	 */
	function createRecursiveDependencyMap(manager) {
		/** @type {Object.<string, Object.<string, boolean>>} */
		var map = {};

		/**
		 *
		 * @param {string} id
		 * @param {string[]} [stack]
		 * @returns {Object.<string, boolean>}
		 */
		function getRecursiveDependencies(id, stack) {
			if (!stack) {
				stack = [];
			}

			if (stack.indexOf(id) !== -1) {
				var path = stack.slice(stack.indexOf(id)).concat([id]).join(' -> ');
				throw new Error('There is a circular dependency.\n' + path);
			}

			if (id in map) {
				return map[id];
			}

			/** @type {Object.<string, boolean>} */
			var deps = {};
			[manager.getRequire(id), manager.getPeerDependencies(id), manager.getAfter(id)].forEach(function (idDependencies) {
				idDependencies.forEach(function (dependencyId) {
					deps[dependencyId] = true;
				})
			});

			// add recursive dependencies
			stack.push(id);
			Object.keys(deps).forEach(function (dependencyId) {
				Object.keys(getRecursiveDependencies(dependencyId, stack)).forEach(function (recursiveDependencyId) {
					deps[recursiveDependencyId] = true;
				});
			});
			stack.pop();

			return map[id] = deps;
		}

		Object.keys(manager.flat).forEach(function (id) {
			map[id] = getRecursiveDependencies(id);
		});

		return map;
	}

	/**
	 *
	 * @param {ComponentManager} manager
	 * @param {string} id
	 * @param {string} dependencyKey
	 * @returns {ReadonlyArray<string>}
	 */
	function getDirectDependencies(manager, id, dependencyKey) {
		id = manager.resolveAlias(id);

		var cache = manager._directDependencyCache[dependencyKey];
		if (!cache) {
			manager._directDependencyCache[dependencyKey] = cache = {};
		}

		var dependencies = cache[id];
		if (!dependencies) {
			/** @type {string|string[]|undefined} */
			var dep = manager.flat[id][dependencyKey];

			if (!dep) {
				dependencies = [];
			} else {
				if (typeof dep === 'string') {
					dep = [dep];
				}
				dependencies = dep.map(manager.resolveAlias.bind(manager)).filter(function (depId) {
					var known = depId in manager.flat;
					if (!known) {
						console.error(id + ': Unknown id "' + depId + '" in ' + dependencyKey + ' will be ignored.');
					}
					return known;
				});
			}

			cache[id] = dependencies;
		}

		return dependencies;
	}


	/**
	 * Replaces all id-placeholders in `str` with the given id.
	 *
	 * @param {string} id
	 * @param {string} str
	 * @returns {string}
	 */
	ComponentManager.insertId = function (id, str) {
		return str.replace(/\{id}/g, id);
	};

	/**
	 * Returns the id from which the given id is an alias for.
	 *
	 * If the given id is not an alias, `id` will be returned.
	 *
	 * @param {string} id
	 * @returns {string}
	 */
	ComponentManager.prototype.resolveAlias = function (id) {
		return this._aliasMap[id] || id;
	};

	/**
	 * Returns the section key of the given id. Aliases will be resolved.
	 *
	 * Use `this.components[this.getSection(id)].meta` to get the section's meta of an id.
	 *
	 * @param {string} id
	 * @returns {string}
	 */
	ComponentManager.prototype.getSection = function (id) {
		return this._sectionMap[this.resolveAlias(id)];
	};

	/**
	 * Returns the meta object of the given id.
	 *
	 * This is the meat object of the section of the given id.
	 *
	 * @param {string} id
	 * @returns {Meta}
	 */
	ComponentManager.prototype.getMeta = function (id) {
		return this.components[this.getSection(id)].meta;
	}

	/**
	 * Returns the title of the given id.
	 *
	 * If the given id is an alias and the alias has its own title, then this alias title will be returned.
	 *
	 * @param {string} id
	 * @returns {string}
	 */
	ComponentManager.prototype.getTitle = function (id) {
		var org = this.resolveAlias(id);
		var orgValue = this.flat[org];

		if (id !== org && orgValue.aliasTitles && orgValue.aliasTitles[id]) {
			return orgValue.aliasTitles[id];
		} else {
			return orgValue.title;
		}
	};

	/**
	 * Returns the direct required dependencies of the component with the given id.
	 *
	 * All aliases will be resolved (`id` and the returned list).
	 *
	 * @param {string} id
	 * @returns {ReadonlyArray<string>}
	 */
	ComponentManager.prototype.getRequire = function (id) {
		return getDirectDependencies(this, id, 'require');
	};
	/**
	 * Returns the direct peer dependencies of the component with the given id.
	 *
	 * All aliases will be resolved (`id` and the returned list).
	 *
	 * @param {string} id
	 * @returns {ReadonlyArray<string>}
	 */
	ComponentManager.prototype.getPeerDependencies = function (id) {
		return getDirectDependencies(this, id, 'peerDependencies');
	};
	/**
	 * Returns the direct optional dependencies of the component with the given id not including implicit ones.
	 *
	 * All aliases will be resolved (`id` and the returned list).
	 *
	 * @param {string} id
	 * @returns {ReadonlyArray<string>}
	 */
	ComponentManager.prototype.getAfter = function (id) {
		return getDirectDependencies(this, id, 'after');
	};

	/**
	 *
	 * @param {string} dependent
	 * @param {string} dependency
	 * @returns {boolean} whether `dependent` depends on `dependency`.
	 */
	ComponentManager.prototype.dependsOn = function (dependent, dependency) {
		return this._recursiveDependencyMap[this.resolveAlias(dependent)][this.resolveAlias(dependency)] === true;
	};

	/**
	 *
	 * @param {ComponentManager} manager
	 * @param {ReadonlyArray.<string>} ids
	 * @returns {string[]}
	 */
	function cleanIds(manager, ids) {
		var set = {};
		var res = [];

		ids.forEach(function (id) {
			id = manager.resolveAlias(id);
			if (!(id in set)) {
				res.push(id);
				set[id] = true;
			}
		});

		return res;
	}

	/**
	 *
	 * @param {ReadonlyArray.<string>} items
	 * @returns {Object.<string, boolean>}
	 */
	function toSet(items) {
		/** @type {Object.<string, boolean>} */
		var set = {};
		items.forEach(function (item) {
			set[item] = true;
		});
		return set;
	}

	/**
	 * Returns the components which have to be reloaded.
	 *
	 * The returned set has the following properties:
	 *
	 * 1. `relaod` ⊇ `toLoad` ∩ `loaded`
	 * 2. `reload` ⊆ `loaded`
	 *
	 * @param {ComponentManager} manager
	 * @param {ReadonlyArray.<string>} toLoad The components to load. May be in any order.
	 * @param {ReadonlyArray.<string>} loaded The components which are already loaded. May be in any order.
	 * @returns {string[]} The components to reload. May be in any order.
	 */
	function getReload(manager, toLoad, loaded) {
		if (loaded.length === 0) {
			return [];
		}

		var loadedSet = toSet(loaded);

		/** @type {Object.<string, boolean>} */
		var reloadSet = {};


		// A component x in toLoad has to be reloaded if it is already loaded

		toLoad.forEach(function (id) {
			if (id in loadedSet) {
				reloadSet[id] = true;
			}
		});


		// A component x in loaded has to be reloaded if
		//  1) a component to load or reload peer-depends on x.
		//  2) x depends on a component to load or reload.

		// the trick here is that we first check for toLoad which then satisfies all of the toLoad related conditions
		// and then we only the changes in reload bring new components according to the above conditions
		var toCheckForReload = toLoad;
		while (toCheckForReload.length > 0) {
			var reloadAdditions = {};

			toCheckForReload.forEach(function (id) {
				manager.getPeerDependencies(id).forEach(function (peer) {
					if (!(peer in reloadSet) && peer in loadedSet) {
						reloadAdditions[peer] = true;
						reloadSet[peer] = true;
					}
				});
			});
			loaded.forEach(function (id) {
				if (!(id in reloadSet) && toCheckForReload.some(function (checkId) { return manager.dependsOn(id, checkId); })) {
					reloadAdditions[id] = true;
					reloadSet[id] = true;
				}
			});

			toCheckForReload = Object.keys(reloadAdditions);
		}

		return Object.keys(reloadSet);
	}

	/**
	 * Given a list of components to load and components already loaded, this returns a list of components to be loaded
	 * and reloaded.
	 *
	 * The `load` list contains all components to load. This includes their require dependencies which are not loaded
	 * already and the components which have to be reloaded.
	 *
	 * The `reload` list is a subset of both `load` and `loaded` and contains only the components which have to be
	 * reloaded.
	 *
	 * Both `load` and `reload` do not contain aliases or duplicates and may be in any order.
	 *
	 * Components in `toLoad` which are also in `loaded` will be reloaded.
	 *
	 * `loaded` has to be require complete, meaning that if a component x is in `loaded` and x requires y,
	 * then y will be in `loaded`.
	 *
	 * The component id list `toLoad` and `loaded` may be in any order and may contain any number of duplicates and
	 * aliases.
	 *
	 * @param {string|string[]} toLoad the list of components to be loaded.
	 * @param {string[]} [loaded=[]] the list of already loaded components.
	 * @returns {{ load: string[], reload: string[] }}
	 */
	ComponentManager.prototype.getLoad = function (toLoad, loaded) {
		if (loaded === undefined) {
			loaded = [];
		}
		if (typeof toLoad === 'string') {
			toLoad = [toLoad];
		}

		var that = this;

		/**
		 * Set of loaded ids.
		 * @type {Object.<string, boolean>}
		 */
		var loadedSet = {};
		loaded.map(this.resolveAlias.bind(this)).forEach(function (id) {
			if (!(id in that.flat)) {
				console.error('loaded: Unknown id "' + id + '" will be ignored.');
			} else if (!(id in loadedSet)) {
				loadedSet[id] = true;
			}
		});
		loaded = Object.keys(loadedSet);

		/**
		 * Set of the component ids to load.
		 * @type {Object.<string, boolean>}
		 */
		var toLoadSet = {};
		toLoad = toLoad.map(this.resolveAlias.bind(this));
		while (toLoad.length > 0) {
			var id = toLoad.pop();
			if (!(id in that.flat)) {
				console.error('toLoad: Unknown id "' + id + '" will be ignored.');
			} else if (!(id in loadedSet || id in toLoadSet)) {
				toLoadSet[id] = true;

				// add require dependencies
				Array.prototype.push.apply(toLoad, this.getRequire(id));
			}
		}
		toLoad = Object.keys(toLoadSet);


		var reload = getReload(this, toLoad, loaded);

		return {
			load: Object.keys(toSet(reload.concat(toLoad))),
			reload: reload
		};
	};

	/**
	 * Creates the dependency graph of the given component ids.
	 *
	 * Note that only direct dependencies will be used.
	 *
	 * @param {ReadonlyArray.<string>} ids the list of ids. `ids` is NOT allowed to contain duplicates or aliases.
	 * @returns {Graph}
	 *
	 * @typedef {{id: string, dependencies: ReadonlyArray.<string>, dependents: ReadonlyArray.<string>}} GraphNode
	 * @typedef {{[id: string]: GraphNode}} Graph
	 */
	ComponentManager.prototype.createDependencyGraph = function (ids) {
		var manager = this;

		ids = cleanIds(this, ids);

		/** @type {Graph} */
		var graph = {};

		// fill graph
		ids.forEach(function (id) {
			graph[id] = {
				id: id,
				dependencies: [],
				dependents: []
			};
		});

		// connect graph
		ids.forEach(function (id) {
			/** @type {any} */
			var node = graph[id];

			/** @type {Object.<string, boolean>} */
			var processedDeps = {};

			[manager.getRequire(id), manager.getPeerDependencies(id), manager.getAfter(id)].forEach(function (deps) {
				deps.forEach(function (depId) {
					/** @type {any} */
					var depNode = graph[depId];
					if (depNode && !processedDeps[depId]) {
						processedDeps[depId] = true;

						node.dependencies.push(depId);
						depNode.dependents.push(id);
					}
				});
			});
		});

		return graph;
	};

	/**
	 *
	 * @param {Graph} graph
	 * @returns {string[]}
	 */
	function getLooseEnds(graph) {
		/** @type {string[]} */
		var looseEnds = [];
		Object.keys(graph).forEach(function (id) {
			if (graph[id].dependents.length === 0) {
				looseEnds.push(id);
			}
		});

		return looseEnds;
	}

	/**
	 *
	 * @param {Graph} graph
	 * @param {(id: string) => S} loadFn
	 * @param {(before: T, after: S) => T} [seriesFn]
	 * @param {(results: T[]) => T} [parallelFn]
	 * @returns {T}
	 * @template T
	 * @template S
	 */
	function load(graph, loadFn, seriesFn, parallelFn) {
		var looseEnds = getLooseEnds(graph);

		/** @type {Object.<string, T>} */
		var map = {};

		/**
		 *
		 * @param {ReadonlyArray.<string>} ids
		 * @returns {T}
		 */
		function loadIds(ids) {
			var results = ids.map(function (id) {
				var promise = map[id];
				if (!(id in map)) {
					var node = graph[id];

					var before = loadIds(node.dependencies);
					var after = loadFn(id);

					promise = seriesFn && seriesFn(before, after);

					map[id] = promise;
				}
				return promise;
			});

			return parallelFn && parallelFn(results);
		}

		return loadIds(looseEnds);
	}

	/**
	 * @param {Promise.<void>} before
	 * @param {Promise.<void> | void} after
	 * @returns {Promise.<void>}
	 */
	function series(before, after) {
		return before.then(function () { return after; });
	}
	/**
	 * @param {Promise.<void>[]} values
	 * @returns {Promise.<void>}
	 */
	function parallel(values) {
		return Promise.all(values).then(function () { });
	}
	/**
	 *
	 * @param {ReadonlyArray.<string>} idsToLoad
	 * @param {(id: string) => (void | Promise.<void>)} loadFn
	 * @returns {Promise.<void>}
	 */
	ComponentManager.prototype.loadAsync = function (idsToLoad, loadFn) {
		return load(this.createDependencyGraph(idsToLoad), loadFn, series, parallel);
	};
	/**
	 *
	 * @param {ReadonlyArray.<string>} idsToLoad
	 * @param {(id: string) => void} loadFn
	 * @returns {void}
	 */
	ComponentManager.prototype.loadSync = function (idsToLoad, loadFn) {
		load(this.createDependencyGraph(idsToLoad), loadFn);
	};

	/**
	 * Returns a reverse topological order of the given dependency graph.
	 *
	 * @param {Graph} graph
	 * @returns {string[]}
	 */
	ComponentManager.prototype.orderGraph = function (graph) {
		/** @type {Object.<string, number>} */
		var dependencyCount = {};

		// Kahn's algorithm

		/** @type {string[]} */
		var sorted = [];

		/** @type {GraphNode[]} */
		var roots = [];
		Object.keys(graph).forEach(function (id) {
			var node = graph[id];
			var count = node.dependencies.length;
			dependencyCount[id] = count;
			if (count === 0) {
				roots.push(node);
			}
		});

		while (roots.length > 0) {
			var root = roots.pop();
			sorted.push(root.id);

			root.dependents.forEach(function (dependentId) {
				if (--dependencyCount[dependentId] === 0) {
					roots.push(graph[dependentId]);
				}
			});
		}

		return sorted;
	};


	return ComponentManager;
})();

if (typeof module !== 'undefined' && module.exports) {
	module.exports = ComponentManager;
}
