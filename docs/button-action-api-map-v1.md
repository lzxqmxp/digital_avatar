# Button → Action → API 映射表 V1

> 版本：V1 | 对应需求规格：requirements-spec-v7.md | 对应技术设计：technical-design-v7.md

---

## Page A — AI直播

| 按钮ID                  | 页面   | 操作名称         | API路径                            | 成功事件             | 失败事件               | 错误码                                |
| ----------------------- | ------ | ---------------- | ---------------------------------- | -------------------- | ---------------------- | ------------------------------------- |
| btn_live_fetch_start    | AI直播 | 开始拉取直播消息 | POST /api/v1/live/connect          | LIVE_CONNECTED       | LIVE_CONNECT_FAILED    | ROOM_NOT_FOUND, AUTH_FAILED           |
| btn_live_fetch_stop     | AI直播 | 停止拉取直播消息 | POST /api/v1/live/disconnect       | LIVE_DISCONNECTED    | LIVE_DISCONNECT_FAILED | NO_ACTIVE_TASK, STOP_FAILED           |
| sw_live_message_alert   | AI直播 | 切换消息提醒开关 | — (本地状态)                       | ALERT_TOGGLED        | —                      | —                                     |
| btn_live_tts_preview    | AI直播 | 预览TTS语音      | POST /api/v1/tts/synthesize        | TTS_PREVIEW_READY    | TTS_PREVIEW_FAILED     | MODEL_NOT_AVAILABLE, TIMEOUT          |
| btn_live_runtime_toggle | AI直播 | 切换运行时状态   | POST /api/v1/session/start 或 stop | SESSION_TOGGLED      | SESSION_TOGGLE_FAILED  | STREAM_FAILED, GPU_OOM                |
| btn_live_tts_stop       | AI直播 | 停止TTS播放      | POST /api/v1/session/stop          | TTS_STOPPED          | TTS_STOP_FAILED        | NO_ACTIVE_TASK, STOP_FAILED           |
| btn_live_pause          | AI直播 | 暂停直播推送     | POST /api/v1/session/stop          | SESSION_PAUSED       | SESSION_PAUSE_FAILED   | NO_ACTIVE_TASK                        |
| btn_live_stop           | AI直播 | 停止直播会话     | POST /api/v1/session/stop          | SESSION_STOPPED      | SESSION_STOP_FAILED    | NO_ACTIVE_TASK, STOP_FAILED           |
| sw_live_av_sync         | AI直播 | 切换音视频同步   | — (本地状态)                       | AV_SYNC_TOGGLED      | —                      | —                                     |
| btn_live_model_rotate   | AI直播 | 轮换AI模型       | POST /api/v1/session/start         | MODEL_ROTATED        | MODEL_ROTATE_FAILED    | MODEL_NOT_AVAILABLE, VERSION_CONFLICT |
| btn_live_insert         | AI直播 | 插入优先队列     | POST /api/v1/queue/insert          | QUEUE_INSERTED       | QUEUE_INSERT_FAILED    | QUEUE_OVERFLOW, INVALID_TEXT          |
| btn_live_send_text      | AI直播 | 发送文本到队列   | POST /api/v1/queue/enqueue         | TEXT_ENQUEUED        | TEXT_ENQUEUE_FAILED    | QUEUE_OVERFLOW, INVALID_TEXT          |
| btn_live_account_close  | AI直播 | 关闭直播账号连接 | POST /api/v1/live/disconnect       | ACCOUNT_CLOSED       | ACCOUNT_CLOSE_FAILED   | NO_ACTIVE_TASK                        |
| btn_live_init_messages  | AI直播 | 初始化消息列表   | GET /api/v1/session/status         | MESSAGES_INITIALIZED | MESSAGES_INIT_FAILED   | TIMEOUT                               |

---

## Page B — 数字人

| 按钮ID                   | 页面   | 操作名称         | API路径                   | 成功事件            | 失败事件             | 错误码                                        |
| ------------------------ | ------ | ---------------- | ------------------------- | ------------------- | -------------------- | --------------------------------------------- |
| btn_avatar_pick_asset    | 数字人 | 选择形象资产     | — (本地文件选择)          | ASSET_PICKED        | ASSET_PICK_CANCELLED | FORMAT_NOT_SUPPORTED                          |
| sel_avatar_engine        | 数字人 | 选择渲染引擎     | — (本地状态)              | ENGINE_SELECTED     | —                    | —                                             |
| chk_avatar_camera_mode   | 数字人 | 切换摄像头模式   | — (本地状态)              | CAMERA_MODE_CHANGED | —                    | DEVICE_OCCUPIED                               |
| btn_avatar_refresh_audio | 数字人 | 刷新音频设备列表 | — (系统设备查询)          | AUDIO_REFRESHED     | AUDIO_REFRESH_FAILED | DEVICE_OCCUPIED                               |
| btn_avatar_show_preview  | 数字人 | 显示数字人预览   | POST /api/v1/avatar/start | PREVIEW_SHOWN       | PREVIEW_FAILED       | MODEL_NOT_AVAILABLE, GPU_OOM                  |
| btn_avatar_start         | 数字人 | 启动数字人渲染   | POST /api/v1/avatar/start | AVATAR_STARTED      | AVATAR_START_FAILED  | MODEL_NOT_AVAILABLE, GPU_OOM, DEVICE_OCCUPIED |
| btn_avatar_stop          | 数字人 | 停止数字人渲染   | POST /api/v1/session/stop | AVATAR_STOPPED      | AVATAR_STOP_FAILED   | NO_ACTIVE_TASK, STOP_FAILED                   |

---

## Page C — 设置

| 按钮ID                 | 页面 | 操作名称       | API路径                    | 成功事件         | 失败事件              | 错误码                                |
| ---------------------- | ---- | -------------- | -------------------------- | ---------------- | --------------------- | ------------------------------------- |
| btn_cfg_save_provider  | 设置 | 保存服务商配置 | — (本地持久化)             | PROVIDER_SAVED   | PROVIDER_SAVE_FAILED  | AUTH_FAILED                           |
| btn_cfg_engine_rotate  | 设置 | 轮换推理引擎   | POST /api/v1/session/start | ENGINE_ROTATED   | ENGINE_ROTATE_FAILED  | MODEL_NOT_AVAILABLE, VERSION_CONFLICT |
| btn_cfg_api_start      | 设置 | 启动API服务    | POST /api/v1/stream/start  | API_STARTED      | API_START_FAILED      | PORT_OCCUPIED                         |
| btn_cfg_api_stop       | 设置 | 停止API服务    | POST /api/v1/session/stop  | API_STOPPED      | API_STOP_FAILED       | NO_ACTIVE_TASK, STOP_FAILED           |
| btn_cfg_reset_default  | 设置 | 重置默认配置   | — (本地持久化)             | CONFIG_RESET     | —                     | —                                     |
| btn_cfg_refresh_output | 设置 | 刷新输出设备   | — (系统设备查询)           | OUTPUT_REFRESHED | OUTPUT_REFRESH_FAILED | DEVICE_OCCUPIED                       |
| btn_cfg_save_prompt    | 设置 | 保存提示词     | — (本地持久化)             | PROMPT_SAVED     | PROMPT_SAVE_FAILED    | INVALID_TEXT                          |

---

## Page D — 话术管理

| 按钮ID             | 页面     | 操作名称     | API路径          | 成功事件        | 失败事件              | 错误码               |
| ------------------ | -------- | ------------ | ---------------- | --------------- | --------------------- | -------------------- |
| btn_script_import  | 话术管理 | 导入话术文件 | — (本地文件读取) | SCRIPT_IMPORTED | SCRIPT_IMPORT_FAILED  | FORMAT_NOT_SUPPORTED |
| btn_script_export  | 话术管理 | 导出话术文件 | — (本地文件写入) | SCRIPT_EXPORTED | SCRIPT_EXPORT_FAILED  | —                    |
| btn_script_new     | 话术管理 | 新建话术     | — (本地状态)     | SCRIPT_CREATED  | —                     | —                    |
| btn_script_save    | 话术管理 | 保存话术     | — (本地持久化)   | SCRIPT_SAVED    | SCRIPT_SAVE_FAILED    | INVALID_TEXT         |
| btn_script_enable  | 话术管理 | 启用话术     | — (本地持久化)   | SCRIPT_ENABLED  | SCRIPT_ENABLE_FAILED  | —                    |
| btn_script_disable | 话术管理 | 禁用话术     | — (本地持久化)   | SCRIPT_DISABLED | SCRIPT_DISABLE_FAILED | —                    |
| btn_script_delete  | 话术管理 | 删除话术     | — (本地持久化)   | SCRIPT_DELETED  | SCRIPT_DELETE_FAILED  | —                    |

---

## Page E — AI回复

| 按钮ID              | 页面   | 操作名称     | API路径                       | 成功事件           | 失败事件               | 错误码                         |
| ------------------- | ------ | ------------ | ----------------------------- | ------------------ | ---------------------- | ------------------------------ |
| btn_policy_new      | AI回复 | 新建回复策略 | — (本地状态)                  | POLICY_CREATED     | —                      | —                              |
| btn_policy_save     | AI回复 | 保存回复策略 | — (本地持久化)                | POLICY_SAVED       | POLICY_SAVE_FAILED     | INVALID_TEXT                   |
| btn_policy_test     | AI回复 | 测试回复策略 | POST /api/v1/review/decision  | POLICY_TEST_PASSED | POLICY_TEST_FAILED     | REVIEW_TIMEOUT, TIMEOUT        |
| btn_policy_publish  | AI回复 | 发布回复策略 | POST /api/v1/moderation/check | POLICY_PUBLISHED   | POLICY_PUBLISH_FAILED  | INVALID_TEXT, VERSION_CONFLICT |
| btn_policy_rollback | AI回复 | 回滚回复策略 | — (本地持久化)                | POLICY_ROLLED_BACK | POLICY_ROLLBACK_FAILED | VERSION_CONFLICT               |

---

## Page F — 写话术

| 按钮ID                     | 页面   | 操作名称   | API路径                       | 成功事件               | 失败事件               | 错误码                         |
| -------------------------- | ------ | ---------- | ----------------------------- | ---------------------- | ---------------------- | ------------------------------ |
| btn_writer_generate        | 写话术 | AI生成话术 | POST /api/v1/script/rewrite   | SCRIPT_GENERATED       | SCRIPT_GENERATE_FAILED | MODEL_NOT_AVAILABLE, TIMEOUT   |
| btn_writer_rewrite         | 写话术 | AI改写话术 | POST /api/v1/script/rewrite   | SCRIPT_REWRITTEN       | SCRIPT_REWRITE_FAILED  | MODEL_NOT_AVAILABLE, TIMEOUT   |
| btn_writer_sensitive_check | 写话术 | 敏感词检测 | POST /api/v1/moderation/check | SENSITIVE_CHECK_PASSED | SENSITIVE_CHECK_FAILED | INVALID_TEXT                   |
| btn_writer_save_draft      | 写话术 | 保存草稿   | — (本地持久化)                | DRAFT_SAVED            | DRAFT_SAVE_FAILED      | —                              |
| btn_writer_publish         | 写话术 | 发布话术   | POST /api/v1/moderation/check | SCRIPT_PUBLISHED       | SCRIPT_PUBLISH_FAILED  | INVALID_TEXT, VERSION_CONFLICT |

---

## Page G — 模型管理

| 按钮ID             | 页面     | 操作名称     | API路径                   | 成功事件          | 失败事件              | 错误码                       |
| ------------------ | -------- | ------------ | ------------------------- | ----------------- | --------------------- | ---------------------------- |
| btn_model_import   | 模型管理 | 导入模型文件 | — (本地文件读取)          | MODEL_IMPORTED    | MODEL_IMPORT_FAILED   | FORMAT_NOT_SUPPORTED         |
| btn_model_verify   | 模型管理 | 验证模型     | POST /api/v1/avatar/start | MODEL_VERIFIED    | MODEL_VERIFY_FAILED   | MODEL_NOT_AVAILABLE, GPU_OOM |
| btn_model_enable   | 模型管理 | 启用模型     | — (本地持久化)            | MODEL_ENABLED     | MODEL_ENABLE_FAILED   | MODEL_NOT_AVAILABLE          |
| btn_model_rollback | 模型管理 | 回滚模型版本 | — (本地持久化)            | MODEL_ROLLED_BACK | MODEL_ROLLBACK_FAILED | VERSION_CONFLICT             |
| btn_model_delete   | 模型管理 | 删除模型     | — (本地持久化)            | MODEL_DELETED     | MODEL_DELETE_FAILED   | —                            |

---

## Page H — OBS去重

| 按钮ID                  | 页面    | 操作名称     | API路径                    | 成功事件          | 失败事件               | 错误码                      |
| ----------------------- | ------- | ------------ | -------------------------- | ----------------- | ---------------------- | --------------------------- |
| btn_obs_connect         | OBS去重 | 连接OBS      | POST /api/v1/stream/start  | OBS_CONNECTED     | OBS_CONNECT_FAILED     | PORT_OCCUPIED, TIMEOUT      |
| btn_obs_start_dedup     | OBS去重 | 开始去重处理 | POST /api/v1/session/start | DEDUP_STARTED     | DEDUP_START_FAILED     | STREAM_FAILED, GPU_OOM      |
| btn_obs_stop_dedup      | OBS去重 | 停止去重处理 | POST /api/v1/session/stop  | DEDUP_STOPPED     | DEDUP_STOP_FAILED      | NO_ACTIVE_TASK, STOP_FAILED |
| btn_obs_apply_threshold | OBS去重 | 应用去重阈值 | — (本地配置)               | THRESHOLD_APPLIED | THRESHOLD_APPLY_FAILED | —                           |
| btn_obs_preview_diff    | OBS去重 | 预览去重差异 | GET /api/v1/metrics        | DIFF_PREVIEWED    | DIFF_PREVIEW_FAILED    | NO_ACTIVE_TASK              |

---

## Page I — 直播账号

| 按钮ID                  | 页面     | 操作名称     | API路径                   | 成功事件           | 失败事件               | 错误码                      |
| ----------------------- | -------- | ------------ | ------------------------- | ------------------ | ---------------------- | --------------------------- |
| btn_account_new         | 直播账号 | 新建账号     | — (本地状态)              | ACCOUNT_CREATED    | —                      | —                           |
| btn_account_auth        | 直播账号 | 账号授权认证 | POST /api/v1/live/connect | ACCOUNT_AUTHED     | ACCOUNT_AUTH_FAILED    | AUTH_FAILED, ROOM_NOT_FOUND |
| btn_account_enable      | 直播账号 | 启用账号     | — (本地持久化)            | ACCOUNT_ENABLED    | ACCOUNT_ENABLE_FAILED  | —                           |
| btn_account_disable     | 直播账号 | 禁用账号     | — (本地持久化)            | ACCOUNT_DISABLED   | ACCOUNT_DISABLE_FAILED | —                           |
| btn_account_health_test | 直播账号 | 账号健康检测 | POST /api/v1/live/connect | HEALTH_TEST_PASSED | HEALTH_TEST_FAILED     | AUTH_FAILED, TIMEOUT        |
| btn_account_delete      | 直播账号 | 删除账号     | — (本地持久化)            | ACCOUNT_DELETED    | ACCOUNT_DELETE_FAILED  | —                           |

---

## Page J — 音转文字

| 按钮ID                    | 页面     | 操作名称     | API路径                       | 成功事件             | 失败事件          | 错误码                               |
| ------------------------- | -------- | ------------ | ----------------------------- | -------------------- | ----------------- | ------------------------------------ |
| btn_asr_start             | 音转文字 | 开始语音识别 | POST /api/v1/session/start    | ASR_STARTED          | ASR_START_FAILED  | DEVICE_OCCUPIED, MODEL_NOT_AVAILABLE |
| btn_asr_pause             | 音转文字 | 暂停语音识别 | POST /api/v1/session/stop     | ASR_PAUSED           | ASR_PAUSE_FAILED  | NO_ACTIVE_TASK                       |
| btn_asr_stop              | 音转文字 | 停止语音识别 | POST /api/v1/session/stop     | ASR_STOPPED          | ASR_STOP_FAILED   | NO_ACTIVE_TASK, STOP_FAILED          |
| btn_asr_correction_submit | 音转文字 | 提交文字纠错 | POST /api/v1/moderation/check | CORRECTION_SUBMITTED | CORRECTION_FAILED | INVALID_TEXT, TIMEOUT                |
| btn_asr_export            | 音转文字 | 导出识别结果 | — (本地文件写入)              | ASR_EXPORTED         | ASR_EXPORT_FAILED | NO_ACTIVE_TASK                       |

---

> 注：`—` 表示纯本地操作，不调用后端 API。所有 API 响应均使用 `ApiResponse<T>` 包装，错误码参见 `src/shared/types/api.ts` 中的 `ErrorCode` 枚举。
