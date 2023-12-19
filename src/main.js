import Vue from 'vue'
import './plugins/axios'
import App from './App.vue'
import router from './router'
import 'bootstrap/dist/css/bootstrap.css'
import Plugin from "@/plugins/axios";

Plugin.install(Vue)
Vue.config.productionTip = false

new Vue({
  router,
  render: h => h(App)
}).$mount('#app')
