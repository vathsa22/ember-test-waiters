import { DEBUG } from "@glimmer/env"
import Token from "./token"
import { register } from "./waiter-manager"

function getNextToken() {
  return new Token()
}

class TestWaiterImpl {
  isRegistered = false

  items = new Map()
  completedOperationsForTokens = new WeakMap()
  completedOperationsForPrimitives = new Map()

  constructor(name, nextToken) {
    this.name = name
    // @ts-ignore
    this.nextToken = nextToken || getNextToken
  }

  beginAsync(token = this.nextToken(), label) {
    this._register()

    if (this.items.has(token)) {
      throw new Error(
        `beginAsync called for ${token} but it is already pending.`
      )
    }

    let error = new Error()

    this.items.set(token, {
      get stack() {
        return error.stack
      },
      label
    })

    return token
  }

  endAsync(token) {
    if (
      !this.items.has(token) &&
      !this._getCompletedOperations(token).has(token)
    ) {
      throw new Error(`endAsync called with no preceding beginAsync call.`)
    }

    this.items.delete(token)
    // Mark when a waiter operation has completed so we can distinguish
    // whether endAsync is being called before a prior beginAsync call above.
    this._getCompletedOperations(token).set(token, true)
  }

  waitUntil() {
    return this.items.size === 0
  }

  debugInfo() {
    return [...this.items.values()]
  }

  reset() {
    this.items.clear()
  }

  _register() {
    if (!this.isRegistered) {
      register(this)
      this.isRegistered = true
    }
  }

  _getCompletedOperations(token) {
    let type = typeof token

    return token !== null || (type !== "function" && type !== "object")
      ? this.completedOperationsForPrimitives
      : this.completedOperationsForTokens
  }
}

class NoopTestWaiter {
  constructor(name) {
    this.name = name
  }

  beginAsync() {
    return this
  }

  endAsync() {}

  waitUntil() {
    return true
  }

  debugInfo() {
    return []
  }

  reset() {}
}

/**
 * Builds and returns a test waiter. The type of the
 * returned waiter is dependent on whether the app or
 * addon is in `DEBUG` mode or not.
 *
 * @public
 *
 * @param name {string} The name of the test waiter
 * @returns {TestWaiter}
 *
 * @example
 *
 * import Component from '@ember/component';
 * import { buildWaiter } from 'ember-test-waiters';
 *
 * if (DEBUG) {
 *   let waiter = buildWaiter('friend-waiter');
 * }
 *
 * export default class Friendz extends Component {
 *   didInsertElement() {
 *     let token = waiter.beginAsync(this);
 *
 *     someAsyncWork().then(() => {
 *       waiter.endAsync(token);
 *     });
 *   }
 * }
 */
export default function buildWaiter(name) {
  if (DEBUG) {
    return new TestWaiterImpl(name)
  }
  return new NoopTestWaiter(name)
}
