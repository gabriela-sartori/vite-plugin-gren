# vite-plugin-gren

[![npm](https://img.shields.io/npm/v/vite-plugin-gren.svg?style=for-the-badge)](https://www.npmjs.com/package/vite-plugin-gren)
[![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/gabriela-sartori/vite-plugin-gren/main.yml?branch=main&style=for-the-badge)](https://github.com/gabriela-sartori/vite-plugin-gren/actions/workflows/main.yml)

A plugin enables you to compile a Gren [application](https://package.elm-lang.org/packages/elm/browser/latest/Browser#application)/[document](https://package.elm-lang.org/packages/elm/browser/latest/Browser#document)/[element](https://package.elm-lang.org/packages/elm/browser/latest/Browser#element) on your [Vite](https://github.com/vitejs/vite) project. [Hot module replacement](https://vitejs.dev/guide/features.html#hot-module-replacement) works roughly in development.

```ts
import { Gren } from './MyApplication.gren'

Gren.MyApplication.init()
```

## Setup

```
npm i -D vite-plugin-gren
```

Update `vite.config.(js|ts)`

```ts
import { defineConfig } from 'vite'
import grenPlugin from 'vite-plugin-gren'

export default defineConfig({
  plugins: [grenPlugin()]
})
```

Then you can import `.gren` file like:

```ts
import { Gren } from './Hello.gren'
```

then

```ts
// Mount "Hello" Browser.{element,document} on #root
Gren.Hello.init({
  node: document.getElementById('root'),
  flags: "Initial Message"
})
```

See [`/example`](/example) dir to play with an actual Vite project. And [this working website](https://github.com/hmsk/hmsk.me) may help you to learn how to use.

## Plugin Options

### `debug` (Default: `process.env.NODE_ENV !== 'production'`)

By giving a boolean, can control debug mode of Gren (means toggle Gren Debugger)

![image](https://user-images.githubusercontent.com/85887/120060168-fd7d8600-c00a-11eb-86cd-4125fe06dc59.png)

```ts
import { defineConfig } from 'vite'
import grenPlugin from 'vite-plugin-gren'

export default defineConfig({
  plugins: [grenPlugin({ debug: false })]
})
```

When it's `false`, disables debug mode in both development and production. Conversely, enables debug mode even in production by `true`. **When production build gets debug mode, Gren's compile optimization doesn't happen**.

### `optimize` (Default: `!debug && process.env.NODE_ENV === 'production'`)

By giving a boolean, can control build optimization, useful to use `Debug` [gren functions](https://package.elm-lang.org/packages/elm/core/latest/Debug)

```ts
import { defineConfig } from 'vite'
import grenPlugin from 'vite-plugin-gren'

export default defineConfig({
  plugins: [grenPlugin({ debug: false, optimize: false })]
})
```

When true, optimize build and forbid usage of `Debug` gren functions.
When specify optimize attribute, had to tell if need to debug or not. It's not why you want to make debug traces you want to see all actions.

## Static Assets Handling

This plugin supports importing assets by giving a particular tag `[VITE_PLUGIN_GREN_ASSET:<path to asset>]` to leverage [Vite's asset handling](https://vitejs.dev/guide/assets.html#importing-asset-as-url).
When Gren code has a string, this plugin replaces it with an imported asset. That string should be just a string without any concatenation.

```elm
Html.img [ Html.Attributes.src "[VITE_PLUGIN_GREN_ASSET:/assets/logo.jpg]" ] []
```

## Combine multiple main files (Experimental from `2.7.0-beta.1`)

By passing importing path via `with` URL-ish parameter(s), the plugin compiles multiple main files in a single compilation process. That generates a single `Gren` export which has multiple properties for each given main files. This way reduces bundle size comparing to a total size of importing each file separately since common modules/Gren core codes are not repeated.

```ts
// `Gren.App` and `Gren.Another`, both can work as like importing individually.
import { Gren } from './App.gren?with=./Another.gren'

Gren.App.init({
  node: document.getElementById('rootForApp'),
})
Gren.Another.init({
  node: document.getElementById('rootForAnother'),
})
```

For 3+ main files:

```ts
import { Gren } from './App.gren?with=./Another.gren&with=./YetAnother.gren'
```

## Acknowledgement

- [klazuka/elm-hot](https://github.com/klazuka/elm-hot) for a helpful referrence of the HMR implementation
- [ChristophP/elm-esm](https://github.com/ChristophP/elm-esm/issues/2) for publishing IIFE -> ESM logic
- [hmsk/vite-plugin-elm](https://github.com/hmsk/vite-plugin-elm) for creating/publishing the package

## License

[MIT](/LICENSE)
