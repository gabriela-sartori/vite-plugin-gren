import { Gren } from './Description.gren?with=./AnotherDescription.gren'

Gren.Description.init({
  node: document.getElementById('description'),
  flags: 'This message is rendered by Description.gren.'
})

Gren.AnotherDescription.init({
  node: document.getElementById('anotherDescription'),
  flags: ''
})
