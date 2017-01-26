const { constant } = require('core.lambda')
const Either = require('data.either')
const Immutable = require('immutable-ext')

const { ALIAS_PATTERN } = require('./constants')
const { allMatches } = require('./util')

const transform = options => {
  const go = def =>
    Either
      .fromNullable(def)
      .chain(validate)
      .map(mergeGlobal)
      .chain(validateProps)
      .chain(transformImports)
      .map(mergeImports)
      .chain(def =>
        Either.try(resolveNestedAliases)(def)
          .leftMap(e => e.message)
      )
      .chain(def =>
        Either.try(resolveAliases)(def)
          .leftMap(e => e.message)
        )
      .map(addPropName)
      .chain(transformValues)

  const mergeGlobal = def => def
    .update('props', props =>
      props.map((v, k) =>
        def.get('global').merge(v)
      )
    )
    .delete('global')

  const validateProp = (prop, propName) =>
    Immutable.List
      .of('value', 'type', 'category')
      .traverse(Either.of, propKey =>
        prop.has(propKey)
          ? Either.Right()
          : Either.Left(`Property "${propName}" contained no "${propKey}" key`)
      )
      .map(constant(prop))

  const validateProps = def => def
    .get('props')
    .traverse(Either.of, validateProp)
    .map(constant(def))

  const validate = def =>
    Either
      .of(def)
      .chain(def =>
        Immutable.Map.isMap(def.get('props'))
          ? Either.Right(def)
          : Either.Left('"props" key must be an object')
      )
      .chain(def =>
        Immutable.Map.isMap(def.get('aliases'))
          ? Either.Right(def)
          : Either.Left('"aliases" key must be an object')
      )
      .chain(def =>
        Immutable.Map.isMap(def.get('global'))
          ? Either.Right(def)
          : Either.Left('"global" key must be an object')
      )

  const transformImports = def => def
    .get('imports')
    .traverse(Either.of, go)
    .map(imports =>
      def.set('imports', imports)
    )

  const mergeImports = def => def
    .update('aliases', aliases =>
      def.get('imports').reduce((aliases, i) =>
        aliases.merge(i.get('aliases'))
      , aliases)
    )
    .update('props', props =>
      def.get('imports').reduce((props, i) =>
        props.merge(i.get('props'))
      , props)
    )
    .delete('imports')

  const resolveNestedAliases = def => def
    .update('aliases', aliases => {
      const resolve = value =>
        value.update('value', v =>
          allMatches(v, ALIAS_PATTERN).reduce((v, [alias, key]) =>
            aliases.has(key)
              ? v.replace(alias, resolve(aliases.get(key)).get('value'))
              : v
          , v)
        )
      return aliases.map(resolve)
    })

  const resolveAliases = def => def
    .update('props', props => {
      const aliases = def.get('aliases', Immutable.Map())
      return props.map((value, key) =>
        value.update('value', v =>
          allMatches(v, ALIAS_PATTERN).reduce((v, [alias, key]) => {
            if (!aliases.has(key)) throw new Error(`Alias "${key}" not found`)
            return v.replace(alias, aliases.getIn([key, 'value']))
          }, v)
        )
      )
    })

  const transformValues = def =>
    def
      .get('props')
      .traverse(Either.of, prop =>
        options.get('transforms', Immutable.List()).reduce((result, t) =>
          result
            .chain(prop =>
              t.get('predicate')(prop)
                ? Either
                    .try(t.get('transform'))(prop)
                    .map(value =>
                      prop.set('value', value)
                    )
                : Either.Right(prop)
            )
        , Either.of(prop))
      )
      .map(props =>
        def.set('props', props)
      )

  const addPropName = def => def
    .update('props', props =>
      props.map((prop, name) => prop.set('name', name))
    )

  return go
}

module.exports = {
  transform: (def, options = Immutable.Map()) =>
    transform(options)(def)
      // Cleanup after recursion
      .map(def => def
        .delete('imports')
        .update('props', props =>
          options.get('includeMeta')
            ? props
            : props.map(prop => prop.delete('meta'))
        )
      )
}