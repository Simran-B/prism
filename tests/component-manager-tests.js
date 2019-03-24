"use-strict";

const { assert } = require('chai');
const ComponentManager = require('./../component-manager');


describe('Circular dependency tests', function () {

	it('should throw on self dependencies', function () {
		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					require: 'a'
				}
			}
		}));
	});

	it('should throw on circular require dependencies', function () {
		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					require: 'b',
				},
				b: {
					title: 'B',
					require: 'c',
				},
				c: {
					title: 'C',
					require: 'a',
				},
			}
		}));
	});

	it('should throw on any kind of circular dependencies', function () {
		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					require: 'b',
				},
				b: {
					title: 'B',
					after: 'c',
				},
				c: {
					title: 'C',
					peerDependencies: 'a',
				},
			}
		}));
	});

});

describe('Alias tests', function () {

	it('should throw on duplicate aliases', function () {
		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					alias: 'b'
				},
				b: {
					title: 'B'
				}
			}
		}));

		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					alias: 'c'
				},
				b: {
					title: 'B',
					alias: 'c'
				}
			}
		}));

		assert.throws(() => new ComponentManager({
			languages: {
				a: {
					title: 'A',
					alias: 'c'
				}
			},
			something: {
				c: 'C'
			}
		}));
	});

	const manager = new ComponentManager({
		languages: {
			a: {
				title: 'A',
				alias: 'aa'
			}
		}
	});

	it('should resolve aliases', function () {
		assert.strictEqual(manager.resolveAlias('a'), 'a');
		assert.strictEqual(manager.resolveAlias('aa'), 'a');
	});

	it('should just return unknown ids', function () {
		assert.strictEqual(manager.resolveAlias('unknown'), 'unknown');
	});

});

describe('Title tests', function () {

	const manager = new ComponentManager({
		languages: {
			a: {
				title: 'A',
				alias: ['aa', 'ab'],
				aliasTitles: {
					ab: 'AB'
				}
			},
			b: 'B'
		}
	});

	it('should work with "title"', function () {
		assert.strictEqual(manager.getTitle('a'), 'A');
	});

	it('should work with string values', function () {
		assert.strictEqual(manager.getTitle('b'), 'B');
	});

	it('should work with aliases', function () {
		assert.strictEqual(manager.getTitle('aa'), 'A');
	});

	it('should work with alias titles', function () {
		assert.strictEqual(manager.getTitle('ab'), 'AB');
	});

});

describe('Load tests', function () {

	const manager = new ComponentManager({
		languages: {
			a: 'A',
			b: {
				title: 'B',
				after: 'a',
				alias: 'afterA'
			},
			c: {
				title: 'C',
				require: ['a', 'd']
			},
			d: {
				title: 'D',
				require: 'a'
			},
			e: {
				title: 'E',
				require: 'd'
			},
			f: {
				title: 'F',
				peerDependencies: 'a',
				alias: 'peerA'
			}
		}
	});

	function getLoadTest({ toLoad, loaded = [], options = {} }, { load, reload = [] }) {
		return function () {
			const result = manager.getLoad(toLoad, loaded, options);

			assert.deepStrictEqual(result.load.sort(), load.sort());
			assert.deepStrictEqual(result.reload.sort(), reload.sort());
		};
	}

	it('should ignore duplicates and resolve aliases', getLoadTest(
		{ toLoad: ['peerA', 'f', 'f'], loaded: ['a', 'afterA', 'b'] },
		{ load: ['f', 'a', 'b'], reload: ['a', 'b'] }
	));

	it('should ignore unknown components', getLoadTest(
		{ toLoad: ['typo', 'c'], loaded: ['a', 'something', 'unknown'] },
		{ load: ['c', 'd'] }
	));

	describe('Standard getLoad', function () {

		it('should include requirements', getLoadTest(
			{ toLoad: ['e'] },
			{ load: ['e', 'd', 'a'] }
		));

		it('should avoid loading components again', getLoadTest(
			{ toLoad: ['e', 'd'], loaded: ['d', 'a'] },
			{ load: ['e'] }
		));

		it('should reload peer dependents', getLoadTest(
			{ toLoad: ['f'], loaded: ['a'] },
			{ load: ['f', 'a'], reload: ['a'] }
		));

		it('should reload peer dependents and all components that dependent on them', getLoadTest(
			{ toLoad: ['f'], loaded: ['a', 'b', 'd'] },
			{ load: ['f', 'a', 'b', 'd'], reload: ['a', 'b', 'd'] }
		));

	});

	describe('Forced getLoad', function () {

		const options = {
			forceLoad: true
		};

		it('should include requirements', getLoadTest(
			{ toLoad: ['e'], options },
			{ load: ['e', 'd', 'a'] }
		));

		it('should load already loaded components if some components in toLoad depend on them', getLoadTest(
			{ toLoad: ['e', 'd'], loaded: ['d', 'a'], options },
			{ load: ['e', 'd', 'a'], reload: ['d', 'a'] }
		));

		// TODO: expand tests

	});

});
