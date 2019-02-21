import Vue from 'vue/dist/vue'
import Vuex from 'vuex'
import feathers from '@feathersjs/feathers'
import memory from 'feathers-memory'
import feathersVuex, { makeFindMixin } from 'feathers-vuex/src/index'
import fakeData from '/test/fixtures/fake-data.json'

const feathersClient = feathers()
  .use('transactions', memory({
    id: '_id',
    paginate: {
      default: 10,
      max: 50
    },
    store: fakeData.transactions.reduce((byId, current) => {
      byId[current._id] = current
      return byId
    }, {})
  }))
const { FeathersVuex, service } = feathersVuex(feathersClient, { idField: '_id' })

feathersClient.service('transactions').hooks({
  before: {
    find: [
      context => {
        console.log('fetching from server', context.params.query)
      }
    ]
  }
})

Vue.use(Vuex)
Vue.use(FeathersVuex)

const store = new Vuex.Store({
  plugins: [
    service('transactions', {
      instanceDefaults (data) {
        return {
          _id: '',
          name: '',
          type: '',
          amount: 0,
          userId: '',
          accountId: ''
        }
      }
    })
  ]
})

const App = {
  name: 'App',
  mixins: [ makeFindMixin({ service: 'transactions', watch: true }) ],
  template: '#app-template',
  data: () => ({
    limit: 10,
    skip: 0,
    sortField: 'name',
    sortDirection: 1
  }),
  computed: {
    transactionsParams () {
      return {
        query: {
          $limit: this.limit,
          $skip: this.skip,
          $sort: {
            [this.sortField]: this.sortDirection
          }
        },
        qid: 'main-list'
      }
    },
    transactionsQueryWhen () {
      return !this.transactions.length
    }
  },
  methods: {
    prev () {
      const newSkip = this.skip - this.limit
      this.skip = newSkip < 0 ? 0 : newSkip
    },
    next () {
      const { queryInfo } = this.getPaginationForQuery(this.transactionsParams)
      const { total } = queryInfo

      if (this.skip + this.limit <= total) {
        this.skip += this.limit
      }
    },
    sortBy (fieldName) {
      const sameField = fieldName === this.sortField
      if (sameField) {
        this.sortDirection = this.sortDirection === 1 ? -1 : 1
      } else {
        this.sortField = fieldName
      }
    }
  },
  filters: {
    json: (value) => {
      return JSON.stringify(value, null, 2)
    }
  }
}

new Vue({
  store,
  render: h => h(App)
}).$mount('#app')

Vue.config.devtools = true
