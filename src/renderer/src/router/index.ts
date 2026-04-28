import { createRouter, createWebHashHistory } from 'vue-router'

const router = createRouter({
  history: createWebHashHistory(),
  routes: [
    {
      path: '/',
      redirect: '/live'
    },
    {
      path: '/live',
      component: () => import('@features/live/LivePage.vue')
    },
    {
      path: '/avatar',
      component: () => import('@features/avatar/AvatarPage.vue')
    },
    {
      path: '/settings',
      component: () => import('@features/settings/SettingsPage.vue')
    }
  ]
})

export default router
