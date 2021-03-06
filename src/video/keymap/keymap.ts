import { VideoSpeedController } from '../default-video-speed'
import { KeyBinding, KeyBindingAction } from './key-bindings'

const supportedUrls = [
  'https://www.bilibili.com/bangumi/',
  'https://www.bilibili.com/video/',
  'https://www.bilibili.com/cheese/',
  'https://www.bilibili.com/watchlater/',
  'https://www.bilibili.com/medialist/play/',
]

let config: { enable: boolean }
if (supportedUrls.some(url => document.URL.startsWith(url))) {
  const clickElement = (target: string | HTMLElement) => {
    return () => {
      if (typeof target === 'string') {
        (dq(target) as HTMLElement)?.click()
      } else {
        target.click()
      }
    }
  }
  const changeVideoTime = (delta: number) => {
    return () => {
      const video = dq('.bilibili-player-video video') as HTMLVideoElement
      if (!video) {
        return
      }
      video.currentTime += delta
    }
  }
  /** 提示框用的`setTimeout`句柄 */
  let tipTimeoutHandle: number
  /**
   * 显示提示框
   * @param text 文字 (可以 HTML)
   * @param icon MDI 图标 class
   */
  const showTip = (text: string, icon: string) => {
    let tip = dq('.keymap-tip') as HTMLDivElement
    if (!tip) {
      const player = dq('.bilibili-player-video-wrap')
      if (!player) {
        return
      }
      player.insertAdjacentHTML('afterbegin', /*html*/`
        <div class="keymap-tip-container">
          <i class="keymap-tip-icon mdi ${icon}"></i>
          <div class="keymap-tip">${text}</div>
        </div>
      `)
      resources.applyStyleFromText(`
        .keymap-tip-container {
          position: absolute;
          left: 50%;
          top: 50%;
          transform: translate(-50%, -50%);
          padding: 8px 16px;
          background-color: #000A;
          color: white;
          pointer-events: none;
          opacity: 0;
          z-index: 100;
          display: flex;
          align-items: center;
          font-size: 14pt;
          border-radius: 4px;
          transition: .2s ease-out;
        }
        .keymap-tip-container.show {
          opacity: 1;
        }
        .keymap-tip-container i {
          line-height: 1;
          margin-right: 8px;
          font-size: 18pt;
        }
      `, 'keymapStyle')
      tip = dq('.keymap-tip') as HTMLDivElement
    }
    tip.innerHTML = text
    const container = dq('.keymap-tip-container') as HTMLDivElement
    const iconElement = dq(container, '.mdi') as HTMLElement
    iconElement.classList.remove(...iconElement.classList.values())
    iconElement.classList.add('mdi', icon)
    if (tipTimeoutHandle) {
      clearTimeout(tipTimeoutHandle)
    }
    container.classList.add('show')
    tipTimeoutHandle = window.setTimeout(() => {
      container.classList.remove('show')
    }, 2000)
  }
  const videoSpeed = (controllerAction: (controller: VideoSpeedController, rates: number[]) => void) => {
    return async () => {
      const { VideoSpeedController } = await import('../default-video-speed')
      const containerElement = dq(`.${VideoSpeedController.classNameMap.speedContainer}`) as HTMLElement
      const videoElement = dq(`.${VideoSpeedController.classNameMap.video} video`) as HTMLVideoElement
      if (!containerElement || !videoElement) {
        return
      }
      const controller = new VideoSpeedController(containerElement, videoElement, 1)
      controllerAction(controller, VideoSpeedController.supportedRates)
      showTip(`${controller.playbackRate}x`, 'mdi-fast-forward')
    }
  }
  const actions = {
    fullscreen: clickElement('.bilibili-player-video-btn-fullscreen'),
    webFullscreen: clickElement('.bilibili-player-video-web-fullscreen'),
    wideScreen: clickElement('.bilibili-player-video-btn-widescreen'),
    volumeUp: () => {
      const current = unsafeWindow.player.volume()
      unsafeWindow.player.volume(current + 0.1)
      showTip(`${Math.round(unsafeWindow.player.volume() * 100)}%`, 'mdi-volume-high')
    },
    volumeDown: () => {
      const current = unsafeWindow.player.volume()
      unsafeWindow.player.volume(current - 0.1)
      const after = Math.round(unsafeWindow.player.volume() * 100)
      if (after === 0) {
        showTip('静音', 'mdi-volume-off')
      } else {
        showTip(`${after}%`, 'mdi-volume-high')
      }
    },
    mute: () => {
      clickElement('.bilibili-player-video-btn-volume .bilibili-player-iconfont-volume')()
      const isMute = unsafeWindow.player.isMute()
      if (isMute) {
        showTip('已静音', 'mdi-volume-off')
      } else {
        showTip('已取消静音', 'mdi-volume-high')
      }
    },
    pictureInPicture: clickElement('.bilibili-player-video-btn-pip'),
    coin: clickElement('.video-toolbar .coin,.tool-bar .coin-info, .video-toolbar-module .coin-box, .play-options-ul > li:nth-child(2)'),
    favorite: clickElement('.video-toolbar .collect, .video-toolbar-module .fav-box, .play-options-ul > li:nth-child(3)'),
    pause: clickElement('.bilibili-player-video-btn-start'),
    like: (() => {
      /** 长按`L`三连使用的记忆变量 */
      let likeClick = true
      /** 在稍后再看页面里, 记录当前视频是否赞过 */
      let liked = false

      const listenWatchlaterVideoChange = _.once(() => {
        Observer.videoChange(() => {
          Ajax.getJsonWithCredentials(`https://api.bilibili.com/x/web-interface/archive/has/like?aid=${unsafeWindow.aid}`).then(json => {
            liked = Boolean(json.data)
          })
        })
      })
      return (({ isWatchlater, isMediaList, event }) => {
        if (isWatchlater) {
          listenWatchlaterVideoChange()
          const formData = {
            aid: unsafeWindow.aid,
            /** `1`点赞; `2`取消赞 */
            like: liked ? 2 : 1,
            csrf: getCsrf(),
          }
          Ajax.postTextWithCredentials(`https://api.bilibili.com/x/web-interface/archive/like`, Object.entries(formData).map(([k, v]) => `${k}=${v}`).join('&')).then(() => {
            liked = !liked
            if (liked) {
              Toast.success(`已点赞`, `快捷键扩展`, 1000)
            } else {
              Toast.success(`已取消点赞`, `快捷键扩展`, 1000)
            }
          })
        } else if (isMediaList) {
          const likeButton = dq('.play-options-ul > li:first-child') as HTMLLIElement
          if (likeButton) {
            likeButton.click()
          }
        } else {
          const likeButton = dq('.video-toolbar .like') as HTMLSpanElement
          event.preventDefault()
          const fireEvent = (name: string, args: Event) => {
            const event = new CustomEvent(name, args)
            likeButton.dispatchEvent(event)
          }
          likeClick = true
          setTimeout(() => likeClick = false, 200)
          fireEvent('mousedown', event)
          document.body.addEventListener('keyup', e => {
            e.preventDefault()
            fireEvent('mouseup', e)
            if (likeClick) {
              fireEvent('click', e)
            }
          }, { once: true })
        }
      }) as KeyBindingAction
    })(),
    danmaku: () => {
      const checkbox = dq('.bilibili-player-video-danmaku-switch input') as HTMLInputElement
      if (!checkbox) {
        return
      }
      checkbox.checked = !checkbox.checked
      raiseEvent(checkbox, 'change')
    },
    longJumpBackward: changeVideoTime(-settings.keymapJumpSeconds),
    longJumpForward: changeVideoTime(settings.keymapJumpSeconds),
    jumpBackward: changeVideoTime(-5),
    jumpForward: changeVideoTime(5),
    playerMenu: () => {
      // menu size: 386.6 x 311 (2020-03-29)
      // menu size: 176.65 x 194 (2020-06-09)
      const player = dq('.bilibili-player-video-wrap') as HTMLElement
      if (!player) {
        return
      }
      const rect = player.getBoundingClientRect()
      player.dispatchEvent(new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: false,
        view: unsafeWindow,
        button: 2,
        buttons: 0,
        clientX: rect.x + rect.width / 2 - 176.65 / 2,
        clientY: rect.y + rect.height / 2 - 194 / 2
      }))
    },
    watchlater: clickElement('.video-toolbar .ops .watchlater, .more-ops-list .ops-watch-later, .video-toolbar-module .see-later-box'),
    quickFavorite: clickElement('.quick-favorite'),
    videoSpeedIncrease: videoSpeed((controller, rates) => {
      controller.setVideoSpeed(rates.find(it => it > controller.playbackRate) || rates[rates.length - 1])
    }),
    videoSpeedDecrease: videoSpeed((controller, rates) => {
      controller.setVideoSpeed([...rates].reverse().find(it => it < controller.playbackRate) || rates[0])
    }),
    videoSpeedReset: videoSpeed((controller) => {
      controller.reset()
    }),
    takeScreenshot: clickElement('.video-take-screenshot'),
    previousFrame: clickElement('.prev-frame'),
    nextFrame: clickElement('.next-frame'),
  }
  const defaultBindings: { [action in keyof typeof actions]: string } = {
    fullscreen: 'f',
    webFullscreen: 'w',
    wideScreen: 't',
    volumeUp: 'arrowUp',
    volumeDown: 'arrowDown',
    mute: 'm',
    pictureInPicture: 'p',
    coin: 'c',
    favorite: 's',
    pause: 'space',
    like: 'l',
    playerMenu: '`',
    longJumpForward: 'j',
    longJumpBackward: 'shift j',
    jumpBackward: 'arrowLeft',
    jumpForward: 'arrowRight',
    watchlater: 'shift w',
    quickFavorite: 'shift s',
    danmaku: 'd',
    videoSpeedIncrease: 'shift > 》 arrowUp',
    videoSpeedDecrease: 'shift < 《 arrowDown',
    videoSpeedReset: 'shift ? ？',
    takeScreenshot: 'ctrl alt c',
    previousFrame: 'shift arrowLeft',
    nextFrame: 'shift arrowRight',
  }
  const parseBindings = (bindings: { [action: string]: string }) => {
    return Object.entries(bindings).map(([actionName, keyString]) => {
      const keys = keyString.split(' ')
      return {
        keys,
        action: (actions as any)[actionName] || (() => {}),
      } as KeyBinding
    })
  }

  ;(async () => {
    const { loadKeyBindings } = await import('./key-bindings')
    config = loadKeyBindings(parseBindings(
      { ...defaultBindings, ...settings.customKeyBindings }
    ))
  })()
}

export default {
  reload: () => config && (config.enable = true),
  unload: () => config && (config.enable = false),
}
