import HelloInRaw from './Raw.gren?raw'

const meta = document.createElement('meta')
meta.name = 'gren:plugin'
meta.content = HelloInRaw.split('\n')[0]
document.head.appendChild(meta)
