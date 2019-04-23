# Contributing to Prism



## Creating a new language definition

Language definitions are the heavy workers of Prism! <br>
They use regular expressions to tokenize a given text, creating a token stream which plugins modify and themes highlight.

But a language definition is more than just a few regular expression. They also included aliases, dependencies, and meta information about the language like its author.

To create a new language definition, fork the [PrismJS/prism](https://github.com/PrismJS/prism) repository and checkout your fork. After installing Prism's npm dependencies, we can start.

Add a new `prism-my-language.js` file to the `components/` folder. This file will contain the language definition.

`my-language` is the id of your language. The id is usually the lowercase name of the language where words are separated using a dash (`-`). <br>
_Note: Ids have to be unique and match the regular expression `/^[a-z][a-z\d]*(?:-[a-z][a-z\d]*)*$/`._


### Writing a language definition



#### Adding aliases

You can add aliases to your language. Aliases can be used to add support for common abbreviations of a language name and file extension (e.g. `py` for Python). <br>
Example:

```js
Prism.languages['my-alias'] = Prism.languages['my-languages'];
```

_Note: Be sure sure that the alias exports the same object as the language id. Aliases generally follow the same naming conventions as ids and like ids, they also have to unique._

_Note: Don't forget to specify all aliases in `components.json`._


### Registering a new language

All languages, plugins and themes are registered in `components.json`.

To register the new language, add a new entry to `"languages"` like this:

```json
"my-language": {
    "title": "My new language",
    "owner": "Your GitHub user name"
}
```

_Note: The languages list is sorted alphabetically by title, so be sure to add the entry at the correct position. Prism has a few default languages, which are at the top of the list and not sorted. Insert your entry after those._

If your language needs other languages to function correctly, you have to specify these dependencies as well. There are two kinds of dependencies Prism supports:

1. `"require"` <br>
    Requirements are languages which have to be present. Prism will ensure that the languages specified in `"require"` are loaded before this language.
2. `"peerDependencies"` <br>
    Peer dependencies are optional dependencies. Prism will ensure that if this languages specified here are present, they will be loaded before this language.

_Note: Be careful to not define circular dependencies._

Both `"require"` and `"peerDependencies"` take one or multiple language ids. Example:

```json
"require": "css",
"peerDependencies": ["javascript", "markup"]
```

If your language has one or multiple aliases, you have to define a `"alias"` property. Example:

```json
"alias": "my-alias",
 or
"alias": ["my-alias", "my-other-alias"]
```

If you want to give a specific alias a different title, use the `"aliasTitles"` property. This can be useful if your language definition can be used to highlight different programming languages. Example:

```js
"aliasTitles": {
    "my-alias": "A different title for this alias"
}
```


### Making a pull request

Before you make a pull request to [PrismJS/prism](https://github.com/PrismJS/prism), make sure you did everything on the following check list:

1. Run [`gulp`](https://github.com/gulpjs/gulp) to create all minified and generated files.
2. Add an example page to the `examples/` folder.
3. Write some [tests](https://prismjs.com/test-suite.html) covering the main feature of the new language.
4. Make sure that all tests pass.

That's it! We will be looking forward to your language definition!



## Creating a new plugin



## Creating a new theme

Themes are simple CSS files which define the style of every token and the code blocks.


### Tokens

To change the style of a token, add a CSS rule with the name of the token like so:

```css
.token.my-token-name {
    /* styles */
}
```

You can add language specific token styles for language `xxxx` like this:

```css
.language-xxxx .token.my-token-name {
    /* language specific styles */
}
```


### Examples

All of Prism's [themes](https://github.com/PrismJS/prism/blob/master/themes/) are good examples on how to make a good theme.

For more examples, checkout the other [Prism themes](https://github.com/PrismJS/prism-themes).


### Making a pull request

Don't make a pull request for your new themes to [PrismJS/prism](https://github.com/PrismJS/prism) directly. We have a dedicated repository for themes: [PrismJS/prism-themes](https://github.com/PrismJS/prism-themes).

Add a new file to the `themes/` folder with the name `prism-your-theme-name.css` and add your themes to the list of available themes in `README.md` together with a screenshot.

The screenshot should show the following Javascript code:

```js
function foo(bar) {
    var a = 42,
        b = 'Prism';
    return a + bar(b);
}
```

That's it! We will be looking forward to your themes!
