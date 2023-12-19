import Vue from 'vue'
import App from './App.vue'
import router from './router'
import 'bootstrap/dist/css/bootstrap.css'
import './axios.js'

Vue.config.productionTip = false
const app = new Vue({
  router,
  render: h => h(App)
})
app.$mount('#app')
