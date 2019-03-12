const components = require('../components.js');
const ComponentManager = require('../component-manager');

const manager = new ComponentManager(components);

const allLanguages = Object.keys(components.languages).filter(id => id !== 'meta');
const loaded = new Set(allLanguages.filter(id => components.languages[id].option === 'default'));


function removeComponent(id) {
	delete Prism.languages[id];
	delete Prism.plugins[id];
}

/**
 * Loads the given components synchronously.
 *
 * @param {ReadonlyArray<string>} arr
 */
function loadComponents(arr) {

	const { load } = manager.getLoad(arr, [...loaded]);
	// We remove any components before loading anyway, so we don't need to handle reloads explicitly.

	manager.loadSync(load, id => {
		// this supports both languages and plugins
		const path = '../' + ComponentManager.insertId(id, manager.getAttribute(id, 'path'));

		removeComponent(id);
		delete require.cache[require.resolve(path)];

		require(path);
		loaded.add(id);
	});
}

/**
 * Loads the given component(s) synchronously.
 *
 * If no components are given, Prism will load all languages.
 *
 * @param {string|ReadonlyArray<string>} [components] The ids of the components to load.
 */
module.exports = (components = allLanguages) => {
	if (typeof components === 'string') {
		components = [components];
	}

	loadComponents(components);
};
