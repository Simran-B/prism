const components = require('../components.js');
const ComponentManager = require('../component-manager');

const manager = new ComponentManager(components);


function getLoadedComponents() {
	// filter to ignore functions like `extend`
	return Object.keys(Prism.languages).filter(id => id in manager.flat);
}

function removeComponents(id) {
	delete Prism.languages[id];
	delete Prism.plugins[id];
}

function loadComponents(arr) {
	if (typeof arr === 'string') {
		arr = [arr];
	}

	if (!arr) {
		console.error('Loading all languages by supplying no argument is deprecated.');
		arr = Object.keys(components.languages).filter(id => id !== 'meta');
	}

	const { load } = manager.getLoad(arr, getLoadedComponents());

	manager.loadSync(load, id => {
		// this supports both languages and plugins
		const metaPath = ComponentManager.insertId(id, manager.getMeta(id).path);
		const path = '../' + metaPath;

		removeComponents(id);
		delete require.cache[require.resolve(path)];

		require(path);
	});
}

module.exports = function (arr) {
	// Don't expose withoutDependencies
	loadLanguages(arr);
};