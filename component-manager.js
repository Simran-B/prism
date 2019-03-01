// @ts-check

"use strict";

(function () {

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
	 *
	 * @typedef {ComponentBase & Object.<string, any>} Component
	 *
	 * @typedef MetaBase
	 * @property {string} path
	 * @property {string} [link]
	 * @property {string} [examplePath]
	 * @property {boolean} [exclusive]
	 *
	 * @typedef {MetaBase & Object.<string, any>} Meta
	 *
	 * @typedef {Object.<string, Component>} FlatComponents
	 *
	 * @typedef {Object.<string, Component | string> & { meta: Meta }} ComponentsSection
	 *
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
		this.__sectionMap = createSectionMap(components);
		/** @private */
		this.__aliasMap = createAliasMap(this.flat);
		/**
		 * @private
		 * @type {Object.<string, Object.<string, ReadonlyArray.<string>>>}
		 */
		this.__dependencyMap = {};
		/** @private */
		this.__recursiveDependencyMap = createRecursiveDependencyMap(this);
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
	function getDependencies(manager, id, dependencyKey) {
		id = manager.resolveAlias(id);

		var map = manager.__dependencyMap[dependencyKey];
		if (!map) {
			manager.__dependencyMap[dependencyKey] = map = {};
		}

		var dependencies = map[id];
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

			map[id] = dependencies;
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
		return this.__aliasMap[id] || id;
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
		return this.__sectionMap[this.resolveAlias(id)];
	};

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
		return getDependencies(this, id, 'require');
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
		return getDependencies(this, id, 'peerDependencies');
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
		return getDependencies(this, id, 'after');
	};

	/**
	 *
	 * @param {string} dependent
	 * @param {string} dependency
	 * @returns {boolean} whether `dependent` depends on `dependency`.
	 */
	ComponentManager.prototype.dependsOn = function (dependent, dependency) {
		return this.__recursiveDependencyMap[this.resolveAlias(dependent)][this.resolveAlias(dependency)] === true;
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
	};

	/**
	 * Given a list of components to load and components already loaded, this returns a list of components to be loaded.
	 * The returned list contains all require dependencies without any duplicates or aliases and
	 * is in the order in which the components have to be loaded. It might contain components of `loaded`
	 * in which case these components have to be reloaded and will be in the `reload` list.
	 *
	 * Components in `toLoad` which are also in `loaded` do not have to be loaded again, but they might have to be
	 * reloaded.
	 *
	 * `loaded` has to be require complete, meaning that if a component x is in `loaded` and x requires y,
	 * then y will be in `loaded`.
	 *
	 * The component id list `toLoad` and `loaded` may be in any order and may contain any number of duplicates and
	 * aliases.
	 *
	 * @param {string|string[]} toLoad the list of components to be loaded.
	 * @param {string[]} [loaded=[]] the list of already loaded components.
	 * @returns {string[] & { reload: string[] }}
	 */
	ComponentManager.prototype.getLoadAndReload = function (toLoad, loaded) {
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

		var that = this;


		// A component x in loaded has to be reloaded if
		//  1) a component to load or reload peer-depends on x.
		//  2) x depends on a component to load or reload.

		/** @type {Object.<string, boolean>} */
		var reloadSet = {};

		if (loaded.length > 0) {
			// the trick here is that we first check for toLoad which then satisfies all of the toLoad related conditions
			// and then we only the changes in reload bring new components according to the above conditions
			var toCheckForReload = toLoad;
			while (toCheckForReload.length > 0) {
				var reloadAdditions = {};

				toCheckForReload.forEach(function (id) {
					that.getPeerDependencies(id).forEach(function (peer) {
						if (!(peer in reloadSet) && peer in loadedSet) {
							reloadAdditions[peer] = true;
							reloadSet[peer] = true;
						}
					});
				});
				loaded.forEach(function (id) {
					if (!(id in reloadSet) && toCheckForReload.some(function (checkId) { return that.dependsOn(id, checkId); })) {
						reloadAdditions[id] = true;
						reloadSet[id] = true;
					}
				});

				toCheckForReload = Object.keys(reloadAdditions);
			}
		}

		var reload = Object.keys(reloadSet);


		/** @type {any} */
		var result = sortComponents(this, reload.concat(toLoad));
		result.reload = reload;
		return result;
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

		/** @type {Object.<string, boolean>} */
		var set = {};
		ids.map(this.resolveAlias.bind(this)).forEach(function (id) { set[id] = true; });
		ids = Object.keys(set);

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
	 * @param {ReadonlyArray.<string>} idsToLoad
	 * @param {(id: string) => (void | Promise.<void>)} loadFn
	 * @returns {Promise.<void>}
	 */
	ComponentManager.prototype.load = function (idsToLoad, loadFn) {
		var graph = this.createDependencyGraph(idsToLoad);
		var looseEnds = getLooseEnds(graph);

		/** @type {Object.<string, Promise.<void>>} */
		var promiseMap = {};

		/**
		 *
		 * @param {ReadonlyArray.<string>} ids
		 * @returns {Promise}
		 */
		function loadIds(ids) {
			/** @type {Promise.<void>[]} */
			var promises = [];

			ids.forEach(function (id) {
				var promise = promiseMap[id];
				if (!promise) {
					var node = graph[id];

					promise = loadIds(node.dependencies).then(function () {
						return loadFn(id);
					});

					promiseMap[id] = promise;
				}
				promises.push(promise);
			});

			return Promise.all(promises);
		}

		return loadIds(looseEnds);
	};

	/**
	 *
	 * @param {ReadonlyArray.<string>} idsToLoad
	 * @param {(id: string) => void} loadFn
	 * @returns {void}
	 */
	ComponentManager.prototype.loadSync = function (idsToLoad, loadFn) {
		var graph = this.createDependencyGraph(idsToLoad);
		var looseEnds = getLooseEnds(graph);

		/** @type {Object.<string, boolean>} */
		var processed = {};

		/**
		 *
		 * @param {ReadonlyArray.<string>} ids
		 */
		function loadIds(ids) {
			ids.forEach(function (id) {
				if (!(id in processed)) {
					loadIds(graph[id].dependencies);
					loadFn(id);
					processed[id] = true;
				}
			});
		}

		loadIds(looseEnds);
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



	if (typeof window !== 'undefined') {
		window['ComponentManager'] = ComponentManager;
	}

	if (typeof module !== 'undefined' && module.exports) {
		module.exports = ComponentManager;
	}

})();