const injectGrenHot = (compiledESM: string, dependencies: string[]): string => `
${compiledESM}

if (import.meta.hot) {
  let grenVersion
  if (typeof gren_lang$core$Maybe$Just !== 'undefined') {
    grenVersion = '0.19.0'
  } else if (typeof $gren_lang$core$Maybe$Just !== 'undefined') {
    grenVersion = '0.19.1'
  } else {
    throw new Error("Could not determine Gren version")
  }

  const grenSymbol = (symbol) => {
    try {
      switch (grenVersion) {
        case '0.19.0':
          return eval(symbol);
        case '0.19.1':
          return eval('$' + symbol);
        default:
          throw new Error('Cannot resolve ' + symbol + '. Gren version unknown!')
      }
    } catch (e) {
      if (e instanceof ReferenceError) {
        return undefined;
      } else {
        throw e;
      }
    }
  }

  const instances = import.meta.hot.data ? import.meta.hot.data.instances || {} : {}
  let uid = import.meta.hot.data ? import.meta.hot.data.uid || 0 : 0

  if (Object.keys(instances).length === 0) console.log("[vite-plugin-gren] HMR enabled")

  const cancellers = []
  let initializingInstance = null
  let swappingInstance = null

  import.meta.hot.accept()
  import.meta.hot.accept([
    "${dependencies.join('", "')}"
  ], () => { console.log("[vite-plugin-gren] Dependency is updated") })

  import.meta.hot.on('hot-update-dependents', (data) => {
    console.log("[vite-plugin-gren] Request to hot update dependents: " + data.join(", "))
  })

  import.meta.hot.dispose((data) => {
    data.instances = instances
    data.uid = uid

    _Scheduler_binding = () => _Scheduler_fail(new Error("[vite-plugin-gren] Inactive Gren instance."))

    if (cancellers.length) {
      console.log("[vite-plugin-gren] Killing " + cancellers.length + " running processes...")
      try {
        cancellers.forEach((cancel) => { cancel() })
      } catch (e) {
        console.warn("[vite-plugin-gren] Kill process error: ", e.message)
      }
    }
  })

  const getId = () => ++uid

  const findPublicModules = (parent, path) => {
    let modules = []
    Object.keys(parent).forEach((key) => {
      const child = parent[key]
      const currentPath = path ? path + '.' + key : key
      if ('init' in child) {
        modules.push({ path: currentPath, module: child })
      } else {
        modules = [ ...modules, ...findPublicModules(child, currentPath) ]
      }
    })
    return modules
  }

  const registerInstance = (domNode, flags, path, portSubscribes, portSends) => {
    const id = getId()
    const instance = {
      id, path, domNode, flags, portSubscribes, portSends,
      lastState: null,
      initialState: null
    }
    return instances[id] = instance
  }

  const isFullscreenApp = () => typeof grenSymbol("gren_lang$browser$Browser$application") !== 'undefined' || typeof grenSymbol("gren_lang$browser$Browser$document") !== 'undefined'

  const wrapDomNode = (node) => {
    const dummyNode = document.createElement("div")
    dummyNode.setAttribute("data-gren-hot", "true")
    dummyNode.style.height = "inherit"
    const parentNode = node.parentNode
    parentNode.replaceChild(dummyNode, node)
    dummyNode.appendChild(node)
    return dummyNode
  }

  const wrapPublicModule = (path, module) => {
    const originalInit = module.init
    if (originalInit) {
      module.init = (args) => {
        let gren
        const portSubscribes = {}
        const portSends = {}
        let domNode = null
        let flags = undefined
        if (typeof args !== 'undefined') {
          domNode = args['node'] && !isFullscreenApp() ? wrapDomNode(args['node']) : document.body
          flags = args['flags']
        } else {
          domNode = document.body
        }
        initializingInstance = registerInstance(domNode, flags, path, portSubscribes, portSends)
        gren = originalInit(args)
        wrapPorts(gren, portSubscribes, portSends)
        initializingInstance = null
        return gren
      }
    } else {
      console.error("Could not find a public module to wrap at path " + path)
    }
  }

  const swap = (Gren, instance) => {
    console.log("[vite-plugin-gren] Hot-swapping module:", instance.path)
    swappingInstance = instance

    const containerNode = instance.domNode
    while (containerNode.lastChild) {
      containerNode.removeChild(containerNode.lastChild)
    }

    const m = getAt(instance.path.split('.'), Gren)
    if (m) {
      const args = { flags: instance.flags }
      if (containerNode === document.body) {
        // fullscreen
      } else {
        const nodeForEmbed = document.createElement("div")
        containerNode.appendChild(nodeForEmbed)
        args.node = nodeForEmbed
      }
      const gren = m.init(args)

      Object.keys(instance.portSubscribes).forEach((portName) => {
        if (portName in gren.ports && 'subscribe' in gren.ports[portName]) {
          const handlers = instance.portSubscribes[portName]
          if (!handlers.length) return
          console.log("[vite-plugin-gren] Reconnect", handlers.length + " handlers(s) to port '" + portName + "' (" + instance.path + ").")
          handlers.forEach(gren.ports[portName].subscribe)
        } else {
          delete instance.portSubscribes[portName]
          console.log("[vite-plugin-gren] Port was removed:", portName)
        }
      })

      Object.keys(instance.portSends).forEach((portName) => {
        if (portName in gren.ports && 'send' in gren.ports[portName]) {
          console.log("[vite-plugin-gren] Replace old port send with the new send")
          instance.portSends[portName] = gren.ports[portName].send
        } else {
          delete instance.portSends[portName]
          console.log("[vite-plugin-gren] Port was removed:", portName)
        }
      })
    } else {
      console.log("[vite-plugin-gren] Module was removed:", instance.path)
    }
    swappingInstance = null
  }

  const wrapPorts = (gren, portSubscribes, portSends) => {
    const portNames = Object.keys(gren.ports || {})
    if (portNames.length) {
      portNames
        .filter(name => "subscribe" in gren.ports[name])
        .forEach((portName) => {
          const port = gren.ports[portName]
          const subscribe = port.subscribe
          const unsubscribe = port.unsubscribe
          gren.ports[portName] = Object.assign(port, {
            subscribe: (handler) => {
              console.log("[vite-plugin-gren] ports.", portName + ".subscribe called")
              if (!portSubscribes[portName]) {
                portSubscribes[portName] = [handler]
              } else {
                portSubscribes[portName].push(handler)
              }
              return subscribe.call(port, handler)
            },
            unsubscribe: (handler) => {
              console.log("[vite-plugin-gren] ports.", portName + ".unsubscribe called.")
              const list = portSubscribes[portName]
              if (list && list.indexOf(handler) !== -1) {
                list.splice(list.lastIndexOf(handler), 1)
              } else {
                console.warn("[vite-plugin-gren] ports.", portName + ".unsubscribe: handler not subscribed")
              }
              return unsubscribe.call(port, handler)
            }
          })
        })

    portNames
      .filter(name => "send" in gren.ports[name])
      .forEach((portName) => {
        const port = gren.ports[portName]
        portSends[portName] = port.send
        gren.ports[portName] = Object.assign(port, {
          send: (val) => portSends[portName].call(port, val)
        })
      })
    }

    return portSubscribes
  }

  const isDebuggerModel = (model) => model && (model.hasOwnProperty("expando") || model.hasOwnProperty("expandoModel")) && model.hasOwnProperty("state")

  const findNavKey = (rootModel) => {
    const queue = []
    if (isDebuggerModel(rootModel)) {
      queue.push({ value: rootModel['state'], keypath: ['state'] })
    } else {
      queue.push({ value: rootModel, keypath: [] })
    }

    while (queue.length !== 0) {
      const item = queue.shift()
      if (typeof item.value === "undefined" || item.value === null) continue
      if (item.value.hasOwnProperty("gren-hot-nav-key")) return item
      if (typeof item.value !== "object") continue

      for (const propName in item.value) {
        if (!item.value.hasOwnProperty(propName)) continue
        const newKeypath = item.keypath.slice()
        newKeypath.push(propName)
        queue.push({ value: item.value[propName], keypath: newKeypath })
      }
    }
    return null
  }

  const getAt = (keyPath, obj) => keyPath.reduce((xs, x) => (xs && xs[x]) ? xs[x] : null, obj)
  const removeNavKeyListeners = (navKey) => {
    window.removeEventListener("popstate", navKey.value)
    window.navigator.userAgent.indexOf("Trident") < 0 || window.removeEventListener("hashchange", navKey.value)
  }

  const initialize = _Platform_initialize
  _Platform_initialize = (flagDecoder, args, init, update, subscriptions, stepperBuilder) => {
    const instance = initializingInstance || swappingInstance
    let tryFirstRender = !!swappingInstance

    const hookedInit = (args) => {
      const initialStateTuple = init(args)
      if (swappingInstance) {
        let oldModel = swappingInstance.lastState
        const newModel = initialStateTuple.model

        if (JSON.stringify(newModel.state?.model ? newModel.state.model : newModel) !== swappingInstance.initialState) {
          console.log("[vite-plugin-gren] Initial state seems to be updated. Refreshes page")
          import.meta.hot.invalidate()
        }

        if (typeof grenSymbol("gren_lang$browser$Browser$application") !== "undefined" && typeof grenSymbol("gren_lang$browser$Browser$Navigation") !== "undefined") {
          const oldKeyLoc = findNavKey(oldModel)
          const newKeyLoc = findNavKey(newModel)
          let error = null
          if (newKeyLoc === null) {
            error = "could not find Browser.Navigation.Key in the new app model"
          } else if (oldKeyLoc === null) {
            error = "could not find Browser.Navigation.Key in the old app model"
          } else if (newKeyLoc.keypath.toString() !== oldKeyLoc.keypath.toString()) {
            error = "the location of the Browser.Navigation.Key in the model has changed.";
          } else {
            removeNavKeyListeners(oldKeyLoc.value)
            const parentKeyPath = oldKeyLoc.keypath.slice(0, -1)
            const lastSegment = oldKeyLoc.keypath.slice(-1)[0]
            const oldParent = getAt(parentKeyPath, oldModel)
            oldParent[lastSegment] = newKeyLoc.value
          }

          if (error !== null) {
            console.error("[vite-plugin-gren] Hot-swapping", instance.path + " not possible: " + error)
            oldModel = newModel
          }
        }
        initialStateTuple.model = oldModel
        initialStateTuple.command = grenSymbol("gren_lang$core$Platform$Cmd$none")
      } else {
        initializingInstance.lastState = initialStateTuple.model
        initializingInstance.initialState = JSON.stringify(initialStateTuple.model.state?.model ? initialStateTuple.model.state.model : initialStateTuple.model)
      }

      return initialStateTuple
    }

    const hookedStepperBuilder = (sendToApp, model) => {
      let result
      if (tryFirstRender) {
        tryFirstRender = false
        try {
          result = stepperBuilder(sendToApp, model)
        } catch (e) {
          throw new Error("[vite-plugin-gren] Hot-swapping " + instance.path + " is not possible, please reload page. Error: " + e.message)
        }
      } else {
        result = stepperBuilder(sendToApp, model)
      }

      return (nextModel, isSync) => {
        if (instance) instance.lastState = nextModel
        return result(nextModel, isSync)
      }
    }

    return initialize(flagDecoder, args, hookedInit, update, subscriptions, hookedStepperBuilder)
  }

  const originalBinding = _Scheduler_binding
  _Scheduler_binding = (originalCallback) => originalBinding(function () {
    const cancel = originalCallback.apply(this, arguments)
    if (cancel) {
      cancellers.push(cancel)
      return () => {
        cancellers.splice(cancellers.indexOf(cancel), 1)
        return cancel()
      }
    }
  })

  const swapInstances = (Gren) => {
    const removedInstances = []
    Object.entries(instances).forEach(([id, instance]) => {
      if (instance.domNode.parentNode) {
        swap(Gren, instance)
      } else {
        removedInstances.push(id)
      }
    })

    removedInstances.forEach((id) => {
      delete instance[id]
    })

    findPublicModules(Gren).forEach((m) => {
      wrapPublicModule(m.path, m.module)
    })
  }

  swapInstances(Gren)
}
`

const hotFixForGrenHotNavKey = (esm: string): string => {
  const hotFixForMissingKey = 'function() { key.a(onUrlChange(_Browser_getUrl())); };'
  return esm.includes('gren_lang$browser$Browser$application')
    ? esm.replace(hotFixForMissingKey, `${hotFixForMissingKey}\n\tkey['gren-hot-nav-key'] = true;\n`)
    : esm
}

export const injectHMR = (compiledESM: string, dependencies: string[]): string =>
  injectGrenHot(hotFixForGrenHotNavKey(compiledESM), dependencies)
