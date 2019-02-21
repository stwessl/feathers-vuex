import {
  getServicePrefix,
  getServiceCapitalization,
  getPaginationInfo,
  getItemsFromQueryInfo
} from './utils'

export default function makeFindMixin (options) {
  const {
    service,
    params,
    fetchQuery,
    queryWhen = () => true,
    local = false,
    qid = 'default',
    items,
    debug
  } = options
  let { name, watch = [] } = options

  if (typeof watch === 'string') {
    watch = [watch]
  } else if (typeof watch === 'boolean' && watch) {
    watch = ['params']
  }

  if (!service || (typeof service !== 'string' && typeof service !== 'function')) {
    throw new Error(`The 'service' option is required in the FeathersVuex make-find-mixin and must be a string.`)
  }
  if (typeof service === 'function' && !name) {
    name = 'service'
  }

  const nameToUse = (name || service).replace('-', '_')
  const prefix = getServicePrefix(nameToUse)
  const capitalized = getServiceCapitalization(nameToUse)
  const SERVICE_NAME = `${prefix}ServiceName`
  let ITEMS = items || prefix
  if (typeof service === 'function' && name === 'service' && !items) {
    ITEMS = 'items'
  }
  const ITEMS_FETCHED = `${ITEMS}Fetched`
  const IS_FIND_PENDING = `isFind${capitalized}Pending`
  const PARAMS = `${prefix}Params`
  const FETCH_PARAMS = `${prefix}FetchParams`
  const WATCH = `${prefix}Watch`
  const QUERY_WHEN = `${prefix}QueryWhen`
  const FIND_ACTION = `find${capitalized}`
  const PAGINATION = `${prefix}PaginationData`
  const MOST_RECENT_QUERY = `${prefix}MostRecentQueryInfo`
  const LOCAL = `${prefix}Local`
  const QID = `${prefix}Qid`
  const data = {
    [IS_FIND_PENDING]: false,
    [WATCH]: watch,
    [QID]: qid,
    [MOST_RECENT_QUERY]: null
  }
  const getParams = (providedParams, params, fetchParams) => {
    if (providedParams) {
      return providedParams
    } else if (fetchParams || fetchParams === null) {
      return fetchParams
    } else {
      return params
    }
  }

  const mixin = {
    data () {
      return data
    },
    computed: {
      [PAGINATION] () {
        return this.$store.state[this[SERVICE_NAME]].pagination[qid] || {}
      },
      [ITEMS] () {
        const paramsToUse = getParams(undefined, this[PARAMS], this[FETCH_PARAMS])
        const { defaultSkip: skip, defaultLimit: limit } = this[PAGINATION]
        const response = (skip !== null && skip !== undefined && limit !== null && limit !== undefined) ? { limit, skip } : {}
        const queryInfo = getPaginationInfo({
          qid: this[QID],
          response,
          query: paramsToUse.query
        })
        const pagination = this[PAGINATION]
        const { keyedById } = this.$store.state[this[SERVICE_NAME]]
        const items = getItemsFromQueryInfo(pagination, queryInfo, keyedById)

        if (this[LOCAL] && this[PARAMS]) {
          return this.$store.getters[`${this[SERVICE_NAME]}/find`](this[PARAMS]).data
        } else if (items && items.length) {
          return items
        } else {
          return []
        }
      },
      [ITEMS_FETCHED] () {
        if (this[FETCH_PARAMS]) {
          return this.$store.getters[`${this[SERVICE_NAME]}/find`](this[FETCH_PARAMS]).data
        } else {
          return this[ITEMS]
        }
      }
    },
    methods: {
      [FIND_ACTION] (params) {
        const paramsToUse = getParams(params, this[PARAMS], this[FETCH_PARAMS])

        if (!this[LOCAL]) {
          const shouldQuery = typeof this[QUERY_WHEN] === 'function'
            ? this[QUERY_WHEN](paramsToUse)
            : this[QUERY_WHEN]

          if (shouldQuery) {
            this[IS_FIND_PENDING] = true

            if (paramsToUse) {
              paramsToUse.query = paramsToUse.query || {}
              paramsToUse.qid = qid

              return this.$store.dispatch(`${this[SERVICE_NAME]}/find`, paramsToUse)
                .then(response => {
                  const queryInfo = getPaginationInfo({
                    qid,
                    response,
                    query: paramsToUse.query
                  })
                  queryInfo.isOutdated = false

                  this[MOST_RECENT_QUERY] = queryInfo
                  this[IS_FIND_PENDING] = false
                  return response
                })
            }
          } else {
            this[MOST_RECENT_QUERY].isOutdated = true
          }
        }
      }
    },
    created () {
      debug && console.log(`running 'created' hook in makeFindMixin for service "${service}" (using name ${nameToUse}")`)
      debug && console.log(PARAMS, this[PARAMS])
      debug && console.log(FETCH_PARAMS, this[FETCH_PARAMS])

      const pType = Object.getPrototypeOf(this)

      if (pType.hasOwnProperty(PARAMS) || pType.hasOwnProperty(FETCH_PARAMS)) {
        watch.forEach(prop => {
          if (typeof prop !== 'string') {
            throw new Error(`Values in the 'watch' array must be strings.`)
          }
          prop = prop.replace('params', PARAMS)

          if (pType.hasOwnProperty(FETCH_PARAMS)) {
            if (prop.startsWith(PARAMS)) {
              prop = prop.replace(PARAMS, FETCH_PARAMS)
            }
          }
          this.$watch(prop, this[FIND_ACTION])
        })

        return this[FIND_ACTION]()
      } else {
        if (!local) {
          // TODO: Add this message to the logging:
          //       "Pass { local: true } to disable this warning and only do local queries."
          console.log(`No "${PARAMS}" or "${FETCH_PARAMS}" attribute was found in the makeFindMixin for the "${service}" service (using name "${nameToUse}").  No queries will be made.`)
        }
      }
    }
  }

  setupAttribute(SERVICE_NAME, service, 'computed', true)
  setupAttribute(PARAMS, params)
  setupAttribute(FETCH_PARAMS, fetchQuery)
  setupAttribute(QUERY_WHEN, queryWhen, 'methods')
  setupAttribute(LOCAL, local)

  function setupAttribute (NAME, value, computedOrMethods = 'computed', returnTheValue = false) {
    if (typeof value === 'boolean') {
      data[NAME] = !!value
    } else if (typeof value === 'string') {
      mixin.computed[NAME] = function () {
        // If the specified computed prop wasn't found, display an error.
        if (returnTheValue) {

        } else {
          if (!hasSomeAttribute(this, value, NAME)) {
            throw new Error(`Value for ${NAME} was not found on the component at '${value}'.`)
          }
        }
        return returnTheValue ? value : this[value]
      }
    } else if (typeof value === 'function') {
      mixin[computedOrMethods][NAME] = value
    }
  }

  function hasSomeAttribute (vm, ...attributes) {
    return attributes.some(a => {
      return vm.hasOwnProperty(a) || Object.getPrototypeOf(vm).hasOwnProperty(a)
    })
  }

  return mixin
}
