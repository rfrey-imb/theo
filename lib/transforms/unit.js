const {
  isRelativeSpacing,
  remToPx
} = require('../util')

const convertRemToPx = (prop) => {
  const baseFontPercentage = typeof prop.getIn(['meta', 'baseFontPercentage']) === 'number'
    ? prop.getIn(['meta', 'baseFontPercentage']) : 100
  const baseFontPixel = typeof prop.getIn(['meta', 'baseFontPixel']) === 'number'
    ? prop.getIn(['meta', 'baseFontPixel']) : 16
  return remToPx(prop.get('value'), baseFontPercentage, baseFontPixel)
}

module.exports = {
  'relative/pixel': {
    predicate: prop => isRelativeSpacing(prop.get('value')),
    transform: prop => convertRemToPx(prop)
  },
  'relative/pixelValue': {
    predicate: prop => isRelativeSpacing(prop.get('value')),
    transform: prop => convertRemToPx(prop).replace(/px$/g, '')
  }
}