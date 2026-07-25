import { createApp } from 'vue'
import AppLayout from './app/AppLayout.vue'
import { router } from './app/router'
import './styles/main.css'

createApp(AppLayout).use(router).mount('#app')
