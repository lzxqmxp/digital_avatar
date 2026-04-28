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
    },
    // M3 - Operational pages
    {
      path: '/scripts',
      component: () => import('@features/script/ScriptPage.vue')
    },
    {
      path: '/policy',
      component: () => import('@features/reply/PolicyPage.vue')
    },
    {
      path: '/writer',
      component: () => import('@features/script/WriterPage.vue')
    },
    {
      path: '/models',
      component: () => import('@features/avatar/ModelPage.vue')
    },
    {
      path: '/accounts',
      component: () => import('@features/live/AccountPage.vue')
    },
    {
      path: '/asr',
      component: () => import('@features/asr/AsrPage.vue')
    }
  ]
})

export default router
