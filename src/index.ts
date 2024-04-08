import type React from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import { act } from 'react-dom/test-utils'

/*UID*/
const uidPrefix = Date.now().toString(16) + '-' + Math.floor(Math.random() * (2 ** 32)).toString(16)
let uidNum = 0
type UID = string

const uid = (): UID => {
  return uidPrefix + '-' + (uidNum++).toString(16)
}

/*Logging*/
const logInfo = (...msg: any[]) => {
  if (ObservableGlobalState.debug) console.log(...msg)
}

const logWarn = (...msg: any[]) => {
  console.warn(...msg)
}

/*Reaction*/
export class Reaction {
  static readonly empty = new Reaction(() => {})
  readonly uid = uid()
  renderCycle = -1

  readonly listener: () => void
  constructor(listener: () => void) {
    this.listener = listener
  }

  private _isDisposed: boolean = false
  get isDisposed(): boolean { return this._isDisposed }
  dispose() {
    this._isDisposed = true
  }

  run() {
    this.listener()
  }
}

export class ReactionSet {
  private reactions = Array<Reaction>()
  private readonly hash = new Set<UID>()

  get size(): number {
    return this.reactions.length
  }

  add(r: Reaction) {
    if (!this.hash.has(r.uid)) {
      this.hash.add(r.uid)
      this.reactions.push(r)
    }
  }

  clear() {
    this.hash.clear()
    this.reactions.length = 0
  }

  remove(predicate: (r: Reaction) => boolean) {
    this.reactions = this.reactions.filter(r => {
      if (predicate(r)) {
        this.hash.delete(r.uid)
        return false
      } else {
        return true
      }
    })
  }

  forEach(callbackFn: (r: Reaction) => void) {
    this.reactions.forEach(callbackFn)
  }
}

export class ObservableGlobalState {
  static renderCycle = 0
  static reaction: Reaction = Reaction.empty
  static testMode = false
  static debug = false
}

export enum ReactionRunnerStatus {
  IDLE = 'IDLE',
  PENDING = 'PENDING',
  RUNNING = 'LOADING',
}

class ReactionRunner {
  static readonly self = new ReactionRunner()

  private readonly temp = Array<Observable>()
  private readonly queue = new Set<Observable>()
  private status = ReactionRunnerStatus.IDLE

  addToQueue(ob: Observable) {
    if (this.infiniteLoopFound) return

    if (this.status === ReactionRunnerStatus.RUNNING) {
      this.temp.push(ob)
    } else {
      this.queue.add(ob)
      if (this.status === ReactionRunnerStatus.IDLE) {
        this.status = ReactionRunnerStatus.PENDING
        setTimeout(() => {
          this.runAll()
        }, 10)
      }
    }
  }

  private readonly INFINITE_LOOP_LIMIT = 20
  private infiniteLoopFound = false
  private loopRenderings = 0
  private runAll() {
    logInfo('--Start executing of reaction...')
    this.status = ReactionRunnerStatus.RUNNING
    ObservableGlobalState.renderCycle++
    let executedReactions = 0
    this.queue.forEach((ob) => {
      if (!ob.isDisposed && ob.isMutated) {
        ob.reactions.remove(r => r.isDisposed)
        logInfo(ob.className + ':: running of', ob.reactions.size, 'subscribers')
        ob.reactions.forEach(r => {
          if (r.renderCycle !== ObservableGlobalState.renderCycle) {
            r.renderCycle = ObservableGlobalState.renderCycle
            r.run()
            executedReactions++
          }
        })
        ob.ready()
      }
    })

    this.queue.clear()
    this.status = ReactionRunnerStatus.IDLE
    if (this.temp.length > 0) {
      this.loopRenderings++

      if (this.loopRenderings > 2) {
        logWarn('Generating mutations while reactions are running may cause an infinite loop. Loop renderings:', this.loopRenderings,
          '. Frequently mutated observables: [', ...this.temp.map(ob => ob.className), ']')
      }

      if (this.loopRenderings < this.INFINITE_LOOP_LIMIT) {
        this.temp.forEach(ob => { this.addToQueue(ob) })
        this.temp.length = 0
      } else {
        this.infiniteLoopFound = true
        logWarn('--Infinite Loop! The possible reason: An executed reaction X invoked new rendering of a JSX-component, ' +
          'that caused mutation in observable object, that added again the reaction X to the execution queue.')
      }
    } else {
      this.loopRenderings = 0
    }
    logInfo("--End of reaction's executing, total executions:", executedReactions)
  }
}

export class Observable {
  readonly reactions = new ReactionSet()
  readonly className: string

  constructor(className: string = '') {
    this.className = className || 'Some observable'
  }

  addReaction(reaction: Reaction) {
    if (this.isDisposed) {
      logWarn('Attempt to subscribe to disposed Observable object!', ', this =', this)
    } else {
      this.reactions.add(reaction)
    }
  }

  subscribe(callback: () => void): () => void {
    if (this.isDisposed) {
      logWarn('Attempt to subscribe to disposed Observable object!', ', this =', this)
      return () => {}
    } else {
      const newReaction = new Reaction(callback)
      this.reactions.add(newReaction)
      return () => { this.reactions.remove(r => newReaction.uid === r.uid) }
    }
  }

  private _isMutated = false
  get isMutated(): boolean { return this._isMutated }

  private _isDisposed: boolean = false
  get isDisposed(): boolean { return this._isDisposed }

  mutated() {
    if (!this._isMutated) {
      this._isMutated = true
      console.log(this.className, 'mutated')
      ReactionRunner.self.addToQueue(this)
    }
  }

  ready() {
    this._isMutated = false
  }

  dispose() {
    if (!this._isDisposed) {
      this._isDisposed = true
      logInfo('dispose: subscribers before =', this.reactions.size, ', this =', this)
      this.reactions.clear()
      logInfo('dispose: subscribers after =', this.reactions.size + ', this =', this)
    }
  }
}

// GLOBAL OBSERVE METHODS

export function observe<T extends Observable | undefined>(observable: T): T {
  if (observable) {
    if (ObservableGlobalState.reaction !== Reaction.empty) {
      logInfo('observe(' + observable.className + '), reaction uid =', ObservableGlobalState.reaction.uid)
      observable.addReaction(ObservableGlobalState.reaction)
    } else {
      logWarn('observe(' + observable.className + ') is failed: JSX Function Component has not "observer" wrapper!')
    }
  }

  return observable
}

export function observer<T>(component: (props: T) => React.JSX.Element): ((props: T) => React.JSX.Element) {
  return (props: T) => {
    const reactionRef = useRef<Reaction>(Reaction.empty)
    const [_, forceUpdate] = useState({})

    if (reactionRef.current === Reaction.empty) {
      reactionRef.current = new Reaction(() => {
        if (ObservableGlobalState.testMode) {
          act(() => {
            forceUpdate({})
          })
        } else {
          forceUpdate({})
        }
      })
    }

    useLayoutEffect(() => () => { reactionRef.current.dispose() }, [])

    const parentGlobalReaction = ObservableGlobalState.reaction
    ObservableGlobalState.reaction = reactionRef.current

    reactionRef.current.renderCycle = ObservableGlobalState.renderCycle
    const renderedComponent = component(props)

    ObservableGlobalState.reaction = parentGlobalReaction

    return renderedComponent
  }
}
