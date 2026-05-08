/**
 * LiveTalking process lifecycle manager.
 * Spawns / kills the LiveTalking Python inference service as a child process.
 */

import { spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'

const DEFAULT_PORT = 8010
const LIVETALKING_DIR = app.getAppPath()

let ltProcess: ChildProcess | null = null
let ltStartupResolve: (() => void) | null = null
let ltStartupReject: ((err: Error) => void) | null = null

export function getLiveTalkingPort(): number {
  return parseInt(process.env['VITE_LIVETALKING_PORT'] || String(DEFAULT_PORT), 10)
}

export function isLiveTalkingRunning(): boolean {
  return ltProcess !== null && ltProcess.exitCode === null
}

export async function startLiveTalking(): Promise<void> {
  if (isLiveTalkingRunning()) {
    console.log('[LiveTalking] already running')
    return
  }

  const port = getLiveTalkingPort()

  const ltCommand = process.env['LIVETALKING_COMMAND'] || 'python'
  const ltArgsRaw = process.env['LIVETALKING_ARGS'] || 'app.py'
  const ltArgs = ltArgsRaw.split(' ').filter(Boolean)
  const ltCwd = process.env['LIVETALKING_CWD'] || LIVETALKING_DIR

  console.log(`[LiveTalking] starting: ${ltCommand} ${ltArgs.join(' ')} (cwd=${ltCwd}, port=${port})`)

  return new Promise((resolve, reject) => {
    ltStartupResolve = resolve
    ltStartupReject = reject

    const proc = spawn(ltCommand, ltArgs, {
      cwd: ltCwd,
      env: {
        ...process.env,
        ...(port !== DEFAULT_PORT ? { PORT: String(port) } : {})
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    ltProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[LiveTalking:out] ${text}`)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (!text) return
      console.log(`[LiveTalking:err] ${text}`)
      if (
        text.includes('Uvicorn running') ||
        text.includes('Application startup complete') ||
        text.includes('Running on')
      ) {
        if (ltStartupResolve) {
          ltStartupResolve()
          ltStartupResolve = null
          ltStartupReject = null
        }
      }
    })

    proc.on('error', (err) => {
      console.error(`[LiveTalking] spawn error:`, err)
      ltProcess = null
      if (ltStartupReject) {
        ltStartupReject(err)
        ltStartupResolve = null
        ltStartupReject = null
      }
    })

    proc.on('exit', (code) => {
      console.log(`[LiveTalking] exited with code ${code}`)
      ltProcess = null
      if (ltStartupReject) {
        ltStartupReject(new Error(`LiveTalking exited with code ${code}`))
        ltStartupResolve = null
        ltStartupReject = null
      }
    })

    let healthCheckCount = 0
    const healthInterval = setInterval(async () => {
      if (!ltProcess || ltProcess.exitCode !== null) {
        clearInterval(healthInterval)
        return
      }
      healthCheckCount++
      try {
        const res = await fetch(`http://127.0.0.1:${port}/is_speaking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionid: 'health-check' })
        })
        if (res.ok) {
          clearInterval(healthInterval)
          if (ltStartupResolve) {
            ltStartupResolve()
            ltStartupResolve = null
            ltStartupReject = null
          }
        }
      } catch {
        // service not ready yet
      }
      if (healthCheckCount >= 30) {
        clearInterval(healthInterval)
        if (ltStartupReject) {
          ltStartupReject(new Error('LiveTalking health check timeout (15s)'))
          ltStartupResolve = null
          ltStartupReject = null
        }
      }
    }, 500)
  })
}

export async function stopLiveTalking(): Promise<void> {
  if (!ltProcess) {
    return
  }

  console.log('[LiveTalking] stopping...')

  return new Promise((resolve) => {
    const proc = ltProcess!
    const killTimeout = setTimeout(() => {
      if (ltProcess) {
        console.log('[LiveTalking] force kill')
        proc.kill('SIGKILL')
        ltProcess = null
      }
      resolve()
    }, 5000)

    proc.on('exit', () => {
      clearTimeout(killTimeout)
      ltProcess = null
      resolve()
    })

    proc.kill('SIGTERM')
  })
}
