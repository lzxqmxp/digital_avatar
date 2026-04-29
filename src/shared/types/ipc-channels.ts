/**
 * Unified IPC channel name constants shared between main and renderer processes.
 * Use these constants instead of raw strings to avoid typos.
 */

export const IpcChannels = {
  // Avatar
  AVATAR_START: 'avatar:start',
  AVATAR_STOP: 'avatar:stop',
  AVATAR_STATUS: 'avatar:status',

  // Live streaming
  LIVE_START: 'live:start',
  LIVE_STOP: 'live:stop',
  LIVE_STATUS: 'live:status',
  LIVE_COMMENT: 'live:comment',
  DOUYIN_DIRECT_START: 'douyin-direct:start',
  DOUYIN_DIRECT_STOP: 'douyin-direct:stop',
  DOUYIN_DIRECT_STATUS: 'douyin-direct:status',
  DYCAST_RELAY_STATUS: 'dycast-relay:status',

  // ASR (Automatic Speech Recognition)
  ASR_START: 'asr:start',
  ASR_STOP: 'asr:stop',
  ASR_RESULT: 'asr:result',

  // TTS (Text-to-Speech)
  TTS_SPEAK: 'tts:speak',
  TTS_DONE: 'tts:done',

  // Script
  SCRIPT_LOAD: 'script:load',
  SCRIPT_NEXT: 'script:next',

  // Reply
  REPLY_TRIGGER: 'reply:trigger',
  REPLY_RESULT: 'reply:result',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',

  // System
  APP_READY: 'app:ready',
  APP_ERROR: 'app:error'
} as const

export type IpcChannel = (typeof IpcChannels)[keyof typeof IpcChannels]
