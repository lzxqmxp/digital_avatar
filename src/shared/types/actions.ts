// Button action constants and types

export type ActionId =
  // Page A: AI直播
  | 'btn_live_fetch_start'
  | 'btn_live_fetch_stop'
  | 'sw_live_message_alert'
  | 'btn_live_tts_preview'
  | 'btn_live_runtime_toggle'
  | 'btn_live_tts_stop'
  | 'btn_live_pause'
  | 'btn_live_stop'
  | 'sw_live_av_sync'
  | 'sw_live_auto_queue'
  | 'btn_live_model_rotate'
  | 'btn_live_insert'
  | 'btn_live_send_text'
  | 'btn_live_account_close'
  | 'btn_live_init_messages'
  // Page B: 数字人
  | 'btn_avatar_pick_asset'
  | 'sel_avatar_engine'
  | 'chk_avatar_camera_mode'
  | 'btn_avatar_refresh_audio'
  | 'btn_avatar_show_preview'
  | 'btn_avatar_start'
  | 'btn_avatar_stop'
  // Page C: 设置
  | 'btn_cfg_save_provider'
  | 'btn_cfg_engine_rotate'
  | 'btn_cfg_api_start'
  | 'btn_cfg_api_stop'
  | 'btn_cfg_reset_default'
  | 'btn_cfg_refresh_output'
  | 'btn_cfg_save_prompt'
  // Page D: 话术管理
  | 'btn_script_import'
  | 'btn_script_export'
  | 'btn_script_new'
  | 'btn_script_save'
  | 'btn_script_enable'
  | 'btn_script_disable'
  | 'btn_script_delete'
  // Page E: AI回复
  | 'btn_policy_new'
  | 'btn_policy_save'
  | 'btn_policy_test'
  | 'btn_policy_publish'
  | 'btn_policy_rollback'
  // Page F: 写话术
  | 'btn_writer_generate'
  | 'btn_writer_rewrite'
  | 'btn_writer_sensitive_check'
  | 'btn_writer_save_draft'
  | 'btn_writer_publish'
  // Page G: 模型管理
  | 'btn_model_import'
  | 'btn_model_verify'
  | 'btn_model_enable'
  | 'btn_model_rollback'
  | 'btn_model_delete'
  // Page H: OBS去重
  | 'btn_obs_connect'
  | 'btn_obs_start_dedup'
  | 'btn_obs_stop_dedup'
  | 'btn_obs_apply_threshold'
  | 'btn_obs_preview_diff'
  // Page I: 直播账号
  | 'btn_account_new'
  | 'btn_account_auth'
  | 'btn_account_enable'
  | 'btn_account_disable'
  | 'btn_account_health_test'
  | 'btn_account_delete'
  // Page J: 音转文字
  | 'btn_asr_start'
  | 'btn_asr_pause'
  | 'btn_asr_stop'
  | 'btn_asr_correction_submit'
  | 'btn_asr_export'
  // Page K: 敏感词库
  | 'btn_sw_new'
  | 'btn_sw_save'
  | 'btn_sw_delete'
  | 'btn_sw_test'
  | 'btn_sw_batch_import'

export type ButtonState = 'idle' | 'loading' | 'success' | 'error' | 'disabled'

export type ActionResult<T> =
  | { success: true; data: T }
  | { success: false; data?: undefined; error: string; errorCode?: string }

export type AuditEntry = {
  audit_id: string
  session_id: string
  button_id: ActionId
  action: string
  result: 'success' | 'failure'
  error_code?: string
  ts: number
}
