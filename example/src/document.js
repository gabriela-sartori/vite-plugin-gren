import { Gren } from './Hello.gren'

console.log("hello gren!")
Gren.Hello.init({
  flags: "Initial Message",
  node: document.getElementById("gren-node")
})
